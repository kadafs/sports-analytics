import React, { useState, useEffect } from 'react';
import './LiveDashboard.css';

export default function LiveDashboard() {
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('actionable');
  const [expandedMatchId, setExpandedMatchId] = useState(null); // 'actionable' or 'all'

  // The Gist URL where the live engine pushes data
  const GIST_ID = import.meta.env.VITE_LIVE_GIST_ID;
  
  // If the Gist hasn't been updated in > 3 minutes, the engine is offline
  const ENGINE_STALE_THRESHOLD_MS = 3 * 60 * 1000;
  
  const isEngineOnline = (data) => {
    if (!data?.updated_at) return false;
    const lastUpdate = new Date(data.updated_at).getTime();
    return (Date.now() - lastUpdate) < ENGINE_STALE_THRESHOLD_MS;
  };

  const toggleExpand = (fixId) => {
    setExpandedMatchId(prev => prev === fixId ? null : fixId);
  };

  useEffect(() => {
    if (!GIST_ID) {
      setError("No VITE_LIVE_GIST_ID provided in environment variables.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, { cache: 'no-store' });
        if (!response.ok) throw new Error("Failed to fetch live data");
        const json = await response.json();
        
        const fileContent = json.files["live_momentum.json"]?.content;
        if (!fileContent) throw new Error("No live_momentum.json found in Gist");
        
        const data = JSON.parse(fileContent);
        setLiveData(data);
        setError(null);
      } catch (err) {
        console.error("Live fetch error:", err);
        setError("Failed to fetch live data. Ensure engine is running.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [GIST_ID]);

  if (loading) return <div className="live-dashboard-loading">Loading live radar...</div>;
  if (error && !liveData) return <div className="live-dashboard-error">{error}</div>;
  if (!liveData || !isEngineOnline(liveData)) return (
    <div className="live-dashboard-offline">
      <span className="offline-dot"></span>
      <span>Live Engine offline — no active session</span>
    </div>
  );
  if (liveData.active_games === 0) return <div className="live-dashboard-empty">No live games tracked currently.</div>;

  const actionableMatches = liveData.matches.filter(m => m.triggers.length > 0 || Math.abs(m.momentum_diff) >= 20);
  const matchesToDisplay = viewMode === 'actionable' ? actionableMatches : liveData.matches;

  return (
    <div className="live-dashboard">
      <div className="live-header">
        <h2>🔴 LIVE IN-PLAY RADAR</h2>
        <div className="live-controls">
          <button 
            className={`view-btn ${viewMode === 'actionable' ? 'active' : ''}`}
            onClick={() => setViewMode('actionable')}
          >
            Actionable Only ({actionableMatches.length})
          </button>
          <button 
            className={`view-btn ${viewMode === 'all' ? 'active' : ''}`}
            onClick={() => setViewMode('all')}
          >
            All Live ({liveData.matches.length})
          </button>
        </div>
      </div>
      
      <div className="live-meta">
        <span>Last Updated: {new Date(liveData.updated_at).toLocaleTimeString()}</span>
      </div>

      <div className="live-matches-grid">
        {matchesToDisplay.length === 0 ? (
          <div className="live-dashboard-empty">No actionable games right now.</div>
        ) : (
          matchesToDisplay.map((match) => (
            <div key={match.fixture_id} className={`live-match-card ${match.triggers.length > 0 ? 'highlight' : ''} ${expandedMatchId === match.fixture_id ? 'expanded' : ''}`} onClick={() => toggleExpand(match.fixture_id)}>
              <div className="match-header">
                <span className="match-time">{match.status} {match.elapsed}'</span>
                {match.triggers.map(t => (
                  <span key={t} className="trigger-badge">{t.replace(/_/g, ' ')}</span>
                ))}
              </div>
              <div className="match-teams">
                <div className={`team ${match.score.split('-')[0] < match.score.split('-')[1] ? 'losing' : ''}`}>
                  <span className="name">{match.match.split(' vs ')[0]}</span>
                  <span className="score">{match.score.split('-')[0]}</span>
                </div>
                <div className={`team ${match.score.split('-')[1] < match.score.split('-')[0] ? 'losing' : ''}`}>
                  <span className="name">{match.match.split(' vs ')[1]}</span>
                  <span className="score">{match.score.split('-')[1]}</span>
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
                    <span>{match.stats.home.shots_on_goal}</span>
                    <span>-</span>
                    <span>{match.stats.away.shots_on_goal}</span>
                  </div>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Possession</span>
                  <div className="stat-values">
                    <span>{match.stats.home.possession}%</span>
                    <span>-</span>
                    <span>{match.stats.away.possession}%</span>
                  </div>
                </div>
              </div>
              <div className="match-prematch">
                <small>Pre-match Expectation:</small>
                <div className="probs">
                  <span>Home: {match.pre_match_prediction.home_win}%</span>
                  <span>Draw: {match.pre_match_prediction.draw}%</span>
                  <span>Away: {match.pre_match_prediction.away_win}%</span>
                </div>
              </div>
              
              {expandedMatchId === match.fixture_id && (
                <div className="live-match-expanded">
                  <div className="expanded-stats-grid">
                    <div className="expanded-stat-col">
                      <div className="stat-label">Total Shots</div>
                      <div className="stat-values"><span>{match.stats?.home?.total_shots || 0}</span> - <span>{match.stats?.away?.total_shots || 0}</span></div>
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
