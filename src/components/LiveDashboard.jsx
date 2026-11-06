import React, { useState, useEffect } from 'react';
import './LiveDashboard.css';
import LiveBasketballDashboard from './LiveBasketballDashboard';

export default function LiveDashboard({ sport = 'football' }) {
  if (sport === 'basketball') {
    return <LiveBasketballDashboard />;
  }

  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('actionable'); // 'actionable' or 'all'
  const [expandedMatchId, setExpandedMatchId] = useState(null);

  const GIST_ID = import.meta.env.VITE_LIVE_GIST_ID;
  const ENGINE_STALE_THRESHOLD_MS = 10 * 60 * 1000;

  const isEngineOnline = (data) => {
    if (!data?.updated_at) return false;
    const lastUpdate = new Date(data.updated_at).getTime();
    return (Date.now() - lastUpdate) < ENGINE_STALE_THRESHOLD_MS;
  };

  const toggleExpand = (fixId) => {
    setExpandedMatchId(prev => prev === fixId ? null : fixId);
  };

  useEffect(() => {
    const fetchData = async () => {
      let data = null;
      let gistReachable = false;

      // 1. Try Gist first if GIST_ID is present
      if (GIST_ID) {
        try {
          const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, { cache: 'no-store' });
          if (res.ok) {
            gistReachable = true;
            const json = await res.json();
            const fileContent = json.files?.["live_momentum.json"]?.content;
            if (fileContent) {
              data = JSON.parse(fileContent);
            }
          }
        } catch (err) {
          console.warn("Gist fetch error for live football, attempting fallback:", err);
        }
      }

      // 2. Fallback to local static file
      if (!data) {
        try {
          const res = await fetch(`/data/football/live_momentum.json?t=${Date.now()}`);
          if (res.ok) {
            data = await res.json();
          }
        } catch (err) {
          try {
            const res2 = await fetch(`/live_momentum.json?t=${Date.now()}`);
            if (res2.ok) {
              data = await res2.json();
            }
          } catch (e) {
            // ignore
          }
        }
      }

      // 3. If Gist is reachable but live_momentum.json has not yet been seeded
      if (!data && gistReachable) {
        data = {
          updated_at: null,
          active_games: 0,
          matches: []
        };
      }

      if (data) {
        setLiveData(data);
        setError(null);
      } else {
        if (!GIST_ID) {
          setError("No VITE_LIVE_GIST_ID configured and local live data unavailable.");
        } else {
          setError("Failed to fetch live football data. Ensure live engine has run.");
        }
      }
      setLoading(false);
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [GIST_ID]);

  if (loading) {
    return (
      <div className="live-dashboard-loading">
        <div className="radar-ping"></div>
        <span>Connecting to Football In-Play Engine...</span>
      </div>
    );
  }

  if (error && !liveData) {
    return <div className="live-dashboard-error">{error}</div>;
  }

  const allMatches = liveData?.matches || [];
  const actionableMatches = allMatches.filter(m => (m.triggers && m.triggers.length > 0) || Math.abs(m.momentum_diff || 0) >= 20);
  const matchesToDisplay = viewMode === 'actionable' ? actionableMatches : allMatches;

  return (
    <div className="live-dashboard">
      {/* ── Header ── */}
      <div className="live-header">
        <div className="header-title-box">
          <h2>
            <span className="radar-ping"></span>
            LIVE IN-PLAY RADAR
          </h2>
          <span className="header-subtitle">
            Real-Time Pressure Index (PI) · Live xGOT · Tactical Momentum Triggers
          </span>
        </div>

        <div className="live-controls">
          <button
            className={`view-btn ${viewMode === 'actionable' ? 'active' : ''}`}
            onClick={() => setViewMode('actionable')}
          >
            Actionable Signals ({actionableMatches.length})
          </button>
          <button
            className={`view-btn ${viewMode === 'all' ? 'active' : ''}`}
            onClick={() => setViewMode('all')}
          >
            All Live Matches ({allMatches.length})
          </button>
        </div>
      </div>

      {/* ── Status Meta Bar ── */}
      <div className="live-meta">
        <div className="meta-left">
          <span className={`status-indicator ${isEngineOnline(liveData) ? 'online' : 'standby'}`}></span>
          <span>
            {isEngineOnline(liveData) ? 'Live Polling Active' : 'Standby / Offline'}
          </span>
          <span className="meta-divider">•</span>
          <span>Last Updated: {liveData?.updated_at ? new Date(liveData.updated_at).toLocaleTimeString() : '—'}</span>
        </div>
        <div className="meta-right">
          <span>Tracking <strong>{allMatches.length}</strong> active matches</span>
        </div>
      </div>

      {/* ── Matches Grid ── */}
      <div className="live-matches-grid">
        {matchesToDisplay.length === 0 ? (
          <div className="live-dashboard-empty">
            <div className="empty-radar-icon">📡</div>
            <h3>No Live Matches Under Current Filter</h3>
            <p>
              {viewMode === 'actionable' && allMatches.length > 0
                ? 'No matches meet high-conviction pressure/xGOT triggers right now. Switch to "All Live Matches" to view all games in progress.'
                : 'The Football In-Play Engine is monitoring upcoming fixtures. Active match momentum, Pressure Index, and xGOT will stream here.'}
            </p>
          </div>
        ) : (
          matchesToDisplay.map((match) => (
            <div
              key={match.fixture_id}
              className={`live-match-card ${match.triggers?.length > 0 ? 'highlight' : ''} ${expandedMatchId === match.fixture_id ? 'expanded' : ''}`}
              onClick={() => toggleExpand(match.fixture_id)}
            >
              <div className="match-header">
                <span className="live-clock-pill">{match.status} {match.elapsed}'</span>
                <div className="match-triggers">
                  {match.triggers?.map(t => {
                    let cls = 'trigger-badge';
                    if (t.includes('SIEGE') || t.includes('RED')) cls += ' siege';
                    else if (t.includes('HEROICS')) cls += ' heroics';
                    return <span key={t} className={cls}>{t.replace(/_/g, ' ')}</span>
                  })}
                </div>
              </div>

              <div className="match-teams">
                <div className={`team ${(match.score?.split('-')[0] || 0) < (match.score?.split('-')[1] || 0) ? 'losing' : ''}`}>
                  <span className="name">{match.match?.split(' vs ')[0] || 'Home'}</span>
                  <span className="score">{match.score?.split('-')[0] ?? 0}</span>
                </div>
                <div className={`team ${(match.score?.split('-')[1] || 0) < (match.score?.split('-')[0] || 0) ? 'losing' : ''}`}>
                  <span className="name">{match.match?.split(' vs ')[1] || 'Away'}</span>
                  <span className="score">{match.score?.split('-')[1] ?? 0}</span>
                </div>
              </div>

              <div className="match-stats">
                <div className="stat-row">
                  <span className="stat-label">Pressure Index (PI)</span>
                  <div className="stat-values">
                    <span className={`pi ${match.home_pi > match.away_pi ? 'dom' : ''}`}>{match.home_pi}</span>
                    <span className="vs">vs</span>
                    <span className={`pi ${match.away_pi > match.home_pi ? 'dom' : ''}`}>{match.away_pi}</span>
                  </div>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Shots on Goal</span>
                  <div className="stat-values">
                    <span>{match.stats?.home?.shots_on_goal ?? 0}</span>
                    <span>-</span>
                    <span>{match.stats?.away?.shots_on_goal ?? 0}</span>
                  </div>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Live xGOT</span>
                  <div className="stat-values">
                    <span className={`xgot-val ${(match.home_xgot || 0) > (match.away_xgot || 0) ? 'dom' : ''}`}>
                      {match.home_xgot != null ? match.home_xgot.toFixed(2) : ((match.stats?.home?.shots_on_goal || 0) * 0.32).toFixed(1)}
                    </span>
                    <span className="vs">vs</span>
                    <span className={`xgot-val ${(match.away_xgot || 0) > (match.home_xgot || 0) ? 'dom' : ''}`}>
                      {match.away_xgot != null ? match.away_xgot.toFixed(2) : ((match.stats?.away?.shots_on_goal || 0) * 0.32).toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="stat-row-vertical">
                  <div className="stat-label-split">
                    <span className="poss-val home-poss">{match.stats?.home?.possession ?? 50}%</span>
                    <span className="stat-label">Possession</span>
                    <span className="poss-val away-poss">{match.stats?.away?.possession ?? 50}%</span>
                  </div>
                  <div className="possession-bar-container">
                    <div className="possession-bar home" style={{ width: `${match.stats?.home?.possession ?? 50}%` }}></div>
                    <div className="possession-bar away" style={{ width: `${match.stats?.away?.possession ?? 50}%` }}></div>
                  </div>
                </div>
              </div>

              {match.pre_match_prediction && (
                <div className="match-prematch">
                  <small>Pre-match Probabilities:</small>
                  <div className="probs-bar-container">
                    <div className="prob-bar home" style={{ width: `${match.pre_match_prediction.home_win}%` }}></div>
                    <div className="prob-bar draw" style={{ width: `${match.pre_match_prediction.draw}%` }}></div>
                    <div className="prob-bar away" style={{ width: `${match.pre_match_prediction.away_win}%` }}></div>
                  </div>
                  <div className="probs-labels">
                    <span className="home-lbl">{match.pre_match_prediction.home_win}% H</span>
                    <span className="draw-lbl">{match.pre_match_prediction.draw}% D</span>
                    <span className="away-lbl">{match.pre_match_prediction.away_win}% A</span>
                  </div>
                </div>
              )}

              {expandedMatchId === match.fixture_id && (
                <div className="live-match-expanded">
                  <div className="expanded-stats-grid">
                    <div className="expanded-stat-col">
                      <div className="stat-label">Total Shots</div>
                      <div className="stat-values"><span>{match.stats?.home?.total_shots || 0}</span> - <span>{match.stats?.away?.total_shots || 0}</span></div>
                    </div>
                    <div className="expanded-stat-col">
                      <div className="stat-label">GK Goals Prevented</div>
                      <div className="stat-values">
                        <span className={(match.home_gk_prevented || 0) > 0 ? 'gk-good' : ''}>
                          {match.home_gk_prevented != null ? (match.home_gk_prevented > 0 ? `+${match.home_gk_prevented}` : match.home_gk_prevented) : '-'}
                        </span>
                        {' - '}
                        <span className={(match.away_gk_prevented || 0) > 0 ? 'gk-good' : ''}>
                          {match.away_gk_prevented != null ? (match.away_gk_prevented > 0 ? `+${match.away_gk_prevented}` : match.away_gk_prevented) : '-'}
                        </span>
                      </div>
                    </div>
                    <div className="expanded-stat-col">
                      <div className="stat-label">Fouls</div>
                      <div className="stat-values"><span>{match.stats?.home?.fouls || 0}</span> - <span>{match.stats?.away?.fouls || 0}</span></div>
                    </div>
                    <div className="expanded-stat-col">
                      <div className="stat-label">Yellow Cards</div>
                      <div className="stat-values"><span>{match.stats?.home?.yellow_cards || 0}</span> - <span>{match.stats?.away?.yellow_cards || 0}</span></div>
                    </div>
                  </div>

                  {match.recent_events && match.recent_events.length > 0 && (
                    <div className="recent-events-timeline">
                      <h4>Recent Events</h4>
                      <ul>
                        {match.recent_events.map((e, idx) => (
                          <li key={idx}>
                            <span className="event-time">{e.time}'</span>
                            <span className={`event-type type-${e.type?.toLowerCase()}`}>{e.type}</span>
                            <span className="event-detail">{e.detail} - {e.player} ({e.team})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

            </div>
          ))
        )}
      </div>
    </div>
  );
}
