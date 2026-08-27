import { useState, useEffect, useMemo } from 'react'
import { fetchDates, fetchPredictions, fetchLeaderboard, fetchTeamLeaderboard } from './api'
import Header from './components/Header'
import Scorecard from './components/Scorecard'
import LeagueGroup from './components/LeagueGroup'
import TeamTracker from './components/TeamTracker'

function isWomensLeague(league = '') {
  const l = league.toLowerCase()
  return l.includes('women') || l.includes('woman') || l.includes('ladies') || / w$/.test(l)
}

function isPlayoffGame(stage = '') {
  if (!stage) return false
  const s = String(stage).toLowerCase()
  return s.includes('final') || s.includes('place') || s.includes('playoff') || s.includes('championship')
}

function groupByLeague(predictions, sport) {
  const map = new Map()
  for (const p of predictions) {
    const key = `${p.league_id}||${p.league}||${p.country}`
    if (!map.has(key)) map.set(key, { league: p.league, country: p.country, league_id: p.league_id, games: [] })
    map.get(key).games.push(p)
  }

  if (sport === 'basketball') {
    return [...map.values()].map(group => {
      const consolidatedMap = new Map()
      for (const game of group.games) {
        const fixtureKey = `${game.home_team}||${game.away_team}||${game.time}`
        if (!consolidatedMap.has(fixtureKey)) {
          consolidatedMap.set(fixtureKey, {
            home_team: game.home_team,
            away_team: game.away_team,
            time: game.time,
            predictions: {}
          })
        }
        const consolidated = consolidatedMap.get(fixtureKey)
        const isAdv = game.model_architecture?.includes('ADVANCED')
        if (isAdv) consolidated.predictions.adv = game
        else consolidated.predictions.srs = game

        // Sync match-level info to top level (status, scores, result)
        if (game.status) consolidated.status = game.status
        if (game.actual_home_score !== undefined) consolidated.actual_home_score = game.actual_home_score
        if (game.actual_away_score !== undefined) consolidated.actual_away_score = game.actual_away_score
        if (game.actual_result) consolidated.actual_result = game.actual_result
      }
      return { ...group, games: [...consolidatedMap.values()] }
    })
  }

  return [...map.values()]
}

const LEAGUE_PRIORITY = {
  // European Tournaments
  2: 1, 3: 2, 848: 3,
  // Top 5 Europe
  39: 10, 140: 11, 135: 12, 78: 13, 61: 14,
  // Major Domestic Cups
  45: 15, 48: 16, 143: 17, 137: 18, 81: 19, 66: 19,
  // 2nd Divisions
  40: 20, 141: 21, 136: 22, 79: 23, 62: 24,
  // Americas
  253: 30, 254: 31, 71: 32, 262: 33, 128: 34
}

function sortGroups(groups, sortBy) {
  if (sortBy === 'country') return [...groups].sort((a, b) => a.country.localeCompare(b.country))
  if (sortBy === 'time') return [...groups]
  
  // Default (Competition): Sort by global tier, then alphabetical
  return [...groups].sort((a, b) => {
    const aPrio = LEAGUE_PRIORITY[a.league_id] || 999
    const bPrio = LEAGUE_PRIORITY[b.league_id] || 999
    if (aPrio !== bPrio) return aPrio - bPrio
    return a.league.localeCompare(b.league)
  })
}

function filterPredictions(predictions, decision, country, drawMin, sport, leaderboard = [], maxMape = 100, maxVolatility = 100, filterBttsHitRate = 0, filterWomen = 'all', hidePlayoffs = false, smartEdgeFilter = false, teamLeaderboard = []) {
  // Pre-build O(1) lookup map for team leaderboard
  const teamLbMap = new Map(teamLeaderboard.map(t => [`${t.league_id}__${(t.name || '').toLowerCase()}`, t]))
  return predictions.filter(p => {
    if (hidePlayoffs && isPlayoffGame(p.stage)) return false
    if (filterWomen === 'women' && !isWomensLeague(p.league)) return false
    if (filterWomen === 'men'   &&  isWomensLeague(p.league)) return false
    // Sport-specific decision mapping
    const pDecision = sport === 'football' ? p.btts_decision : p.decision
    if (decision !== 'all' && pDecision !== decision) return false
    
    if (country  !== 'all' && p.country        !== country)  return false
    if (sport === 'football' && drawMin !== 0 && (p.draw_prob_1x2 ?? 0) < drawMin) return false
    
    if (sport === 'football' && filterBttsHitRate > 0) {
      // Filter 1: League safety gate — must have >= 50% historical BTTS rate
      const stats = leaderboard.find(x => (p.league_id && x.league_id === p.league_id) || x.name === `${p.country?.toUpperCase()} — ${p.league?.toUpperCase()}`)
      if (stats && (stats.btts_hit_rate ?? 100) < 55) return false
      // Filter 2: Poisson model probability >= selected threshold
      if ((p.btts_prob ?? 0) < filterBttsHitRate) return false
      // Filter 3: Team model accuracy >= 60% (only when team has >= 5 graded plays)
      const TEAM_MIN_PLAYS = 8
      const TEAM_HIT_RATE  = 70
      for (const teamName of [p.home_team, p.away_team]) {
        if (!teamName) continue
        const teamStats = teamLbMap.get(`${p.league_id}__${teamName.toLowerCase()}`)
        if (teamStats && (teamStats.btts_plays ?? 0) >= TEAM_MIN_PLAYS) {
          if ((teamStats.btts_hit_rate ?? 100) < TEAM_HIT_RATE) return false
        }
      }
    }
    
    // MAPE & Volatility Filter (Basketball only)
    if (sport === 'basketball' && (maxMape < 100 || maxVolatility < 100)) {
      const stats = leaderboard.find(x => (p.league_id && x.league_id === p.league_id) || x.name === `${p.country?.toUpperCase()} — ${p.league?.toUpperCase()}`)
      if (!stats) return false
      
      const isAdv = p.model_architecture?.includes('ADVANCED')
      const targetStats = isAdv ? stats.adv : stats.srs
      
      if (!targetStats || targetStats.graded_totals === 0) return false
      if (maxMape < 100 && targetStats.mape > maxMape) return false
      if (maxVolatility < 100 && (targetStats.volatility_index == null || targetStats.volatility_index > maxVolatility)) return false
    }
    
    // Smart Edge Filter (Basketball only)
    if (sport === 'basketball' && smartEdgeFilter) {
      // 1. Volume Check (>= 10 graded games in leaderboard)
      const stats = leaderboard.find(x => (p.league_id && x.league_id === p.league_id) || x.name === `${p.country?.toUpperCase()} — ${p.league?.toUpperCase()}`)
      if (!stats) return false
      // 1. Team Volume Check (Both teams must have >= 10 matches played)
      const mc = p.match_center || {}
      const hMatches = mc.statsH?.played || 0
      const aMatches = mc.statsA?.played || 0
      
      if (hMatches < 10 || aMatches < 10) return false

      // 2. Stability Check
      const h_vol = p.home_team_volatility
      const a_vol = p.away_team_volatility
      if (h_vol == null || a_vol == null) return false

      if (isWomensLeague(p.league)) {
        // Women: Both Colored (<= 16.6)
        if (h_vol > 16.6 || a_vol > 16.6) return false
      } else {
        // Men: Both Green (< 14.8)
        if (h_vol >= 14.8 || a_vol >= 14.8) return false
      }
    }
    
    return true
  })
}

export default function App() {
  const [sport,         setSport]         = useState('basketball')
  const [dates,         setDates]         = useState([])   // [{date,graded,...}]
  const [selectedDate,  setSelectedDate]  = useState(null)
  const [data,          setData]          = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)
  const [sortBy,        setSortBy]        = useState('competition')
  const [filterDecision,setFilterDecision]= useState('all')
  const [filterCountry, setFilterCountry] = useState('all')
  const [filterDraw,    setFilterDraw]    = useState(0)    // min draw_prob_1x2 threshold
  const [filterBttsHitRate, setFilterBttsHitRate] = useState(0) // min BTTS hit rate percentage
  const [filterMape,    setFilterMape]    = useState(100)  // max error percentage
  const [filterVolatility, setFilterVolatility] = useState(100) // max standard deviation
  const [filterWomen,   setFilterWomen]   = useState('all') // 'all' | 'women' | 'men'
  const [hidePlayoffs,  setHidePlayoffs]  = useState(false) // true = hide playoff games
  const [smartEdgeFilter, setSmartEdgeFilter] = useState(false) // 🎯 Smart Edge filter
  
  // High-level App View Mode 
  const [viewMode,      setViewMode]      = useState('matches') // 'matches' | 'teams'

  const [compactMode, setCompactMode] = useState(true)

  const toggleCompact = () => setCompactMode(prev => !prev)

  // ── Night Shift ──────────────────────────────────────────
  const [nightShift, setNightShift] = useState(() => {
    const manual = localStorage.getItem('nightShiftOverride')
    return manual !== null ? manual === 'true' : true
  })

  // Apply theme to body
  useEffect(() => {
    document.body.dataset.theme = nightShift ? 'dark' : 'light'
  }, [nightShift])

  const toggleNightShift = () => {
    setNightShift(prev => {
      const next = !prev
      localStorage.setItem('nightShiftOverride', String(next))
      return next
    })
  }
  
  const [leaderboard,   setLeaderboard]   = useState([])
  const [teamLeaderboard, setTeamLeaderboard] = useState([])
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    let isActive = true
    setLoading(true)
    fetchDates(sport)
      .then(d => { 
        if (!isActive) return
        setDates(d)
        if (d.length > 0) {
          // Keep same date if possible when switching sports
          const matches = d.find(x => x.date === selectedDate)
          if (!matches) setSelectedDate(d[0].date) 
        } else {
          setSelectedDate(null)
          setData(null)
        }
        setLoading(false)
      })
      .catch(() => {
        if (!isActive) return
        setError(`Could not fetch ${sport} dates.`)
        setLoading(false)
      })
      
    fetchLeaderboard(sport)
      .then(d => { if (isActive) setLeaderboard(d) })
      .catch(e => console.warn(`Could not fetch ${sport} leaderboard:`, e))
      
    fetchTeamLeaderboard(sport)
      .then(d => { if (isActive) setTeamLeaderboard(d) })
      .catch(e => console.warn(`Could not fetch ${sport} team leaderboard:`, e))

    return () => { isActive = false }
  }, [sport])

  useEffect(() => {
    if (!selectedDate) return
    let isActive = true
    setLoading(true); setError(null); 
    fetchPredictions(selectedDate, sport)
      .then(d => { 
        if (isActive) {
          setData(d); setLoading(false) 
        }
      })
      .catch(e => { 
        if (isActive) {
          setError(e.message); setLoading(false) 
        }
      })
    return () => { isActive = false }
  }, [selectedDate, sport])

  const countries = useMemo(() => {
    if (!data) return []
    return ['all', ...new Set(data.predictions.map(p => p.country))]
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    return filterPredictions(data.predictions, filterDecision, filterCountry, filterDraw, sport, leaderboard, filterMape, filterVolatility, filterBttsHitRate, filterWomen, hidePlayoffs, smartEdgeFilter, teamLeaderboard)
  }, [data, filterDecision, filterCountry, filterDraw, sport, leaderboard, filterMape, filterVolatility, filterBttsHitRate, filterWomen, hidePlayoffs, smartEdgeFilter, teamLeaderboard])

  const groups = useMemo(() => sortGroups(groupByLeague(filtered, sport), sortBy), [filtered, sortBy, sport])

  const counts = useMemo(() => {
    if (sport === 'football') {
      const yes    = filtered.filter(p => p.btts_decision === 'PLAY YES').length
      const no     = filtered.filter(p => p.btts_decision === 'PLAY NO' || p.btts_decision === '[STRONG] PLAY NO').length
      const strong = filtered.filter(p => p.btts_decision === '[STRONG] PLAY NO').length
      const pass   = filtered.filter(p => p.btts_decision === 'PASS').length
      return { total: filtered.length, yes, no, strong, pass }
    } else {
      const yes    = filtered.filter(p => p.decision === 'PLAY OVER').length
      const no     = filtered.filter(p => p.decision === 'PLAY UNDER').length
      const strong = filtered.filter(p => (p.edge ?? 0) > 5.0).length
      const pass   = filtered.filter(p => p.decision === 'PASS' || p.decision === 'MODEL ONLY').length
      // Count unique fixtures (not raw predictions which may include both models)
      const matchSet = new Set(filtered.map(p => `${p.home_team}||${p.away_team}||${p.time}`))
      return { total: matchSet.size, yes, no, strong, pass }
    }
  }, [filtered, sport])

  // Is this date graded at all (partially or fully)?
  const dateInfo    = dates.find(d => d.date === selectedDate)
  const hasGrading  = (dateInfo?.graded_count ?? 0) > 0

  return (
    <div className={`app ${compactMode ? 'compact-mode' : ''}`}>
      <Header 
        dates={dates} 
        selected={selectedDate} 
        onSelect={setSelectedDate} 
        sport={sport}
        setSport={(s) => { 
          setSport(s); 
          setData(null);
          setError(null);
          setFilterDecision('all'); 
          setFilterCountry('all'); 
          setFilterDraw(0); 
          setFilterBttsHitRate(0);
          setFilterMape(100);
          setFilterVolatility(100);
          setFilterWomen('all');
          setHidePlayoffs(false);
          setSmartEdgeFilter(false);
          setViewMode('matches');
        }}
        filterDecision={filterDecision}
        setFilterDecision={setFilterDecision}
        filterDraw={filterDraw}
        setFilterDraw={setFilterDraw}
        setFilterCountry={setFilterCountry}
        compactMode={compactMode}
        toggleCompact={toggleCompact}
        nightShift={nightShift}
        toggleNightShift={toggleNightShift}
      />
      <div className="main-wrapper">



        {/* Scorecard (only shown if grading data exists) */}
        {hasGrading && data && <Scorecard data={data} sport={sport} />}

        {/* API connection error — shown prominently above controls */}
        {error && !loading && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: '12px 16px', marginBottom: 12, color: '#991b1b', fontWeight: 600, fontSize: 13 }}>
            ❌ {error}
          </div>
        )}

        {/* Controls row */}
        <div className="controls-bar">
          {sport === 'basketball' && (
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 2, marginRight: 16 }}>
              {[['all', 'All'], ['women', '♀ Women'], ['men', '♂ Men']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilterWomen(val)}
                  style={{
                    padding: '4px 12px',
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: filterWomen === val ? '#fff' : 'transparent',
                    color: filterWomen === val
                      ? (val === 'women' ? '#db2777' : val === 'men' ? '#2563eb' : '#0f172a')
                      : '#64748b',
                    boxShadow: filterWomen === val ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="control-group">
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Sort:</span>
            {['competition', 'country', 'time'].map(s => (
              <button key={s} className={`control-btn ${sortBy === s ? 'active' : ''}`} onClick={() => setSortBy(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {sport === 'football' && (
            <div className="control-group">
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>BTTS:</span>
              <select className="filter-select" value={filterDecision} onChange={e => setFilterDecision(e.target.value)}>
                <option value="all">All decisions</option>
                <option value="PLAY YES">PLAY YES</option>
                <option value="PLAY NO">PLAY NO</option>
                <option value="[STRONG] PLAY NO">[STRONG] PLAY NO</option>
                <option value="PASS">PASS</option>
              </select>
            </div>
          )}

          {sport === 'football' && (
            <div className="control-group">
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Draw:</span>
              <select className="filter-select" value={filterDraw} onChange={e => setFilterDraw(Number(e.target.value))}>
                <option value={0}>All draws</option>
                <option value={25}>≥ 25%</option>
                <option value={30}>≥ 30%</option>
                <option value={35}>≥ 35%</option>
                <option value={40}>≥ 40%</option>
              </select>

              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>BTTS %:</span>
              <select className="filter-select" value={filterBttsHitRate} onChange={e => setFilterBttsHitRate(Number(e.target.value))}>
                <option value={0}>All rates</option>
                <option value={70}>≥ 70%</option>
                <option value={60}>≥ 60%</option>
                <option value={50}>≥ 50%</option>
              </select>
            </div>
          )}

          {sport === 'basketball' && (
            <div className="control-group">
              <select className="filter-select" style={{ width: '130px' }} value={filterMape} onChange={e => setFilterMape(Number(e.target.value))}>
                <option value={100}>MAPE</option>
                <option value={10.0}>&lt; 10.0% MAPE</option>
                <option value={8.0}>&lt; 8.0% MAPE</option>
                <option value={6.5}>&lt; 6.5% MAPE</option>
                <option value={5.0}>&lt; 5.0% MAPE</option>
              </select>

              <select className="filter-select" style={{ width: '130px' }} value={filterVolatility} onChange={e => setFilterVolatility(Number(e.target.value))}>
                <option value={100}>Volatility</option>
                <option value={14.0}>&lt; 14.0 σ</option>
                <option value={10.0}>&lt; 10.0 σ</option>
                <option value={9.0}>&lt; 9.0 σ (Elite)</option>
              </select>

              <button
                onClick={() => setHidePlayoffs(!hidePlayoffs)}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: `1px solid ${hidePlayoffs ? '#fecaca' : '#e2e8f0'}`,
                  cursor: 'pointer',
                  background: hidePlayoffs ? '#fef2f2' : '#f8fafc',
                  color: hidePlayoffs ? '#ef4444' : '#64748b',
                  transition: 'all 0.15s'
                }}
                title={hidePlayoffs ? "Playoff games are hidden" : "Showing playoff games"}
              >
                {hidePlayoffs ? '❌ Playoffs Hidden' : '🏆 Playoffs Included'}
              </button>

              <button
                onClick={() => {
                  setSmartEdgeFilter(!smartEdgeFilter)
                  if (!smartEdgeFilter) {
                    setFilterVolatility(100) // Clear standard volatility filter when activating Smart Edge
                    setFilterWomen('all') // Ensure we see both men and women to see the full Smart Edge board
                  }
                }}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 800,
                  borderRadius: 6,
                  border: `1px solid ${smartEdgeFilter ? '#fef08a' : '#e2e8f0'}`,
                  cursor: 'pointer',
                  background: smartEdgeFilter ? '#fef9c3' : '#f8fafc',
                  color: smartEdgeFilter ? '#854d0e' : '#64748b',
                  transition: 'all 0.15s'
                }}
                title="Only show Men (Green/Green) and Women (Colored/Colored) in leagues with ≥10 graded games"
              >
                {smartEdgeFilter ? '🎯 Smart Edge: ON' : '🎯 Smart Edge'}
              </button>
            </div>
          )}

          <div className="control-group">
            <select className="filter-select" value={filterCountry} onChange={e => setFilterCountry(e.target.value)}>
              {countries.map(c => <option key={c} value={c}>{c === 'all' ? 'All countries' : c}</option>)}
            </select>
          </div>

          <div className="controls-bar-right">
            {data && (
              <div className="summary-pill">
                <strong>{counts.total}</strong> games
                {sport === 'football' && (
                  <>
                    {' · '}
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>{counts.yes} YES</span> ·{' '}
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>{counts.no} NO</span>
                    {counts.strong > 0 && <span style={{ color: '#7f1d1d', fontWeight: 700 }}> ({counts.strong} ⚡)</span>} ·{' '}
                    <span style={{ color: '#6b7280' }}>{counts.pass} PASS</span>
                  </>
                )}
              </div>
            )}


            {/* Night Shift Toggle — sits next to Compact */}
            <button
              className={`night-shift-btn ${nightShift ? 'active' : ''}`}
              onClick={toggleNightShift}
              title="Night Shift: click to toggle"
            >
              {nightShift ? '🌙' : '☀️'}
            </button>
          </div>

        </div>

        {loading && <div className="loading">⚽ Loading predictions…</div>}
        {error   && <div className="empty-state"><div className="icon">❌</div><p>{error}</p></div>}
        {!loading && !error && viewMode === 'matches' && groups.length === 0 && data && (
          <div className="empty-state"><div className="icon">📭</div><p>No predictions match your filters.</p></div>
        )}

        {!loading && !error && viewMode === 'teams' && (
          <TeamTracker teamLeaderboard={teamLeaderboard} />
        )}

        {!loading && !error && viewMode === 'matches' && groups.length > 0 && (
          <div className="predictions-table">
            {groups.map(g => {
              const stats = leaderboard.find(x => (g.league_id && x.league_id === g.league_id) || x.name === `${g.country?.toUpperCase()} — ${g.league?.toUpperCase()}`)
              return <LeagueGroup key={`${g.league_id}-${g.league}`} group={{...g, stats}} sport={sport} teamLeaderboard={teamLeaderboard} />
            })}
          </div>
        )}

        {/* Scroll to Top Button */}
        <button 
          className={`scroll-top-btn ${showScrollTop ? 'visible' : ''}`} 
          onClick={scrollToTop}
          title="Go to top"
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
