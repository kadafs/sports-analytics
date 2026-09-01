import { forwardRef } from 'react'

const BRAND = { handle: '@BlowroutHQ', site: 'blowrout.com' }

function formatKickoff(kickoff) {
  if (!kickoff) return ''
  try { return new Date(kickoff).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }
  catch { return kickoff }
}

/**
 * Decide which badge(s) to show for a pick based on the active filter.
 * filterType: 'btts' | '1x2' | 'draw' | 'country' | 'all'
 */
function PickBadges({ p, filterType }) {
  const corners = p.corners || {}
  const btts = p.btts_prob
  const bttsCall = p.btts_decision
  const cornerCall = corners.corner_call
  const bookingCall = corners.booking_call

  const badgeStyle = (bg, border, color) => ({
    display: 'inline-block',
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 5,
    padding: '3px 8px',
    fontSize: 12,
    fontWeight: 700,
    color,
    marginBottom: 3,
  })

  // BTTS-focused filter
  if (filterType === 'btts') {
    if (!btts || !bttsCall || bttsCall === 'PASS') return null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
        <span style={badgeStyle('rgba(59,130,246,0.2)', '#3b82f6', '#93c5fd')}>
          BTTS {Math.round(btts)}%
        </span>
      </div>
    )
  }

  // 1X2 / outcome filter
  if (filterType === '1x2') {
    return p.outcome_decision ? (
      <span style={badgeStyle('rgba(59,130,246,0.15)', '#3b82f6', '#93c5fd')}>
        {p.outcome_decision}
      </span>
    ) : null
  }

  // Draw filter
  if (filterType === 'draw') {
    const draw = p.draw_prob_1x2
    return draw ? (
      <span style={badgeStyle('rgba(168,85,247,0.15)', '#a855f7', '#d8b4fe')}>
        Draw {Math.round(draw)}%
      </span>
    ) : null
  }

  // Default / country / all: show whichever signals exist
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
      {btts >= 60 && bttsCall && bttsCall !== 'PASS' && (
        <span style={badgeStyle('rgba(59,130,246,0.2)', '#3b82f6', '#93c5fd')}>
          BTTS {Math.round(btts)}%
        </span>
      )}
      {cornerCall && cornerCall !== 'PASS' && (
        <span style={badgeStyle(
          cornerCall === 'YES' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
          cornerCall === 'YES' ? '#4ade80' : '#f87171',
          cornerCall === 'YES' ? '#4ade80' : '#f87171'
        )}>
          CRN {cornerCall} {corners.corner_call_pct}%
        </span>
      )}
      {bookingCall && bookingCall !== 'PASS' && (
        <span style={badgeStyle('rgba(251,191,36,0.15)', '#fbbf24', '#fbbf24')}>
          BKG {bookingCall} {corners.booking_call_pct}%
        </span>
      )}
    </div>
  )
}

const ShareCard = forwardRef(function ShareCard({ picks, filterLabel, date, sport = 'football', filterType = 'all' }, ref) {
  const dateStr = date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div ref={ref} style={{
      position: 'fixed', left: -9999, top: 0, width: 620,
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
      fontFamily: "'Inter','Segoe UI',sans-serif", color: '#f1f5f9',
      padding: '24px 28px 18px', boxSizing: 'border-box', zIndex: -1, pointerEvents: 'none',
    }}>
      {/* Header: logo left, filter badge right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>

        <div style={{ textAlign: 'right' }}>
          <div style={{
            background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6',
            borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 700, color: '#93c5fd',
            display: 'inline-block',
          }}>
            {filterLabel || 'TOP PICKS'}
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{dateStr}</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, #3b82f6, transparent)', marginBottom: 14 }} />

      {/* Pick rows */}
      {picks.map((p, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 12px', marginBottom: 5,
          background: i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
          borderRadius: 8,
          borderLeft: '3px solid #334155',
        }}>
          {/* Left: league + teams */}
          <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>
              {p.league} {p.kickoff ? `\xb7 ${formatKickoff(p.kickoff)}` : ''}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p.home_team} <span style={{ color: '#475569', fontWeight: 400 }}>vs</span> {p.away_team}
            </div>
          </div>

          {/* Right: smart badge(s) */}
          <PickBadges p={p} filterType={filterType} />
        </div>
      ))}

      {/* Footer */}
      <div style={{
        marginTop: 16, paddingTop: 12,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 11, color: '#475569' }}>Bet responsibly.</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>{BRAND.handle}</div>
          <div style={{ fontSize: 10, color: '#475569' }}>{BRAND.site}</div>
        </div>
      </div>
    </div>
  )
})

export default ShareCard
