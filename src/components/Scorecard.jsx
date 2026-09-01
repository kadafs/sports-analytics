function pct(wins, total) {
  if (!total) return null
  return Math.round((wins / total) * 100)
}

function pctColor(p) {
  if (p == null) return '#6b7280'
  if (p >= 60) return '#16a34a'
  if (p >= 45) return '#d97706'
  return '#dc2626'
}

export default function Scorecard({ data, sport = 'football' }) {
  const isFootball = sport === 'football'
  const summary = data?.grade_summary
  const predictions = data?.predictions ?? []

  // Count graded games
  const graded = predictions.filter(p => p.actual_result != null)
  const pending = predictions.length - graded.length

  if (!summary && graded.length === 0) return null  // nothing to show yet

  // Logic varies by sport
  let outcomeW, outcomeT, playW, playT, playLabel

  if (isFootball) {
    outcomeW = summary?.outcome_wins  ?? graded.filter(p => p.predicted_result === p.actual_result).length
    outcomeT = summary?.outcome_total ?? graded.length
    playW   = summary?.btts_wins  ?? graded.filter(p => {
      const d = p.btts_decision; const a = p.actual_btts
      return (d === 'PLAY YES' && a === true) || (d === '[STRONG] PLAY YES' && a === true)
    }).length
    playT   = summary?.btts_total ?? graded.filter(p =>
      p.btts_decision === 'PLAY YES' || p.btts_decision === '[STRONG] PLAY YES'
    ).length
    playLabel = "BTTS ≥70%"
  } else {
    // Basketball Outcome (1X2 / ML)
    outcomeW = graded.filter(p => p.predicted_result === p.actual_result).length
    outcomeT = graded.length
  }

  const outcomePct = pct(outcomeW, outcomeT)
  const playPct    = pct(playW, playT)

  // Corners & booking from grade_summary (populated after YES/NO/PASS grading)
  const cornersW   = summary?.corners_wins  ?? null
  const cornersT   = summary?.corners_total ?? null
  const cornersPct = summary?.corners_pct   ?? null
  const bookingW   = summary?.booking_wins  ?? null
  const bookingT   = summary?.booking_total ?? null
  const bookingPct = summary?.booking_pct   ?? null

  return (
    <div className="scorecard">
      <div className="scorecard-title">📊 Grade Summary</div>

      <div className="scorecard-stat">
        <span className="sc-label">{isFootball ? '1X2 =60%' : 'Winner (ML)'}</span>
        <span className="sc-record">{outcomeW}W – {outcomeT - outcomeW}L</span>
        {outcomePct != null && (
          <span className="sc-pct" style={{ color: pctColor(outcomePct) }}>{outcomePct}%</span>
        )}
      </div>

      {isFootball && (
        <div className="scorecard-stat">
          <span className="sc-label">{playLabel}</span>
          <span className="sc-record">{playW}W – {playT - playW}L</span>
          {playPct != null && (
            <span className="sc-pct" style={{ color: pctColor(playPct) }}>{playPct}%</span>
          )}
        </div>
      )}

      {isFootball && cornersT != null && cornersT > 0 && (
        <div className="scorecard-stat">
          <span className="sc-label">CORNERS ≥65%</span>
          <span className="sc-record">{cornersW}W – {cornersT - cornersW}L</span>
          {cornersPct != null && (
            <span className="sc-pct" style={{ color: pctColor(cornersPct) }}>{cornersPct}%</span>
          )}
        </div>
      )}

      {isFootball && bookingT != null && bookingT > 0 && (
        <div className="scorecard-stat">
          <span className="sc-label">BOOKING ≥65%</span>
          <span className="sc-record">{bookingW}W – {bookingT - bookingW}L</span>
          {bookingPct != null && (
            <span className="sc-pct" style={{ color: pctColor(bookingPct) }}>{bookingPct}%</span>
          )}
        </div>
      )}

      {pending > 0 && (
        <div className="sc-pending">⏳ {pending} game{pending !== 1 ? 's' : ''} pending</div>
      )}
    </div>
  )
}
