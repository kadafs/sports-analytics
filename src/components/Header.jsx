export default function Header({ 
  dates, selected, onSelect, 
  sport, setSport,
  filterDecision, setFilterDecision,
  filterDraw, setFilterDraw,
  setFilterCountry,
  compactMode, toggleCompact,
  nightShift
}) {
  const selectedIdx = dates?.findIndex(d => d.date === selected) ?? -1
  const start = Math.max(0, selectedIdx - 2)
  const visible = dates?.slice(start, start + 5) || []

  const todayStr = new Date().toISOString().slice(0, 10)

  // Logic for the header filter buttons
  const isBTTSActive = sport === 'football' && filterDecision === 'PLAY YES' && filterDraw === 0
  const isDrawActive = sport === 'football' && filterDraw >= 35 && filterDecision === 'all'
  const isOverActive = sport === 'basketball' && filterDecision === 'PLAY OVER'
  const isAllActive  = filterDecision === 'all' && filterDraw === 0

  const handleBTTS = () => { setFilterDecision('PLAY YES'); setFilterDraw(0); }
  const handleDraw = () => { setFilterDraw(35); setFilterDecision('all'); }
  const handleOver = () => { setFilterDecision('PLAY OVER'); }
  const handleAll  = () => { setFilterDecision('all'); setFilterDraw(0); setFilterCountry('all'); }

  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="header-left">
          <a href="/" className="logo">
            <img
              src={nightShift ? '/darklogo.png' : '/logo.png'}
              alt="blowrout — Mathematical Basketball Predictions"
              className="logo-img desktop-logo"
            />
            <img
              src="/favicon_glow.png"
              alt="blowrout — Mathematical Basketball Predictions"
              className="logo-img mobile-logo"
            />
          </a>
        </div>

        {visible.length > 0 && (
          <div className="header-nav">
            {visible.map(d => {
              const isToday = d.date === todayStr
              const isActive = d.date === selected
              return (
                <button
                  key={d.date}
                  className={`nav-date-tab ${isActive ? 'active' : ''}`}
                  onClick={() => onSelect(d.date)}
                >
                  {isToday ? 'Today' : d.date}
                  {d.graded && <span className="tab-check">✓</span>}
                </button>
              )
            })}
          </div>
        )}

        <div className="header-right">
          {sport === 'football' ? (
            <>
              <button className={`header-badge ${isBTTSActive ? 'active' : ''}`} onClick={handleBTTS}>BTTS</button>
              <button className={`header-badge ${isDrawActive ? 'active' : ''}`} onClick={handleDraw}>DRAW</button>
            </>
          ) : (
            <>
              <button className={`header-badge ${isOverActive ? 'active' : ''}`} onClick={handleOver}>OVER</button>
            </>
          )}
          <button className={`header-badge ${isAllActive ? 'active' : ''}`} onClick={handleAll}>ALL</button>
          <button className={`header-badge compact-header-btn ${compactMode ? 'active' : ''}`} onClick={toggleCompact} style={{ marginLeft: 6 }}>
            <span className="desktop-text">COMPACT</span>
            <span className="mobile-icon">{compactMode ? '⊟' : '⊞'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}

