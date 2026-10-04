import { useState } from 'react'

function fmt(v, digits = 0) {
  if (v == null || v === '-') return '—'
  return typeof v === 'number' ? v.toFixed(digits) : v
}

function normalizeTeam(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isMatch(t1, t2) {
  const n1 = normalizeTeam(t1)
  const n2 = normalizeTeam(t2)
  if (!n1 || !n2) return false
  if (n1 === n2) return true
  if (n1.includes(n2) || n2.includes(n1)) return true
  
  const stopWords = new Set(['the', 'club', 'team', 'basket', 'basketball', 'bc', 'kc', 'kk', 'sk', 'fc'])
  const words1 = n1.split(' ').filter(w => w.length >= 3 && !stopWords.has(w))
  const words2 = n2.split(' ').filter(w => w.length >= 3 && !stopWords.has(w))
  
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1 === w2) return true
      if (w1.length >= 5 && w2.length >= 5) {
        if (w1.startsWith(w2) || w2.startsWith(w1)) return true
      }
    }
  }
  return false
}

const FINISHED_STATUSES = new Set([
  'FT', 'FINISHED', 'GAME FINISHED', 'AFTER OVERTIME',
  'AFTER PENALTIES', 'AOT', 'AP'
])
function isFinishedStatus(s) {
  return s && FINISHED_STATUSES.has(s.trim().toUpperCase())
}

// All known API-basketball statuses → 2-char abbreviations
function formatStatus(s) {
  if (!s) return s
  const upper = s.trim().toUpperCase()
  // Pre-game
  if (upper === 'NOT STARTED' || upper === 'SCHEDULED') return 'NS'
  // Abandoned / special
  if (upper.includes('POSTPONED'))   return 'PP'
  if (upper.includes('CANCEL'))      return 'CN'
  if (upper.includes('SUSPEND'))     return 'SU'
  if (upper.includes('ABANDON'))     return 'AB'
  if (upper.includes('INTERRUPT'))   return 'IN'
  if (upper.includes('TECHNICAL'))   return 'TL'
  if (upper.includes('WALKOVER') || upper.includes('WALK OVER')) return 'WO'
  if (upper.includes('FORFEIT'))     return 'FF'
  if (upper.includes('AWARDED'))     return 'AW'
  // In-progress
  if (upper === 'HALFTIME' || upper === 'HALF TIME' || upper === 'HT') return 'HT'
  if (upper.startsWith('QUARTER 1') || upper === 'Q1') return 'Q1'
  if (upper.startsWith('QUARTER 2') || upper === 'Q2') return 'Q2'
  if (upper.startsWith('QUARTER 3') || upper === 'Q3') return 'Q3'
  if (upper.startsWith('QUARTER 4') || upper === 'Q4') return 'Q4'
  if (upper.startsWith('OVERTIME')  || upper === 'OT') return 'OT'
  if (upper === 'BREAK TIME')        return 'BT'
  // Finished
  if (upper === 'FINISHED' || upper === 'GAME FINISHED' || upper === 'FT') return 'FT'
  if (upper === 'AFTER OVERTIME'  || upper === 'AOT') return 'AO'
  if (upper === 'AFTER PENALTIES' || upper === 'AP')  return 'AP'
  // Fallback: truncate to 2 chars
  return s.trim().substring(0, 2).toUpperCase()
}

export default function BasketballRow({ game: consolidatedGame, leagueHasAdv = false, teamLeaderboard = {} }) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('stats')

  // ── Pull top-level match info synced from App.jsx ──
  const {
    home_team,
    away_team,
    time = '',
    status: topStatus,
    actual_home_score: topHomeScore,
    actual_away_score: topAwayScore,
    actual_result: topResult,
    predictions = {}
  } = consolidatedGame

  // ── ADV is primary; SRS is secondary (flag only) ──
  const primary   = predictions.adv || predictions.srs || {}
  const secondary = predictions.adv ? predictions.srs : null   // only show SRS flag when ADV present

  const {
    predicted_result = '',
    probs_1x2 = {},
    xpts_h = 0,
    xpts_a = 0,
    model_total = 0,
    market_total,
    edge,
    decision = 'MODEL ONLY',
    model_architecture = '[  SRS   ]',
    match_center = {},
    actual_home_score: primaryHomeScore,
    actual_away_score: primaryAwayScore,
    actual_result:     primaryResult,
    accuracy_tier,
    total_delta,
    home_team_volatility,
    away_team_volatility,
  } = primary

  // Use top-level synced values first, fallback to primary model values
  const finalStatus    = topStatus    || primary.status
  const finalHomeScore = topHomeScore !== undefined ? topHomeScore : primaryHomeScore
  const finalAwayScore = topAwayScore !== undefined ? topAwayScore : primaryAwayScore
  const finalResult    = topResult    || primaryResult

  const isAdvanced = model_architecture?.includes('ADVANCED')
  const hasSRSFlag = !!secondary && isAdvanced

  // Clash Indicator logic (207-game audit: 65.2% historical Under rate)
  const isClash = Boolean(primary.is_clash || secondary?.is_clash)
  const clashTrigger = primary.clash_trigger || secondary?.clash_trigger || 'CLASH'
  const isSharpOver = clashTrigger === 'SHARP OVER'

  const isShootout = Boolean(primary.is_shootout || secondary?.is_shootout)
  const shootoutTrigger = primary.shootout_trigger || secondary?.shootout_trigger || 'SHOOTOUT'
  const isSharpShootout = shootoutTrigger === 'SHARP SHOOTOUT'

  const { statsH = {}, statsA = {}, h2h = [], recentH = [], recentA = [], full_standings = [] } = match_center
  
  const gameStageRaw = consolidatedGame.stage || primary.stage || ''
  // Strip out league prefixes (e.g., 'BLNO - Semi-finals' -> 'Semi-finals')
  const gameStage = gameStageRaw.includes(' - ') ? gameStageRaw.split(' - ').pop().trim() : gameStageRaw
  const lowerStage = gameStageRaw.toLowerCase()
  const showStageBadge = gameStageRaw && (lowerStage.includes('final') || lowerStage.includes('place') || lowerStage.includes('playoff') || lowerStage.includes('championship'))

  const tip      = predicted_result === 'HOME' ? '1' : '2'
  const isGraded = finalResult != null
  const isWin    = isGraded && predicted_result === finalResult

  // Badge display rules:
  // - FT / graded games → never show badge (already done via isGraded/isFinishedStatus)
  // - Not Started, ADV primary → hide badge (clean; it's expected)
  // - Not Started, SRS but leagueHasAdv=true → show SRS warning (fallback, team missing from ADV)
  // - Not Started, SRS and leagueHasAdv=false → hide badge (expected, SRS-only league)
  const isFinished = isGraded || isFinishedStatus(finalStatus) || finalHomeScore !== undefined
  const isSRSFallback = !isAdvanced && leagueHasAdv   // ADV league but this game used SRS
  const showBadge = !isFinished && isSRSFallback

  const isHomeStable = home_team_volatility != null && home_team_volatility <= 16.6
  const isAwayStable = away_team_volatility != null && away_team_volatility <= 16.6
  
  const getStabilityColor = (volatility) => {
    if (volatility == null) return 'inherit';
    if (volatility < 14.8) return '#10b981'; // Elite (Emerald)
    if (volatility <= 16.6) return '#38bdf8'; // Good/Stable (Sky Blue)
    return 'inherit';
  }
  
  const getStabilityTitle = (volatility) => {
    if (volatility == null) return '';
    if (volatility < 14.8) return `Elite Reliable (Volatility: ${volatility.toFixed(1)})`;
    if (volatility <= 16.6) return `Stable (Volatility: ${volatility.toFixed(1)})`;
    return '';
  }

  return (
    <>
      <div
        className={`match-row basketball ${open ? 'expanded' : ''}`}
        onClick={() => setOpen(!open)}
      >
        {/* TIME / STATUS COLUMN — same visual style as football HH:MM */}
        <div className="match-time">
          {/* kickoff_time stored as "18:30" (HH:MM). If present, show it; else show status text */}
          {time?.includes(':') ? (
            time.includes(' ') ? time.split(' ')[1] : time
          ) : (
            isFinishedStatus(finalStatus) ? 'FT'
            : formatStatus(finalStatus) || 'NS'
          )}
          {/* FT badge below kickoff time (like football graded rows) */}
          {time?.includes(':') && isFinishedStatus(finalStatus) && (
            <div className="live-indicator" style={{ color: '#94a3b8', fontSize: 10, fontWeight: 800 }}>FT</div>
          )}
          {time?.includes(':') && finalStatus && !isFinishedStatus(finalStatus) &&
           finalStatus !== 'Scheduled' && finalStatus !== 'Not Started' && (
            <div className="live-indicator" style={{ color: '#eab308', fontSize: 10, fontWeight: 800 }}>
              {formatStatus(finalStatus)}
            </div>
          )}
          {showBadge && (
            <div style={{
              marginTop: 2,
              fontSize: 7,
              fontWeight: 800,
              padding: '1px 2px',
              borderRadius: 2,
              display: 'inline-block',
              background: '#dc2626',
              color: '#fff',
              opacity: 0.9,
              textAlign: 'center',
              lineHeight: 1,
              title: 'ADV data missing for this team — using SRS fallback',
            }}>
              SRS ⚠
            </div>
          )}
        </div>

        {/* TEAMS COLUMN */}
        <div className="teams">
          <div className="team-row" style={{ display: 'flex', alignItems: 'center' }}>
            <span className="team-name" title={getStabilityTitle(home_team_volatility)} style={{ 
              fontWeight: (isGraded && finalHomeScore > finalAwayScore) ? 700 : 400,
              color: getStabilityColor(home_team_volatility),
              flex: 'initial',
              textAlign: 'left',
              marginRight: 6,
              cursor: isHomeStable ? 'help' : 'inherit'
            }}>
              {home_team}
            </span>
            {finalHomeScore !== undefined && (
              <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 13, color: (isGraded && finalHomeScore > finalAwayScore) ? '#15803d' : '#64748b' }}>
                {finalHomeScore}
              </span>
            )}
          </div>
          <div className="team-row" style={{ display: 'flex', alignItems: 'center' }}>
            <span className="team-name" title={getStabilityTitle(away_team_volatility)} style={{ 
              fontWeight: (isGraded && finalAwayScore > finalHomeScore) ? 700 : 400,
              color: getStabilityColor(away_team_volatility),
              flex: 'initial',
              textAlign: 'left',
              marginRight: 6,
              cursor: isAwayStable ? 'help' : 'inherit'
            }}>
              {away_team}
            </span>
            {finalAwayScore !== undefined && (
              <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 13, color: (isGraded && finalAwayScore > finalHomeScore) ? '#15803d' : '#64748b' }}>
                {finalAwayScore}
              </span>
            )}
          </div>
          {isClash && (
            <div style={{ marginTop: 2, display: 'flex', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '11px',
                  lineHeight: 1,
                  cursor: 'help'
                }}
                title={`Clash Profile (${clashTrigger}): 207-game audit confirms ${isSharpOver ? '67.4%' : '65.2%'} historical Under rate (avg -5.6 pts)`}
              >
                ⚠️
              </span>
            </div>
          )}
          {isShootout && (
            <div style={{ marginTop: 2, display: 'flex', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '11px',
                  lineHeight: 1,
                  cursor: 'help'
                }}
                title={`Shootout Profile (${shootoutTrigger}): Empirical audit confirms 61.1% Over model (+11.9 pts) and 77.8% Over market line`}
              >
                🔥
              </span>
            </div>
          )}
        </div>



        {/* 12 COLUMN */}
        <div className="stat-col center match-12-col">
          <div className="prob-box-1x2">
            <div className="p-item h" style={{ width: '38px' }}>{probs_1x2.home ? Math.round(probs_1x2.home) : 0}%</div>
            <div className="p-item a" style={{ width: '38px' }}>{probs_1x2.away ? Math.round(probs_1x2.away) : 0}%</div>
          </div>
        </div>

        {/* MODEL COLUMN — ADV total + optional SRS flag below */}
        <div className="stat-col center match-model-col">
          <div className={`bball-model-box ${decision === 'PLAY OVER' ? 'over' : decision === 'PLAY UNDER' ? 'under' : ''}`} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1 }}>
            <span style={{ fontSize: hasSRSFlag ? '0.9em' : 'inherit', marginTop: hasSRSFlag ? 1 : 0 }}>
              {model_total > 0 ? model_total.toFixed(1) : '—'}
            </span>
            {hasSRSFlag && (
              <span style={{ fontSize: 7, fontWeight: 800, marginTop: 2, opacity: 0.85 }}>
                SRS {secondary.model_total?.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* xPTS COLUMN */}
        <div className="stat-col center match-xpts match-xpts-col">
          <div className="bball-xpts-box" style={{ flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '4px 12px' }}>
            <span style={{ fontWeight: tip === '1' ? 800 : 500, opacity: tip === '1' ? 1 : 0.7 }}>
              {xpts_h.toFixed(1)}
            </span>
            <span style={{ fontWeight: tip === '2' ? 800 : 500, opacity: tip === '2' ? 1 : 0.7 }}>
              {xpts_a.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {open && (
        <div className="match-detail-container bball-details">
          <div className="tab-nav">
            <button className={activeTab === 'stats' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setActiveTab('stats') }}>TEAM STATS</button>
            <button className={activeTab === 'h2h' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setActiveTab('h2h') }}>LAST 5 H2H</button>
            <button className={activeTab === 'standings' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setActiveTab('standings') }}>STANDINGS</button>
            <button className={activeTab === 'probabilities' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setActiveTab('probabilities') }}>PROBABILITIES</button>
          </div>

          <div className="tab-content border-top">
            {activeTab === 'stats' && (
              <div className="tab-stats">
                <div className="stats-header">
                  <span className="sh-team">{home_team}</span>
                  <span className="sh-title">BY THE NUMBERS</span>
                  <span className="sh-team">{away_team}</span>
                </div>
                {gameStageRaw && (
                  <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#3b82f6', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {gameStageRaw}
                  </div>
                )}
                <div className="stats-body">
                  <StatRow label="Matches Played" home={statsH.played} away={statsA.played} />
                  <StatRow label="Win %" home={statsH.win_pct ? `${(statsH.win_pct * 100).toFixed(0)}%` : '-'} away={statsA.win_pct ? `${(statsA.win_pct * 100).toFixed(0)}%` : '-'} />
                  <StatRow label="Pts/Game (Model)" home={statsH.scored} away={statsA.scored} highlight="high" />
                  <StatRow label="Pts Allowed (Model)" home={statsH.conceded} away={statsA.conceded} highlight="low" />
                  <StatRow label="Scoring Volatility" home={home_team_volatility != null ? home_team_volatility.toFixed(1) : '-'} away={away_team_volatility != null ? away_team_volatility.toFixed(1) : '-'} highlight="low" />
                  {(() => {
                    const hStat = teamLeaderboard?.find(t => t.name === home_team);
                    const aStat = teamLeaderboard?.find(t => t.name === away_team);
                    const hMae = isAdvanced ? (hStat?.adv?.mae ?? hStat?.srs?.mae) : hStat?.srs?.mae;
                    const aMae = isAdvanced ? (aStat?.adv?.mae ?? aStat?.srs?.mae) : aStat?.srs?.mae;
                    const hDelta = isAdvanced ? (hStat?.adv?.avg_signed_delta ?? hStat?.srs?.avg_signed_delta) : hStat?.srs?.avg_signed_delta;
                    const aDelta = isAdvanced ? (aStat?.adv?.avg_signed_delta ?? aStat?.srs?.avg_signed_delta) : aStat?.srs?.avg_signed_delta;
                    
                    return (
                      <>
                        {(hMae != null || aMae != null) && (
                          <StatRow label="Team MAE" home={hMae != null ? hMae.toFixed(1) : '-'} away={aMae != null ? aMae.toFixed(1) : '-'} highlight="low" />
                        )}
                        {(hDelta != null || aDelta != null) && (
                          <StatRow label="Team ±Δ (Bias)" home={hDelta != null ? (hDelta > 0 ? `+${hDelta.toFixed(1)}` : hDelta.toFixed(1)) : '-'} away={aDelta != null ? (aDelta > 0 ? `+${aDelta.toFixed(1)}` : aDelta.toFixed(1)) : '-'} />
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {activeTab === 'h2h' && (
              <div className="tab-h2h">
                <div className="h2h-container">
                  <div className="h2h-block">
                    <div className="h2h-section-title">Head to Head</div>
                    {h2h.length === 0 ? <div className="no-data">No recent H2H data.</div> : (
                      h2h.slice(0, 5).map((h, i) => (
                        <div key={i} className="h2h-row">
                          <div className="h2h-date">{h.date?.split('T')[0]}</div>
                          <div className="h2h-team">{h.teams.home.name}</div>
                          <div className="h2h-score">{h.scores.home.total} : {h.scores.away.total}</div>
                          <div className="h2h-team right">{h.teams.away.name}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="h2h-block">
                    <div className="h2h-section-title">Recent Form</div>
                    <div className="form-columns">
                      <RecentFormColumn teamName={home_team} fixtures={recentH} />
                      <RecentFormColumn teamName={away_team} fixtures={recentA} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'standings' && (
              <div className="tab-standings" style={{ maxWidth: '600px', margin: '0 auto' }}>
                {(() => {
                  let hRank = '-'
                  let aRank = '-'
                  for (const group of full_standings) {
                    for (const st of group) {
                      if (isMatch(st.team.name, home_team)) hRank = `#${st.position}`
                      if (isMatch(st.team.name, away_team)) aRank = `#${st.position}`
                    }
                  }
                  return (
                    <div className="standings-cards" style={{ marginBottom: 20 }}>
                      <div className="s-card">
                        <div className="s-rank">{hRank}</div>
                        <div className="s-name">{home_team}</div>
                      </div>
                      <div className="s-vs">VS</div>
                      <div className="s-card">
                        <div className="s-rank">{aRank}</div>
                        <div className="s-name">{away_team}</div>
                      </div>
                    </div>
                  )
                })()}

                <div className="standings-table-container">
                  {full_standings.length === 0 ? <div className="no-data">League offline standings not available.</div> : (
                    full_standings.map((group, gIdx) => (
                      <div key={gIdx} className="standings-group">
                        {group[0]?.group?.name && <div className="group-name">{group[0].group.name}</div>}
                        <table className="standings-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Team</th>
                              <th style={{textAlign:'center'}}>P</th>
                              <th style={{textAlign:'center'}}>W</th>
                              <th style={{textAlign:'center'}}>L</th>
                              <th style={{textAlign:'center'}}>%</th>
                              <th style={{textAlign:'center'}}>Pts</th>
                              <th>Form</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.map((st, i) => {
                              const isTargetHome = isMatch(st.team.name, home_team)
                              const isTargetAway = isMatch(st.team.name, away_team)
                              return (
                                <tr key={i} className={isTargetHome || isTargetAway ? 'highlight' : ''}>
                                  <td className="st-rank">{st.position}</td>
                                  <td className="st-team">
                                    {st.team.logo && <img src={st.team.logo} className="st-logo" alt="" style={{width:16,height:16,marginRight:6,verticalAlign:'middle'}} />}
                                    {st.team.name}
                                  </td>
                                  <td className="st-val">{st.games.played}</td>
                                  <td className="st-val">{st.games.win.total}</td>
                                  <td className="st-val">{st.games.lose.total}</td>
                                  <td className="st-val">{st.games.win.percentage}</td>
                                  <td className="st-val st-pts">{st.points.for}-{st.points.against}</td>
                                  <td>
                                    <div className="st-form" style={{display:'flex',gap:2,justifyContent:'flex-end'}}>
                                      {(st.form || '').split('').map((f, fi) => (
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
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'probabilities' && (
              <div className="tab-probabilities">
                <div className="prob-grid">
                  <div className="prob-section full">
                    <div className="ps-title">Edge Analysis</div>
                    <div className="prob-outcome-row">
                      <div className="po-box">
                        <span className="po-val">{model_total.toFixed(1)}</span>
                        <span className="po-lbl">Model Projection</span>
                      </div>
                      <div className="po-box">
                        <span className="po-val">{market_total ? market_total.toFixed(1) : '—'}</span>
                        <span className="po-lbl">Market Line</span>
                      </div>
                      <div className="po-box">
                        <span className={`po-val ${edge > 0 ? 'better' : ''}`}>{fmt(edge, 1)}</span>
                        <span className="po-lbl">Calculated Edge</span>
                      </div>
                    </div>

                    {isClash && (
                      <div style={{
                        marginTop: '16px',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        background: isSharpOver 
                          ? 'linear-gradient(135deg, rgba(234, 88, 12, 0.15) 0%, rgba(15, 23, 42, 0.7) 100%)' 
                          : 'linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(15, 23, 42, 0.7) 100%)',
                        borderLeft: `4px solid ${isSharpOver ? '#ea580c' : '#eab308'}`,
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        borderRight: '1px solid rgba(255,255,255,0.08)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        color: '#f8fafc',
                        fontSize: '11.5px',
                        lineHeight: '1.5',
                        textAlign: 'left'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', fontWeight: 800, color: isSharpOver ? '#fb923c' : '#facc15', letterSpacing: '0.04em', fontSize: '12px' }}>
                            <span style={{ marginRight: 6, fontSize: '13px' }}>
                              {isSharpOver ? '⚡' : '⚠️'}
                            </span>
                            {isSharpOver ? 'CLASH OF THE INEFFICIENT (SHARP OVER)' : 'CLASH OF THE INEFFICIENT'}
                          </div>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(34, 197, 94, 0.16)',
                            border: '1px solid rgba(34, 197, 94, 0.4)',
                            color: '#4ade80',
                            fontWeight: 800,
                            fontSize: '10.5px',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            letterSpacing: '0.03em'
                          }}>
                            <span>🔻</span>
                            <span>SIGNAL: BET UNDER ({isSharpOver ? '67.4%' : '65.2%'} HIT)</span>
                          </div>
                        </div>

                        {/* Audit Stat Cards */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                          gap: '8px',
                          margin: '8px 0 10px 0',
                          padding: '8px 10px',
                          background: 'rgba(0,0,0,0.25)',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                          <div>
                            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>Audit Sample</div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#f1f5f9' }}>207 Graded</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>Historical Under</div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#4ade80' }}>
                              {isSharpOver ? '67.4% Under' : '65.2% Under'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>Avg Score Delta</div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8' }}>−5.6 pts</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>Model Bias</div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#f59e0b' }}>Overshoots Total</div>
                          </div>
                        </div>

                        {isSharpOver ? (
                          <div style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.45' }}>
                            Both teams feature inefficient offenses paired with weak defenses, causing the mathematical raw projection (<b>{model_total.toFixed(1)}</b>) to artificially inflate. While traditionally perceived as a high-scoring environment, our 207-game empirical audit confirms that <b>67.4% of games stay UNDER model projection</b> (average shortfall of −6.1 pts). <b>Strong statistical edge is to FADE the total / BET UNDER</b>.
                          </div>
                        ) : (
                          <div style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.45' }}>
                            Both teams operate with below-average offensive ratings and weak defenses. Despite permeable defenses on both sides, low-efficiency offenses fail to capitalize, systematically producing a slow-paced, low-efficiency brick-fest. In our 207-game audit, <b>65.2% finished UNDER model projection</b> with an average drop of −5.6 pts. <b>Expect an inefficient matchup — lean UNDER</b>.
                          </div>
                        )}
                      </div>
                    )}

                    {isShootout && (
                      <div style={{
                        marginTop: '16px',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(15, 23, 42, 0.7) 100%)',
                        borderLeft: '4px solid #ef4444',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        borderRight: '1px solid rgba(255,255,255,0.08)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        color: '#f8fafc',
                        fontSize: '11.5px',
                        lineHeight: '1.5',
                        textAlign: 'left'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', fontWeight: 800, color: '#f87171', letterSpacing: '0.04em', fontSize: '12px' }}>
                            <span style={{ marginRight: 6, fontSize: '13px' }}>🔥</span>
                            {isSharpShootout ? 'SHOOTOUT (HIGH CONVICTION / GLASS CANNONS)' : 'SHOOTOUT (GLASS CANNONS)'}
                          </div>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.5)',
                            color: '#fca5a5',
                            fontWeight: 800,
                            fontSize: '10.5px',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            letterSpacing: '0.03em'
                          }}>
                            <span>🔺</span>
                            <span>SIGNAL: BET OVER (61.1% OVER MODEL / 77.8% OVER MKT)</span>
                          </div>
                        </div>

                        {/* Audit Stat Cards */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                          gap: '8px',
                          margin: '8px 0 10px 0',
                          padding: '8px 10px',
                          background: 'rgba(0,0,0,0.25)',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                          <div>
                            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>Audit Sample</div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#f1f5f9' }}>18 Graded</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>Historical Over</div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#f87171' }}>61.1% Over</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>Avg Score Delta</div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#fb923c' }}>+11.9 pts</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>Vs Market Line</div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8' }}>77.8% Over</div>
                          </div>
                        </div>

                        <div style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.45' }}>
                          Both teams feature high-powered offenses operating against porous defenses (Glass Cannons). While the broader basketball database trends 58.6% Under, this specific profile consistently breaks out into rapid pace and high offensive efficiency. In our empirical audit, <b>61.1% finished OVER model projections</b> (average beat of +11.9 pts) and <b>77.8% cleared the market line</b>. <b>Strong statistical edge is to lean OVER</b>.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="prob-section">
                    <div className="ps-title">Match Winner (Poisson)</div>
                    <ProbabilityItem label={`${home_team} Win`} value={probs_1x2?.home || 0} color="home" />
                    <ProbabilityItem label={`${away_team} Win`} value={probs_1x2?.away || 0} color="away" />
                    <div style={{marginTop: 12, fontSize: 10, color: '#94a3b8', fontStyle: 'italic'}}>
                      * Calculated Match Projections
                    </div>
                  </div>

                  <div className="prob-section">
                    <div className="ps-title">Expected Points Ratio</div>
                    {(() => {
                      const totalX = (xpts_h || 0) + (xpts_a || 0)
                      const hp = totalX > 0 ? (xpts_h / totalX) * 100 : 0
                      const ap = totalX > 0 ? (xpts_a / totalX) * 100 : 0
                      return (
                        <>
                          <ProbabilityItem label={`${home_team} xPts / ${xpts_h.toFixed(1)}`} value={hp} color="goals" />
                          <ProbabilityItem label={`${away_team} xPts / ${xpts_a.toFixed(1)}`} value={ap} color="goals" />
                          <div style={{marginTop: 12, fontSize: 10, color: '#94a3b8', fontStyle: 'italic'}}>
                            * Offensive &amp; Defensive Matrix
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {isGraded && (
            <div className="graded-footer" style={{ padding: '8px 12px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '16px', fontSize: 11, color: '#475569' }}>
              <span><b>RESULT:</b> {finalHomeScore}-{finalAwayScore} {finalResult} {isWin ? '✅' : '❌'}</span>
              {accuracy_tier && <span><b>ACCURACY:</b> {accuracy_tier}</span>}
              {total_delta != null && <span><b>DELTA:</b> {total_delta.toFixed(1)} pts</span>}
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
  let hCls = 'sr-val', aCls = 'sr-val'
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
  if (!fixtures || fixtures.length === 0) return <div className="form-column"><div className="no-data">No recent form.</div></div>
  return (
    <div className="form-column">
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase' }}>{teamName}</div>
      {fixtures.map((f, i) => {
        const isHome = f.teams.home.name === teamName
        const opp = isHome ? f.teams.away.name : f.teams.home.name
        const res = f.teams.home.winner === null ? 'D' : (isHome ? (f.teams.home.winner ? 'W' : 'L') : (f.teams.away.winner ? 'W' : 'L'))
        return (
          <div key={i} className="form-match">
            <div className={`fm-res ${res}`}>{res}</div>
            <div className="fm-opp" title={opp}>{opp}</div>
            <div className="fm-score">{f.scores.home.total}-{f.scores.away.total}</div>
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
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{label}</span>
        <span style={{ flexShrink: 0 }}>{fmt(val, 1)}%</span>
      </div>
      <div className="pi-bar-bg">
        <div className={`pi-bar-fill ${color}`} style={{ width: `${Math.min(100, Math.max(0, val))}%` }}></div>
      </div>
    </div>
  )
}
