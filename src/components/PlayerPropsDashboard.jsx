import React, { useState, useEffect, useMemo } from 'react'
import { fetchPlayerProps } from '../api'
import './PlayerPropsDashboard.css'

export default function PlayerPropsDashboard({ selectedDate }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [propsData, setPropsData] = useState(null)

  // Filters
  const [category, setCategory] = useState('ALL') // ALL | REBOUNDS | POINTS_ASSISTS | POINTS
  const [marketTier, setMarketTier] = useState('standard') // standard (1.60-2.30) | alt (>2.30) | all
  const [direction, setDirection] = useState('ALL') // ALL | OVER | UNDER
  const [conviction, setConviction] = useState('all') // all | high
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('ev') // ev | edge | win_prob | odds

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    fetchPlayerProps(selectedDate)
      .then(res => {
        if (!isMounted) return
        if (res) {
          setPropsData(res)
        } else {
          setError('No player props data available for this date.')
        }
        setLoading(false)
      })
      .catch(err => {
        if (!isMounted) return
        setError('Failed to load player props.')
        setLoading(false)
      })

    return () => { isMounted = false }
  }, [selectedDate])

  // Select list of props based on tier
  const rawList = useMemo(() => {
    if (!propsData) return []
    if (marketTier === 'standard') {
      return propsData.standard_value_plays || []
    }
    if (marketTier === 'alt') {
      return propsData.alt_value_plays || []
    }
    // All
    return [
      ...(propsData.standard_value_plays || []),
      ...(propsData.alt_value_plays || [])
    ]
  }, [propsData, marketTier])

  // Apply User Filters
  const filteredList = useMemo(() => {
    let list = [...rawList]

    // Category
    if (category !== 'ALL') {
      list = list.filter(p => p.prop_type === category)
    }

    // Direction
    if (direction !== 'ALL') {
      list = list.filter(p => p.direction === direction)
    }

    // Conviction
    if (conviction === 'high') {
      list = list.filter(p => p.is_high_conviction || (p.edge_pct >= 8.0 && p.ev_pct >= 10.0))
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(p => 
        p.player.toLowerCase().includes(q) || 
        (p.game && p.game.toLowerCase().includes(q))
      )
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'ev') return b.ev_pct - a.ev_pct
      if (sortBy === 'edge') return b.edge_pct - a.edge_pct
      if (sortBy === 'win_prob') return b.win_probability - a.win_probability
      if (sortBy === 'odds') return a.odds - b.odds
      return 0
    })

    return list
  }, [rawList, category, direction, conviction, search, sortBy])

  // Compute Live Graded Stats for filtered list
  const gradedStats = useMemo(() => {
    const graded = filteredList.filter(p => p.won !== undefined)
    if (graded.length === 0) return null

    const wins = graded.filter(p => p.won).length
    const losses = graded.filter(p => !p.won && !p.push).length
    const pushes = graded.filter(p => p.push).length
    const total = wins + losses
    const winRate = total > 0 ? (wins / total * 100).toFixed(1) : '0.0'
    const profit = graded.reduce((sum, p) => sum + (p.profit || 0), 0).toFixed(2)
    const roi = graded.length > 0 ? ((profit / graded.length) * 100).toFixed(1) : '0.0'

    return { total: graded.length, wins, losses, pushes, winRate, profit, roi }
  }, [filteredList])

  if (loading) {
    return (
      <div className="props-dashboard">
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          🏀 Loading quantitative NBA player props…
        </div>
      </div>
    )
  }

  if (error || !propsData) {
    return (
      <div className="props-dashboard">
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎯</div>
          <p>{error || 'No player props found for this date.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="props-dashboard">
      {/* Header */}
      <div className="props-header">
        <div className="props-title-box">
          <h2>
            <span>🎯 NBA Quantitative Player Props</span>
            <span className="props-badge-accent">API-Basketball</span>
          </h2>
          <div className="props-subtitle">
            <span>Date: <strong>{propsData.date}</strong></span>
            <span>·</span>
            <span>Total Evaluated: <strong>{propsData.total_evaluated?.toLocaleString() || '2,400+'}</strong> lines</span>
            <span>·</span>
            <span style={{ color: '#10b981' }}>Model: <strong>Dual Poisson & Normal CDF</strong></span>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="props-stats-grid">
        <div className="stat-card">
          <span className="stat-card-label">Standard Value Plays</span>
          <span className="stat-card-value">{propsData.standard_value_count || 0}</span>
          <span className="stat-card-sub">Odds 1.60 – 2.30</span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Backtested Standard WR</span>
          <span className="stat-card-value" style={{ color: '#10b981' }}>60.2%</span>
          <span className="stat-card-sub">+11.6% ROI (174-115)</span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Top Category: Rebounds</span>
          <span className="stat-card-value" style={{ color: '#38bdf8' }}>64.7% WR</span>
          <span className="stat-card-sub" style={{ color: '#38bdf8' }}>+19.2% ROI (Poisson CDF)</span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Secondary: Pts + Ast</span>
          <span className="stat-card-value" style={{ color: '#c084fc' }}>59.8% WR</span>
          <span className="stat-card-sub" style={{ color: '#c084fc' }}>+10.1% ROI (Normal CDF)</span>
        </div>
      </div>

      {/* Live Graded Banner if game results are present */}
      {gradedStats && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '8px',
          padding: '10px 16px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>🏁</span>
            <span style={{ fontWeight: 700, color: '#10b981' }}>
              OFFICIAL BOXSCORE GRADED RESULTS:
            </span>
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
              {gradedStats.wins}-{gradedStats.losses}-{gradedStats.pushes} ({gradedStats.winRate}% Win Rate)
            </span>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Net Profit: <strong style={{ color: gradedStats.profit >= 0 ? '#10b981' : '#f87171' }}>{gradedStats.profit > 0 ? `+${gradedStats.profit}u` : `${gradedStats.profit}u`}</strong></span>
            <span>ROI: <strong style={{ color: gradedStats.roi >= 0 ? '#10b981' : '#f87171' }}>{gradedStats.roi > 0 ? `+${gradedStats.roi}%` : `${gradedStats.roi}%`}</strong></span>
          </div>
        </div>
      )}

      {/* Interactive Toolbar */}
      <div className="props-toolbar">
        {/* Row 1: Market Tier & Categories */}
        <div className="toolbar-row">
          <div className="pill-group">
            <span className="pill-label">Market:</span>
            <button
              className={`props-pill ${marketTier === 'standard' ? 'active' : ''}`}
              onClick={() => setMarketTier('standard')}
            >
              Standard 2-Way <span className="pill-tag">1.60-2.30</span>
            </button>
            <button
              className={`props-pill ${marketTier === 'alt' ? 'active' : ''}`}
              onClick={() => setMarketTier('alt')}
            >
              Alt / Milestones <span className="pill-tag">&gt; 2.30</span>
            </button>
            <button
              className={`props-pill ${marketTier === 'all' ? 'active' : ''}`}
              onClick={() => setMarketTier('all')}
            >
              All Plays
            </button>
          </div>

          <div className="pill-group">
            <span className="pill-label">Category:</span>
            <button
              className={`props-pill ${category === 'ALL' ? 'active' : ''}`}
              onClick={() => setCategory('ALL')}
            >
              All
            </button>
            <button
              className={`props-pill ${category === 'REBOUNDS' ? 'active-reb' : ''}`}
              onClick={() => setCategory('REBOUNDS')}
            >
              Rebounds <span className="pill-tag" style={{ color: '#38bdf8' }}>64.7% WR</span>
            </button>
            <button
              className={`props-pill ${category === 'POINTS_ASSISTS' ? 'active-pa' : ''}`}
              onClick={() => setCategory('POINTS_ASSISTS')}
            >
              Pts + Ast <span className="pill-tag" style={{ color: '#c084fc' }}>59.8% WR</span>
            </button>
            <button
              className={`props-pill ${category === 'POINTS' ? 'active-pts' : ''}`}
              onClick={() => setCategory('POINTS')}
            >
              Points
            </button>
          </div>
        </div>

        {/* Row 2: Direction, Search, Sort */}
        <div className="toolbar-row">
          <div className="pill-group">
            <span className="pill-label">Direction:</span>
            <button
              className={`props-pill ${direction === 'ALL' ? 'active' : ''}`}
              onClick={() => setDirection('ALL')}
            >
              All
            </button>
            <button
              className={`props-pill ${direction === 'OVER' ? 'active' : ''}`}
              onClick={() => setDirection('OVER')}
              style={{ color: direction === 'OVER' ? '#fff' : '#34d399' }}
            >
              ▲ OVER
            </button>
            <button
              className={`props-pill ${direction === 'UNDER' ? 'active' : ''}`}
              onClick={() => setDirection('UNDER')}
              style={{ color: direction === 'UNDER' ? '#fff' : '#818cf8' }}
            >
              ▼ UNDER
            </button>

            <span className="pill-label" style={{ marginLeft: '12px' }}>Tier:</span>
            <button
              className={`props-pill ${conviction === 'high' ? 'active' : ''}`}
              onClick={() => setConviction(conviction === 'high' ? 'all' : 'high')}
              style={{ border: conviction === 'high' ? '1px solid #f59e0b' : '' }}
            >
              ⚡ High Conviction (EV &ge; 10%)
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search player or team…"
              className="search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            <select
              className="sort-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="ev">Sort: Highest EV%</option>
              <option value="edge">Sort: Highest Edge%</option>
              <option value="win_prob">Sort: Win Probability</option>
              <option value="odds">Sort: Lowest Odds</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="props-table-container">
        <table className="props-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player & Matchup</th>
              <th>Prop</th>
              <th>Recommendation</th>
              <th>Model Proj</th>
              <th>Win Prob</th>
              <th>Edge / EV</th>
              <th>Market Odds</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  No player props match your active filter combination.
                </td>
              </tr>
            ) : (
              filteredList.map((p, idx) => {
                const diff = (p.projected_value - p.line).toFixed(1)
                const isOver = p.direction === 'OVER'
                const diffFormatted = diff > 0 ? `+${diff}` : diff

                return (
                  <tr key={`${p.player_id}-${p.prop_type}-${p.line}-${p.direction}-${idx}`}>
                    <td style={{ color: '#64748b', fontSize: '11px', width: '30px' }}>{idx + 1}</td>
                    
                    {/* Player & Matchup */}
                    <td>
                      <div className="player-cell">
                        <span className="player-name">{p.player}</span>
                        <span className="matchup-text">{p.game}</span>
                      </div>
                    </td>

                    {/* Prop Type Badge */}
                    <td>
                      {p.prop_type === 'REBOUNDS' && <span className="type-badge type-reb">REBOUNDS</span>}
                      {p.prop_type === 'POINTS_ASSISTS' && <span className="type-badge type-pa">PTS + AST</span>}
                      {p.prop_type === 'POINTS' && <span className="type-badge type-pts">POINTS</span>}
                    </td>

                    {/* Recommendation Badge */}
                    <td>
                      <span className={`pick-badge ${isOver ? 'pick-over' : 'pick-under'}`}>
                        {isOver ? '▲ OVER' : '▼ UNDER'} {p.line}
                      </span>
                    </td>

                    {/* Model Projection */}
                    <td>
                      <div className="proj-box">
                        <span className="proj-val">{p.projected_value}</span>
                        <span className={isOver ? (diff >= 0 ? 'proj-diff-pos' : 'proj-diff-neg') : (diff <= 0 ? 'proj-diff-pos' : 'proj-diff-neg')}>
                          ({diffFormatted})
                        </span>
                      </div>
                    </td>

                    {/* Win Probability & Bar */}
                    <td>
                      <div className="win-prob-wrapper">
                        <div className="win-prob-bar-bg">
                          <div
                            className={`win-prob-bar-fill ${p.win_probability >= 70 ? 'prob-high' : 'prob-med'}`}
                            style={{ width: `${Math.min(100, p.win_probability)}%` }}
                          />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '12px' }}>
                          {p.win_probability}%
                        </span>
                      </div>
                    </td>

                    {/* Edge & EV */}
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span className="edge-badge">+{p.edge_pct}%</span>
                        <span className="ev-badge">+{p.ev_pct}%</span>
                      </div>
                    </td>

                    {/* Odds & Bookmaker */}
                    <td>
                      <div>
                        <span className="odds-val">{p.odds.toFixed(2)}</span>
                        <span className="bm-tag">{p.bookmaker || 'Betano'}</span>
                      </div>
                    </td>

                    {/* Result */}
                    <td>
                      {p.won !== undefined ? (
                        <div>
                          {p.won ? (
                            <span className="res-won">✓ WON</span>
                          ) : p.push ? (
                            <span className="res-pending">PUSH</span>
                          ) : (
                            <span className="res-lost">✗ LOST</span>
                          )}
                          <div className="actual-stat">
                            Actual: {p.actual_value}
                          </div>
                        </div>
                      ) : (
                        <span className="res-pending">Pending</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
