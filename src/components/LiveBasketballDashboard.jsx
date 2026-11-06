import React, { useState, useEffect } from 'react';
import './LiveBasketballDashboard.css';

export default function LiveBasketballDashboard() {
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterMode, setFilterMode] = useState('all'); // 'alerts', 'all', 'ht'
  const [expandedGameId, setExpandedGameId] = useState(null);

  const GIST_ID = import.meta.env.VITE_LIVE_GIST_ID;
  const ENGINE_STALE_THRESHOLD_MS = 5 * 60 * 1000;

  const isEngineOnline = (data) => {
    if (!data?.updated_at) return false;
    const lastUpdate = new Date(data.updated_at).getTime();
    return (Date.now() - lastUpdate) < ENGINE_STALE_THRESHOLD_MS;
  };

  const toggleExpand = (gid) => {
    setExpandedGameId(prev => prev === gid ? null : gid);
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
            const content = json.files?.["live_basketball.json"]?.content;
            if (content) {
              data = JSON.parse(content);
            }
          }
        } catch (err) {
          console.warn("Gist fetch error for live basketball, attempting fallback:", err);
        }
      }

      // 2. Fallback to local static file
      if (!data) {
        try {
          const res = await fetch(`/data/basketball/live_inplay_predictions.json?t=${Date.now()}`);
          if (res.ok) {
            data = await res.json();
          }
        } catch (err) {
          console.warn("Local fallback error for live basketball:", err);
        }
      }

      // 3. Fallback standby state so the radar stays gracefully connected
      if (!data) {
        data = {
          updated_at: null,
          active_games_count: 0,
          alerts_count: 0,
          alerts: [],
          games: []
        };
      }

      setLiveData(data);
      setError(null);
      // Default to 'alerts' view if alerts exist on first load
      if (data.alerts && data.alerts.length > 0 && filterMode === 'all') {
        setFilterMode('alerts');
      }
      setLoading(false);
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // 30s live poll
    return () => clearInterval(interval);
  }, [GIST_ID]);

  if (loading) {
    return (
      <div className="bball-live-loading">
        <div className="radar-ping"></div>
        <span>Connecting to Basketball In-Play Engine...</span>
      </div>
    );
  }

  if (error && !liveData) {
    return <div className="bball-live-error">{error}</div>;
  }

  const allGames = liveData?.games || [];
  const allAlerts = liveData?.alerts || [];
  const htGames = allGames.filter(g => g.status === 'HT');

  let filteredGames = allGames;
  if (filterMode === 'alerts') {
    filteredGames = allGames.filter(g => g.primary_signal && g.primary_signal !== 'IN PROGRESS');
  } else if (filterMode === 'ht') {
    filteredGames = htGames;
  }

  return (
    <div className="bball-live-dashboard">
      {/* ── Top Header Bar ── */}
      <div className="bball-live-header">
        <div className="header-title-box">
          <h2>
            <span className="radar-ping"></span>
            🏀 LIVE IN-PLAY &amp; HALFTIME RADAR
          </h2>
          <span className="header-subtitle">
            Quarter Breakdown · Halftime Mean Reversion Model · Sportsbook Odds Edge
          </span>
        </div>

        <div className="bball-live-controls">
          <button
            className={`filter-btn ${filterMode === 'alerts' ? 'active' : ''}`}
            onClick={() => setFilterMode('alerts')}
          >
            🔥 Actionable Alerts ({allAlerts.length})
          </button>
          <button
            className={`filter-btn ${filterMode === 'ht' ? 'active' : ''}`}
            onClick={() => setFilterMode('ht')}
          >
            ⏱️ Halftime ({htGames.length})
          </button>
          <button
            className={`filter-btn ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            All Live Games ({allGames.length})
          </button>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div className="bball-live-meta">
        <div className="meta-left">
          <span className="status-indicator online"></span>
          <span>
            {isEngineOnline(liveData) ? 'Live Polling Active' : 'Offline / Standby'}
          </span>
          <span className="meta-divider">•</span>
          <span>Last Updated: {liveData?.updated_at ? new Date(liveData.updated_at).toLocaleTimeString() : '—'}</span>
        </div>
        <div className="meta-right">
          <span>Tracking <strong>{allGames.length}</strong> matches across active leagues</span>
        </div>
      </div>

      {/* ── Prominent Actionable Halftime Alerts Carousel/Strip ── */}
      {allAlerts.length > 0 && (
        <div className="bball-alerts-section">
          <div className="alerts-heading">
            <span className="alert-fire-icon">🚨</span>
            <h3>HIGH-CONVICTION IN-PLAY SIGNALS</h3>
          </div>
          <div className="alerts-grid">
            {allAlerts.map((alt, idx) => {
              const isFade = alt.signal?.includes('FADE');
              const isBounce = alt.signal?.includes('BOUNCE');
              const isBlowout = alt.signal?.includes('BLOWOUT');
              const cardClass = isFade ? 'fade-under' : isBounce ? 'bounce-over' : isBlowout ? 'blowout-under' : 'clutch-under';

              return (
                <div key={idx} className={`alert-card ${cardClass}`}>
                  <div className="alert-top">
                    <span className="alert-badge">{alt.signal}</span>
                    <span className="alert-league">{alt.league}</span>
                  </div>

                  <div className="alert-matchup">
                    <h4>{alt.matchup}</h4>
                    <div className="alert-score-badge">
                      <span>{alt.scores}</span>
                      <span className="score-status">{alt.status}</span>
                    </div>
                  </div>

                  <p className="alert-reason">{alt.reason}</p>

                  <div className="alert-numbers">
                    <div className="num-box">
                      <span className="num-lbl">2H Proj</span>
                      <span className="num-val">{alt.proj_2h != null ? alt.proj_2h.toFixed(1) : '—'}</span>
                    </div>
                    <div className="num-box">
                      <span className="num-lbl">Live Line</span>
                      <span className="num-val line">{alt.live_line != null ? alt.live_line : '—'}</span>
                    </div>
                    <div className="num-box">
                      <span className="num-lbl">Edge</span>
                      <span className={`num-val edge ${alt.edge_2h > 0 ? 'pos' : 'neg'}`}>
                        {alt.edge_2h > 0 ? `+${alt.edge_2h.toFixed(1)}` : alt.edge_2h?.toFixed(1) || '—'}
                      </span>
                    </div>
                    <div className="num-box pick-box">
                      <span className="num-lbl">Pick</span>
                      <span className="num-val pick">{alt.pick}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main In-Play Games Grid ── */}
      {filteredGames.length === 0 ? (
        <div className="bball-empty-state">
          <div className="empty-radar-icon">📡</div>
          <h3>No Live Games Under Current Filter</h3>
          <p>
            {filterMode === 'alerts'
              ? 'No high-conviction live signals triggered right now. Switch to "All Live Games" to view all games in progress.'
              : filterMode === 'ht'
              ? 'No games currently at Halftime. Switch to "All Live Games" to see active quarters.'
              : 'The In-Play Engine is continuously monitoring global tip-offs.'}
          </p>
        </div>
      ) : (
        <div className="bball-games-grid">
          {filteredGames.map((game) => {
            const isHT = game.status === 'HT';
            const hasSignal = game.primary_signal && game.primary_signal !== 'IN PROGRESS';
            const htProj = game.halftime_projection;
            const liveMkt = game.live_market;
            const isExpanded = expandedGameId === game.game_id;

            return (
              <div
                key={game.game_id}
                className={`bball-game-card ${isHT ? 'halftime-card' : ''} ${hasSignal ? 'signal-card' : ''}`}
                onClick={() => toggleExpand(game.game_id)}
              >
                {/* Card Header */}
                <div className="card-header">
                  <div className="header-left-meta">
                    <span className={`status-pill ${isHT ? 'status-ht' : 'status-live'}`}>
                      {isHT ? 'HALF TIME' : game.status} {game.timer ? `· ${game.timer}` : ''}
                    </span>
                    <span className="league-pill">{game.league}</span>
                  </div>
                  {hasSignal && (
                    <span className="card-signal-pill">{game.primary_signal}</span>
                  )}
                </div>

                {/* Teams & Score Box */}
                <div className="card-teams-box">
                  <div className="team-row">
                    <span className="team-name">{game.home_team}</span>
                    <span className={`team-pts ${game.scores?.home > game.scores?.away ? 'leading' : ''}`}>
                      {game.scores?.home ?? '—'}
                    </span>
                  </div>
                  <div className="team-row">
                    <span className="team-name">{game.away_team}</span>
                    <span className={`team-pts ${game.scores?.away > game.scores?.home ? 'leading' : ''}`}>
                      {game.scores?.away ?? '—'}
                    </span>
                  </div>
                  <div className="match-total-pill">
                    Total: <strong>{game.scores?.total ?? '—'}</strong>
                    {game.scores?.margin != null && (
                      <span className="margin-pill">Δ {game.scores.margin}</span>
                    )}
                  </div>
                </div>

                {/* Quarter Scoring Strip */}
                <div className="quarters-strip">
                  {['quarter_1', 'quarter_2', 'quarter_3', 'quarter_4'].map((qKey, qIdx) => {
                    const qData = game.scores?.[qKey];
                    const label = `Q${qIdx + 1}`;
                    const hasScores = qData && qData.home != null && qData.away != null;

                    return (
                      <div key={qKey} className={`q-col ${hasScores ? 'played' : 'empty'}`}>
                        <span className="q-label">{label}</span>
                        <span className="q-score">
                          {hasScores ? `${qData.home}-${qData.away}` : '—'}
                        </span>
                        <span className="q-total">
                          {hasScores ? `(${qData.total})` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Halftime Regression Box */}
                {htProj && (
                  <div className="halftime-projection-box">
                    <div className="ht-header">
                      <span>1H Pace Deviation</span>
                      <span className={`ht-delta-badge ${htProj.h1_delta > 0 ? 'hot' : 'cold'}`}>
                        {htProj.h1_delta > 0 ? `+${htProj.h1_delta.toFixed(1)} pts Hot` : `${htProj.h1_delta.toFixed(1)} pts Cold`}
                      </span>
                    </div>

                    <div className="ht-stats-row">
                      <div className="ht-stat-item">
                        <span className="stat-sub">1H Actual</span>
                        <span className="stat-num">{htProj.h1_actual}</span>
                      </div>
                      <div className="ht-stat-arrow">➔</div>
                      <div className="ht-stat-item">
                        <span className="stat-sub">2H Model Proj</span>
                        <span className="stat-num highlight">{htProj.proj_h2?.toFixed(1)}</span>
                      </div>
                      <div className="ht-stat-item">
                        <span className="stat-sub">Final Proj</span>
                        <span className="stat-num">{htProj.proj_final?.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Live Odds & Edge Strip */}
                {liveMkt && liveMkt.market_total != null && (
                  <div className="live-odds-strip">
                    <div className="odds-item">
                      <span className="odds-lbl">Book ({liveMkt.bookmaker || 'Consensus'})</span>
                      <span className="odds-val">{liveMkt.market_total}</span>
                    </div>
                    {liveMkt.edge_2h != null && (
                      <div className="odds-item">
                        <span className="odds-lbl">2H Edge</span>
                        <span className={`odds-val ${liveMkt.edge_2h > 0 ? 'edge-pos' : 'edge-neg'}`}>
                          {liveMkt.edge_2h > 0 ? `+${liveMkt.edge_2h.toFixed(1)}` : liveMkt.edge_2h.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Expand / Collapse Indicator */}
                <div className="expand-indicator">
                  <span>{isExpanded ? '▲ Hide Analysis' : '▼ View Model Details'}</span>
                </div>

                {/* Detailed Expanded Drawer */}
                {isExpanded && (
                  <div className="game-expanded-drawer">
                    {game.pregame && (
                      <div className="expanded-section">
                        <h5>Pregame Expectation</h5>
                        <div className="pregame-meta-row">
                          <span>Model Total: <strong>{game.pregame.model_total?.toFixed(1) || '—'}</strong></span>
                          <span>Market Total: <strong>{game.pregame.market_total || '—'}</strong></span>
                          <span>Band: <strong>{game.pregame.confidence || '—'}</strong></span>
                        </div>
                      </div>
                    )}

                    {game.signals && game.signals.length > 0 && (
                      <div className="expanded-section">
                        <h5>Active Signal Breakdown</h5>
                        {game.signals.map((sig, sIdx) => (
                          <div key={sIdx} className="sig-detail-item">
                            <div className="sig-head">
                              <span className="sig-badge">{sig.label}</span>
                              <span className="sig-pick-pill">PICK: {sig.pick}</span>
                            </div>
                            <p className="sig-reason">{sig.reason}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

