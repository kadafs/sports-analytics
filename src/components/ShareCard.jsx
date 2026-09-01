import { forwardRef } from 'react'

const BRAND = { name: 'BLOWROUT', handle: '@BlowroutHQ', site: 'blowrout.com' }

function formatKickoff(kickoff) {
  if (!kickoff) return ''
  try { return new Date(kickoff).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }
  catch { return kickoff }
}

const ShareCard = forwardRef(function ShareCard({ picks, filterLabel, date, sport = 'football' }, ref) {
  const dateStr = date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <div ref={ref} style={{
      position: 'fixed', left: -9999, top: 0, width: 620,
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
      fontFamily: "'Inter','Segoe UI',sans-serif", color: '#f1f5f9',
      padding: '28px 28px 20px', boxSizing: 'border-box', zIndex: -1, pointerEvents: 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px', color: '#ffffff' }}>
            {BRAND.name}<span style={{ color: '#3b82f6' }}>.</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 1, letterSpacing: 1 }}>AI PREDICTION ENGINE</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#93c5fd' }}>
            {filterLabel || 'TOP PICKS'}
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{dateStr}</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, #3b82f6, transparent)', marginBottom: 16 }} />

      {/* Pick rows */}
      {picks.map((p, i) => {
        const corners = p.corners || {}
        const btts = p.btts_prob
        const bttsCall = p.btts_decision
        const cornerCall = corners.corner_call
        const bookingCall = corners.booking_call
        const showBtts = btts != null && btts >= 60 && bttsCall && bttsCall !== 'PASS'

        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', marginBottom: 6,
            background: i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
            borderRadius: 8, borderLeft: '3px solid',
            borderLeftColor: showBtts ? '#3b82f6' : cornerCall === 'YES' ? '#4ade80' : '#334155',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{p.league} \xb7 {formatKickoff(p.kickoff)}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.home_team} <span style={{ color: '#475569', fontWeight: 400 }}>vs</span> {p.away_team}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, marginLeft: 12, flexShrink: 0 }}>
              {showBtts && (
                <span style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid #3b82f6', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700, color: '#93c5fd' }}>
                  BTTS {Math.round(btts)}%
                </span>
              )}
              {cornerCall && cornerCall !== 'PASS' && (
                <span style={{ background: cornerCall === 'YES' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)', border: `1px solid ${cornerCall === 'YES' ? '#4ade80' : '#f87171'}`, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700, color: cornerCall === 'YES' ? '#4ade80' : '#f87171' }}>
                  CRN {cornerCall} {corners.corner_call_pct}%
                </span>
              )}
              {bookingCall && bookingCall !== 'PASS' && (
                <span style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid #fbbf24', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>
                  BKG {bookingCall} {corners.booking_call_pct}%
                </span>
              )}
              {!showBtts && (!cornerCall || cornerCall === 'PASS') && p.outcome_decision && (
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{p.outcome_decision}</span>
              )}
              {sport !== 'football' && p.decision && (
                <span style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700, color: '#93c5fd' }}>
                  {p.decision}
                </span>
              )}
            </div>
          </div>
        )
      })}

      {/* Footer */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#475569' }}>\u26a0\ufe0f For entertainment only. Bet responsibly.</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>{BRAND.handle}</div>
          <div style={{ fontSize: 10, color: '#475569' }}>{BRAND.site}</div>
        </div>
      </div>
    </div>
  )
})

export default ShareCard
