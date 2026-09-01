import { useState } from 'react'

function tipFor(predicted_result) {
  if (predicted_result === 'HOME') return { label: '1', cls: 'home' }
  if (predicted_result === 'DRAW') return { label: 'X', cls: 'draw' }
  if (predicted_result === 'AWAY') return { label: '2', cls: 'away' }
  return { label: '?', cls: '' }
}

function decisionClass(decision) {
  if (decision === 'PLAY YES') return 'yes'
  if (decision === 'PLAY NO')  return 'no'
  if (decision === '[STRONG] PLAY NO') return 'strong-no'
  return 'pass'
}

function fmt(v, digits = 0) {
  if (v == null) return '—'
  return typeof v === 'number' ? v.toFixed(digits) : v
}

function kickoffTime(game, showUTC = true) {
  if (!game.kickoff) return '—'
  try { 
    // game.kickoff is format "YYYY-MM-DD HH:MM" in UTC (from API)
     return game.kickoff.split(' ')[1]
  }
  catch { return '—' }
}

// ─── Grade logic ─────────────────────────────────────────────
function outcomeGrade(game) {
  if (!game.actual_result) return null           // not graded yet
  return game.predicted_result === game.actual_result ? 'WIN' : 'LOSS'
}

function bttsGrade(game) {
  if (game.actual_btts == null) return null
  if (game.btts_decision === 'PLAY YES') return game.actual_btts ? 'WIN' : 'LOSS'
  if (game.btts_decision === 'PLAY NO' || game.btts_decision === '[STRONG] PLAY NO')  return game.actual_btts ? 'LOSS' : 'WIN'
  return null // PASS
}

function GradeIcon({ grade }) {
  if (grade === null)   return <span className="grade-pending" title="Pending">⏳</span>
  if (grade === 'WIN')  return <span className="grade-win"     title="Correct">✅</span>
  if (grade === 'LOSS') return <span className="grade-loss"    title="Wrong">❌</span>
  return null
}


export default function MatchRow({ game }) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('stats') // 'stats', 'h2h', 'standings'

  const tip    = tipFor(game.predicted_result)
  const dClass = decisionClass(game.btts_decision)
  const oGrade = outcomeGrade(game)
  const bGrade = bttsGrade(game)
  const isGraded = game.actual_result != null

  return (
    <>
      <div
        className={`match-row football ${open ? 'expanded' : ''} ${isGraded ? 'graded' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        {/* Time / Status */}
        <div className="match-time">
          {kickoffTime(game)}
          {isGraded ? (
            <div className="live-indicator" style={{ color: '#94a3b8', fontSize: 10, fontWeight: 800 }}>
              FT
            </div>
          ) : game.status && game.status !== 'NS' ? (
            <div className="live-indicator" style={{ color: game.status === 'FT' || game.status === 'PEN' || game.status === 'AET' ? '#94a3b8' : '#eab308', fontSize: 10, fontWeight: 800 }}>
              {game.status}
            </div>
          ) : null}
        </div>

        {/* Teams — stacked like basketball */}
        <div className="teams">
          <div className="team-row" style={{ display: 'flex', alignItems: 'center' }}>
            <span className="team-name home" title={game.home_team}>{game.home_team}</span>
            {isGraded && game.actual_home_goals !== undefined && (
              <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 13,
                color: game.actual_home_goals > game.actual_away_goals ? '#15803d' : '#64748b' }}>
                {game.actual_home_goals}
              </span>
            )}
          </div>
          <div className="team-row" style={{ display: 'flex', alignItems: 'center' }}>
            <span className="team-name away" title={game.away_team}>{game.away_team}</span>
            {isGraded && game.actual_away_goals !== undefined && (
              <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 13,
                color: game.actual_away_goals > game.actual_home_goals ? '#15803d' : '#64748b' }}>
                {game.actual_away_goals}
              </span>
            )}
          </div>
        </div>




        {/* 1X2 boxes */}
        <div className="stat-group match-1x2-col">
          <div className="stat-box home-win">{fmt(game.home_win_prob)}<sub>%</sub></div>
          <div className="stat-box draw-box">{fmt(game.draw_prob_1x2)}<sub>%</sub></div>
          <div className="stat-box away-win">{fmt(game.away_win_prob)}<sub>%</sub></div>
        </div>

        {/* BTTS box */}
        <div className="match-btts-col">
          <div className="btts-box">{fmt(game.btts_prob)}<sub>%</sub></div>
        </div>


        {/* Corners column — clean: number + YES/NO badge only */}
        {game.corners && (() => {
          const cc = game.corners.corner_call
          const ccPct = game.corners.corner_call_pct
          const ccLine = game.corners.corner_call_line || ''
          const callColor = cc === 'YES' ? '#4ade80' : cc === 'NO' ? '#f87171' : null
          const tooltip = `${game.corners.corner_recommendation} | ${ccLine}${ccPct ? ` (${ccPct}%)` : ''}`
          return (
            <div className="match-corners-col" title={tooltip} style={{textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:2}}>
              <span style={{fontSize:15,fontWeight:800,color:'#38bdf8'}}>{game.corners.exp_total_corners}</span>
              {cc && cc !== 'PASS' && callColor && (
                <span style={{
                  fontSize:9, fontWeight:800, color:callColor,
                  background: cc === 'YES' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                  borderRadius:3, padding:'1px 4px', lineHeight:1.4
                }}>
                  {cc} {ccPct}%
                </span>
              )}
            </div>
          )
        })()}

        {/* Bookings column — clean: number + YES/NO badge only */}
        {game.corners && (() => {
          const bc = game.corners.booking_call
          const bcPct = game.corners.booking_call_pct
          const bcLine = game.corners.booking_call_line || ''
          const bkColor = bc === 'YES' ? '#4ade80' : bc === 'NO' ? '#f87171' : null
          const tooltip = `${game.corners.booking_recommendation} | ${bcLine}${bcPct ? ` (${bcPct}%)` : ''}`
          return (
            <div className="match-booking-col" title={tooltip} style={{textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:2}}>
              <span style={{fontSize:15,fontWeight:800,color:'#fbbf24'}}>{game.corners.exp_total_booking_pts}</span>
              {bc && bc !== 'PASS' && bkColor && (
                <span style={{
                  fontSize:9, fontWeight:800, color:bkColor,
                  background: bc === 'YES' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                  borderRadius:3, padding:'1px 4px', lineHeight:1.4
                }}>
                  {bc} {bcPct}%
                </span>
              )}
            </div>
          )
        })()}

      </div>

      {/* Expanded detail */}
      {/* Expanded detail - Tabbed Match Center */}
      {open && (
        <div className="match-detail-container">
          <div className="tab-nav">
            <button 
              className={activeTab === 'stats' ? 'active' : ''} 
              onClick={(e) => { e.stopPropagation(); setActiveTab('stats') }}
            >
              TEAM STATS
            </button>
            <button 
              className={activeTab === 'h2h' ? 'active' : ''} 
              onClick={(e) => { e.stopPropagation(); setActiveTab('h2h') }}
            >
              LAST 5 H2H
            </button>
            <button 
              className={activeTab === 'standings' ? 'active' : ''} 
              onClick={(e) => { e.stopPropagation(); setActiveTab('standings') }}
            >
              STANDINGS
            </button>
            <button 
              className={activeTab === 'probabilities' ? 'active' : ''} 
              onClick={(e) => { e.stopPropagation(); setActiveTab('probabilities') }}
            >
              PROBABILITIES
            </button>
              <button 
                className={activeTab === 'props' ? 'active' : ''} 
                onClick={(e) => { e.stopPropagation(); setActiveTab('props') }}
              >
                PLAYER PROPS
              </button>
          </div>

          <div className="tab-content border-top">
            
            {/* STATS TAB */}
            {activeTab === 'stats' && (
              <div className="tab-stats">
                <div className="stats-header">
                  <span className="sh-team">{game.home_team}</span>
                  <span className="sh-title">TALE OF THE TAPE</span>
                  <span className="sh-team">{game.away_team}</span>
                </div>
                
                {(() => {
                  const m = game.match_center || {}
                  const sh = m.statsH || {}
                  const sa = m.statsA || {}
                  return (
                    <div className="stats-body">
                      <StatRow label="Matches Played" home={sh.played} away={sa.played} />
                      <StatRow label="Win %" home={sh.win_pct != null ? `${(sh.win_pct*100).toFixed(0)}%` : null} away={sa.win_pct != null ? `${(sa.win_pct*100).toFixed(0)}%` : null} />
                      <StatRow label="Goals Scored/Game" home={sh.scored} away={sa.scored} highlight="high" />
                      <StatRow label="Goals Cond/Game" home={sh.conceded} away={sa.conceded} highlight="low" />
                      <StatRow label="Clean Sheets" home={sh.clean_sheets} away={sa.clean_sheets} highlight="high" />
                      <StatRow label="Failed to Score" home={sh.failed_to_score} away={sa.failed_to_score} highlight="low" />
                      <StatRow label="BTTS Rate" home={sh.btts_rate != null ? `${(sh.btts_rate*100).toFixed(0)}%` : null} away={sa.btts_rate != null ? `${(sa.btts_rate*100).toFixed(0)}%` : null} />
                      <StatRow label="Recent Form" home={sh.form} away={sa.form} />
                      
                      {m.over_1_5_prob != null && (
                        <div className="poisson-banner">
                          <div className="pb-title">Poisson Match Probabilities</div>
                          <div className="pb-values">
                            <span>O1.5: <b>{m.over_1_5_prob}%</b></span>
                            <span>O2.5: <b>{m.over_2_5_prob}%</b></span>
                            <span>BTTS: <b className={game.btts_prob >= 50 ? 'high' : 'low'}>{fmt(game.btts_prob,1)}%</b></span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* H2H TAB */}
            {activeTab === 'h2h' && (
              <div className="tab-h2h">
                <div className="h2h-container">
                  {/* HEAD TO HEAD SECTION */}
                  <div className="h2h-block">
                    <div className="h2h-section-title">Head to Head</div>
                    {(() => {
                      const m = game.match_center || {}
                      if (!m.h2h || m.h2h.length === 0) return <div className="no-data">No recent H2H data available.</div>
                      return m.h2h.slice(0, 5).map((h, i) => {
                        const d = new Date(h.fixture.date)
                        const dStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        return (
                          <div key={i} className="h2h-row">
                            <div className="h2h-date">{dStr}</div>
                            <div className={`h2h-team ${h.teams.home.winner ? 'winner' : ''}`}>{h.teams.home.name}</div>
                            <div className="h2h-score">{h.goals.home ?? '-'} : {h.goals.away ?? '-'}</div>
                            <div className={`h2h-team right ${h.teams.away.winner ? 'winner' : ''}`}>{h.teams.away.name}</div>
                          </div>
                        )
                      })
                    })()}
                  </div>

                  {/* RECENT FORM SECTION */}
                  <div className="h2h-block">
                    <div className="h2h-section-title">Recent Form (Last 5)</div>
                    <div className="form-columns">
                      <RecentFormColumn teamName={game.home_team} fixtures={game.match_center?.recentH} />
                      <RecentFormColumn teamName={game.away_team} fixtures={game.match_center?.recentA} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STANDINGS TAB */}
            {activeTab === 'standings' && (
              <div className="tab-standings" style={{ maxWidth: '600px' }}>
                {(() => {
                  const m = game.match_center || {}
                  const sh = m.statsH || {}
                  const sa = m.statsA || {}
                  return (
                    <>
                      <div className="standings-cards">
                        <div className="s-card">
                          <div className="s-rank">{sh.rank ? `#${sh.rank}` : '-'}</div>
                          <div className="s-name">{game.home_team}</div>
                        </div>
                        <div className="s-vs">VS</div>
                        <div className="s-card">
                          <div className="s-rank">{sa.rank ? `#${sa.rank}` : '-'}</div>
                          <div className="s-name">{game.away_team}</div>
                        </div>
                      </div>

                      {m.full_standings && (
                        <div className="standings-table-container">
                          <table className="standings-table">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Team</th>
                                <th style={{textAlign:'center'}}>P</th>
                                <th style={{textAlign:'center'}}>GD</th>
                                <th style={{textAlign:'center'}}>Pts</th>
                                <th>Form</th>
                              </tr>
                            </thead>
                            <tbody>
                              {m.full_standings.map((s, idx) => {
                                const isHome = s.team.name === game.home_team
                                const isAway = s.team.name === game.away_team
                                return (
                                  <tr key={idx} className={isHome || isAway ? 'highlight' : ''}>
                                    <td className="st-rank">{s.rank}</td>
                                    <td className="st-team">
                                      <img src={s.team.logo} className="st-logo" alt="" />
                                      {s.team.name}
                                    </td>
                                    <td className="st-val">{s.all.played}</td>
                                    <td className="st-val">{s.goalsDiff}</td>
                                    <td className="st-val st-pts">{s.points}</td>
                                    <td>
                                      <div className="st-form">
                                        {(s.form || '').split('').map((f, fi) => (
                                          <div key={fi} className={`st-f fm-res ${f}`}>{f}</div>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}

            
              {/* PLAYER PROPS TAB */}
              {activeTab === 'props' && (
                <div className="tab-props" style={{padding: '16px'}}>
                    {/* Player Props Section */}
                    {(game.match_center?.player_props_H || game.match_center?.player_props_A) && (
                      <div className="prob-section">
                        <div className="ps-title">Player Props (Top Performers)</div>
                        
                        <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
                          
                          {/* Home Props */}
                          {game.match_center?.player_props_H?.topscorers?.slice(0,1).map(p => (
                            <div key={`h-goal-${p.id}`} className="prop-card">
                              <img src={p.photo} alt={p.name} className="prop-photo" />
                              <div className="prop-info">
                                <div className="prop-name">{p.name}</div>
                                <div className="prop-desc">To Score</div>
                                <div className="prop-stat">{p.goals} goals ({p.goals_per_game}/g)</div>
                              </div>
                            </div>
                          ))}
                          
                          {game.match_center?.player_props_H?.topscorers?.slice(0,1).map(p => (
                            <div key={`h-sot-${p.id}`} className="prop-card">
                              <img src={p.photo} alt={p.name} className="prop-photo" />
                              <div className="prop-info">
                                <div className="prop-name">{p.name}</div>
                                <div className="prop-desc">Shots on Target</div>
                                <div className="prop-stat">{p.shots_on} SOT ({p.shots_on_per_game}/g)</div>
                              </div>
                            </div>
                          ))}

                          {game.match_center?.player_props_H?.topyellows?.slice(0,1).map(p => (
                            <div key={`h-card-${p.id}`} className="prop-card">
                              <img src={p.photo} alt={p.name} className="prop-photo" />
                              <div className="prop-info">
                                <div className="prop-name">{p.name}</div>
                                <div className="prop-desc">To be Carded</div>
                                <div className="prop-stat">{p.yellows + p.reds} cards ({p.cards_per_game}/g)</div>
                              </div>
                            </div>
                          ))}

                          {/* Away Props */}
                          {game.match_center?.player_props_A?.topscorers?.slice(0,1).map(p => (
                            <div key={`a-goal-${p.id}`} className="prop-card">
                              <img src={p.photo} alt={p.name} className="prop-photo" />
                              <div className="prop-info">
                                <div className="prop-name">{p.name}</div>
                                <div className="prop-desc">To Score</div>
                                <div className="prop-stat">{p.goals} goals ({p.goals_per_game}/g)</div>
                              </div>
                            </div>
                          ))}
                          
                          {game.match_center?.player_props_A?.topscorers?.slice(0,1).map(p => (
                            <div key={`a-sot-${p.id}`} className="prop-card">
                              <img src={p.photo} alt={p.name} className="prop-photo" />
                              <div className="prop-info">
                                <div className="prop-name">{p.name}</div>
                                <div className="prop-desc">Shots on Target</div>
                                <div className="prop-stat">{p.shots_on} SOT ({p.shots_on_per_game}/g)</div>
                              </div>
                            </div>
                          ))}

                          {game.match_center?.player_props_A?.topyellows?.slice(0,1).map(p => (
                            <div key={`a-card-${p.id}`} className="prop-card">
                              <img src={p.photo} alt={p.name} className="prop-photo" />
                              <div className="prop-info">
                                <div className="prop-name">{p.name}</div>
                                <div className="prop-desc">To be Carded</div>
                                <div className="prop-stat">{p.yellows + p.reds} cards ({p.cards_per_game}/g)</div>
                              </div>
                            </div>
                          ))}
                          
                        </div>
                      </div>
                    )}
                </div>
              )}
{/* PROBABILITIES TAB */}
            {activeTab === 'probabilities' && (
              <div className="tab-probabilities">
                <div className="prob-grid">
                  {/* Match Outcome Section */}
                  <div className="prob-section full">
                    <div className="ps-title">Match Outcome (Poisson)</div>
                    <div className="prob-outcome-row">
                      <div className="po-box">
                        <span className="po-val">{fmt(game.home_win_prob)}%</span>
                        <span className="po-lbl">{game.home_team} (1)</span>
                      </div>
                      <div className="po-box">
                        <span className="po-val">{fmt(game.draw_prob_1x2)}%</span>
                        <span className="po-lbl">Draw (X)</span>
                      </div>
                      <div className="po-box">
                        <span className="po-val">{fmt(game.away_win_prob)}%</span>
                        <span className="po-lbl">{game.away_team} (2)</span>
                      </div>
                    </div>
                  </div>

                  {/* Goal Markets Section */}
                  <div className="prob-section">
                    <div className="ps-title">Goal Markets</div>
                    <ProbabilityItem 
                      label="Over 1.5 Goals" 
                      value={game.match_center?.over_1_5_prob} 
                      color="goals" 
                    />
                    <ProbabilityItem 
                      label="Over 2.5 Goals" 
                      value={game.match_center?.over_2_5_prob} 
                      color="goals" 
                    />
                    <div style={{marginTop: 12, fontSize: 10, color: '#94a3b8', fontStyle: 'italic'}}>
                      * Poisson Projections
                    </div>
                  </div>

                  {/* First Half Markets Section */}
                    <div className="prob-section">
                      <div className="ps-title">First Half Markets</div>
                      
                      <div className="poisson-outcomes" style={{marginBottom: 16}}>
                        <div className="po-box">
                          <span className="po-val">{game.match_center?.fh_1x2_home ? `${game.match_center.fh_1x2_home}%` : '-'}</span>
                          <span className="po-lbl">HOME (1)</span>
                        </div>
                        <div className="po-box">
                          <span className="po-val">{game.match_center?.fh_1x2_draw ? `${game.match_center.fh_1x2_draw}%` : '-'}</span>
                          <span className="po-lbl">DRAW (X)</span>
                        </div>
                        <div className="po-box">
                          <span className="po-val">{game.match_center?.fh_1x2_away ? `${game.match_center.fh_1x2_away}%` : '-'}</span>
                          <span className="po-lbl">AWAY (2)</span>
                        </div>
                      </div>

                      <ProbabilityItem 
                        label="FH Over 0.5 Goals" 
                        value={game.match_center?.fh_over_0_5_prob} 
                        color="goals" 
                      />
                      <ProbabilityItem 
                        label="FH Over 1.5 Goals" 
                        value={game.match_center?.fh_over_1_5_prob} 
                        color="goals" 
                      />
                      <div style={{marginTop: 12, fontSize: 10, color: '#94a3b8', fontStyle: 'italic'}}>
                        * First Half Poisson Projections
                      </div>
                    </div>

                    {/* BTTS Section */}
                  <div className="prob-section">
                    <div className="ps-title">Both Teams to Score</div>
                    <ProbabilityItem 
                      label="BTTS: Yes" 
                      value={game.btts_prob} 
                      color="btts" 
                    />
                    <div style={{marginTop: 16, fontSize: 10, color: '#94a3b8'}}>
                      Confidence: {game.btts_decision?.includes('STRONG') ? 'HIGH' : 'MEDIUM'}
                    </div>
                  </div>

                  {/* Market Odds */}
                  {game.market_odds && (
                    <div className="prob-section">
                      <div className="ps-title">Bookmaker Odds</div>
                      <div className="market-odds-row">
                        <div className="mo-box"><span className="mo-val">{game.market_odds.home}</span><span className="mo-lbl">Home</span></div>
                        <div className="mo-box"><span className="mo-val">{game.market_odds.draw}</span><span className="mo-lbl">Draw</span></div>
                        <div className="mo-box"><span className="mo-val">{game.market_odds.away}</span><span className="mo-lbl">Away</span></div>
                        <div className="mo-box"><span className="mo-val">{game.market_odds.btts_yes}</span><span className="mo-lbl">BTTS Y</span></div>
                        <div className="mo-box"><span className="mo-val">{game.market_odds.over25}</span><span className="mo-lbl">O2.5</span></div>
                      </div>
                    </div>
                  )}

                  {/* API Consensus */}
                  {game.api_consensus && (
                    <div className="prob-section">
                      <div className="ps-title">Bookmaker Consensus</div>
                      <div style={{fontSize: 11, color: '#94a3b8', marginBottom: 8}}>{game.api_consensus.advice}</div>
                      <div className="market-odds-row">
                        <div className="mo-box"><span className="mo-val" style={{color:'#38bdf8'}}>{game.api_consensus.home_pct}</span><span className="mo-lbl">Home %</span></div>
                        <div className="mo-box"><span className="mo-val" style={{color:'#94a3b8'}}>{game.api_consensus.draw_pct}</span><span className="mo-lbl">Draw %</span></div>
                        <div className="mo-box"><span className="mo-val" style={{color:'#f472b6'}}>{game.api_consensus.away_pct}</span><span className="mo-lbl">Away %</span></div>
                      </div>
                    </div>
                  )}

                  {/* Injuries */}
                  {((game.home_injuries?.length > 0) || (game.away_injuries?.length > 0)) && (
                    <div className="prob-section full">
                      <div className="ps-title">Injury Report</div>
                      <div style={{display:'flex', gap:16, flexWrap:'wrap', marginTop:8}}>
                        {game.home_injuries?.length > 0 && (
                          <div>
                            <div style={{fontSize:10,fontWeight:700,color:'#38bdf8',marginBottom:4,textTransform:'uppercase'}}>{game.home_team}</div>
                            {game.home_injuries.map((inj, i) => (
                              <div key={i} style={{fontSize:11,color:'#fca5a5',padding:'2px 0'}}>{inj}</div>
                            ))}
                          </div>
                        )}
                        {game.away_injuries?.length > 0 && (
                          <div>
                            <div style={{fontSize:10,fontWeight:700,color:'#f472b6',marginBottom:4,textTransform:'uppercase'}}>{game.away_team}</div>
                            {game.away_injuries.map((inj, i) => (
                              <div key={i} style={{fontSize:11,color:'#fca5a5',padding:'2px 0'}}>{inj}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Corners & Booking Detail */}
                  {game.corners && (
                    <div className="prob-section">
                      <div className="ps-title">Corners & Booking</div>
                      <ProbabilityItem
                        label={game.corners.corner_call_line
                          ? `Corners: Exp ${game.corners.exp_total_corners} (${game.corners.corner_call_line})`
                          : `Exp. Corners: ${game.corners.exp_total_corners}`}
                        value={game.corners.corner_call_pct ?? game.corners.over_9_5_pct}
                        color="btts"
                      />
                      <ProbabilityItem
                        label={`Over 10.5 Corners`}
                        value={game.corners.over_10_5_pct}
                        color="away"
                      />
                      <ProbabilityItem
                        label={game.corners.booking_call_line 
                          ? `Booking: Exp ${game.corners.exp_total_booking_pts}pts (Line: ${game.corners.booking_call_line})`
                          : `Booking Pts: ${game.corners.exp_total_booking_pts}`}
                        value={Math.min(100, Math.round((game.corners.exp_total_booking_pts / 120) * 100))}
                        color="home"
                      />
                      {/* YES/NO/PASS Call Badges */}
                      <div style={{marginTop:12, display:'flex', gap:8, flexWrap:'wrap'}}>
                        {game.corners.corner_call && (() => {
                          const cc = game.corners.corner_call
                          const ccLine = game.corners.corner_call_line
                          const ccPct  = game.corners.corner_call_pct
                          const bg = cc === 'YES' ? 'rgba(74,222,128,0.15)' : cc === 'NO' ? 'rgba(248,113,113,0.15)' : 'rgba(148,163,184,0.1)'
                          const border = cc === 'YES' ? '#4ade80' : cc === 'NO' ? '#f87171' : '#64748b'
                          const txt = cc === 'YES' ? '#4ade80' : cc === 'NO' ? '#f87171' : '#94a3b8'
                          if (cc === 'PASS') return <span style={{fontSize:10,color:'#64748b'}}>Corners: PASS</span>
                          return (
                            <div style={{background:bg, border:`1px solid ${border}`, borderRadius:6, padding:'4px 8px', fontSize:10}}>
                              <span style={{color:'#94a3b8'}}>Corners </span>
                              <span style={{color:txt, fontWeight:700}}>{cc} {ccLine} ({ccPct}%)</span>
                            </div>
                          )
                        })()}
                        {game.corners.booking_call && (() => {
                          const bc = game.corners.booking_call
                          const bcLine = game.corners.booking_call_line
                          const bcPct  = game.corners.booking_call_pct
                          const bg = bc === 'YES' ? 'rgba(74,222,128,0.15)' : bc === 'NO' ? 'rgba(248,113,113,0.15)' : 'rgba(148,163,184,0.1)'
                          const border = bc === 'YES' ? '#4ade80' : bc === 'NO' ? '#f87171' : '#64748b'
                          const txt = bc === 'YES' ? '#4ade80' : bc === 'NO' ? '#f87171' : '#94a3b8'
                          if (bc === 'PASS') return <span style={{fontSize:10,color:'#64748b'}}>Booking: PASS</span>
                          return (
                            <div style={{background:bg, border:`1px solid ${border}`, borderRadius:6, padding:'4px 8px', fontSize:10}}>
                              <span style={{color:'#94a3b8'}}>Booking </span>
                              <span style={{color:txt, fontWeight:700}}>{bc} {bcLine} ({bcPct}%)</span>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
          
          {/* Legacy Graded Detail Wrapper at bottom if needed */}
          {isGraded && (
             <div className="graded-footer">
               <span><b>Final:</b> {game.actual_home_goals} - {game.actual_away_goals}</span>
               <span style={{ marginLeft: 16 }}><b>1X2:</b> {game.actual_result} {oGrade === 'WIN' ? '✅' : '❌'}</span>
               <span style={{ marginLeft: 16 }}><b>BTTS:</b> {game.actual_btts ? 'Yes' : 'No'} {bGrade === 'WIN' ? '✅' : bGrade === 'LOSS' ? '❌' : '➖'}</span>
               {game.accuracy_tier && (
                 <span style={{ marginLeft: 16 }}>
                   <b>xG Grade:</b> {game.accuracy_tier} <span style={{ fontSize: '0.85em', opacity: 0.8 }}>(Δ {game.total_delta})</span>
                 </span>
               )}
             </div>
          )}
        </div>
      )}
    </>
  )
}

function StatRow({ label, home, away, highlight }) {
  const hVal = parseFloat(home)
  const aVal = parseFloat(away)
  
  let hCls = 'sr-val'
  let aCls = 'sr-val'

  if (!isNaN(hVal) && !isNaN(aVal)) {
    if (highlight === 'high') {
      if (hVal > aVal) hCls += ' better'
      else if (aVal > hVal) aCls += ' better'
    } else if (highlight === 'low') {
      if (hVal < aVal) hCls += ' better'
      else if (aVal < hVal) aCls += ' better'
    }
  }

  return (
    <div className="stat-row">
      <div className={hCls}>{home ?? '-'}</div>
      <div className="sr-label">{label}</div>
      <div className={aCls} style={{ textAlign: 'right' }}>{away ?? '-'}</div>
    </div>
  )
}

function RecentFormColumn({ teamName, fixtures }) {
  if (!fixtures || fixtures.length === 0) return (
    <div className="form-column">
      <div style={{fontSize: 10, fontStyle: 'italic', color: '#94a3b8', marginBottom: 6}}>{teamName}</div>
      <div className="no-data" style={{padding: '10px 0'}}>No recent form.</div>
    </div>
  )

  const getResult = (f) => {
    const isHome = f.teams.home.name === teamName
    if (f.teams.home.winner === null && f.teams.away.winner === null) return 'D'
    return isHome 
      ? (f.teams.home.winner ? 'W' : 'L')
      : (f.teams.away.winner ? 'W' : 'L')
  }

  return (
    <div className="form-column">
      <div style={{fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase'}}>{teamName}</div>
      {fixtures.map((f, i) => {
        const isHome = f.teams.home.name === teamName
        const opp = isHome ? f.teams.away.name : f.teams.home.name
        const res = getResult(f)
        
        return (
          <div key={i} className="form-match">
            <div className={`fm-res ${res}`}>{res}</div>
            <div className="fm-opp" title={opp}>{opp}</div>
            <div className="fm-score">{f.goals.home}-{f.goals.away}</div>
          </div>
        )
      })}
    </div>
  )
}
function ProbabilityItem({ label, value, color }) {
  const val = parseFloat(value) || 0
  return (
    <div className="prob-item">
      <div className="pi-label-row">
        <span>{label}</span>
        <span>{fmt(val, 1)}%</span>
      </div>
      <div className="pi-bar-bg">
        <div 
          className={`pi-bar-fill ${color}`} 
          style={{ width: `${val}%` }}
        ></div>
      </div>
    </div>
  )
}

