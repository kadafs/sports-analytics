import { useRef, useState, useCallback } from 'react'
import html2canvas from 'html2canvas'
import ShareCard from './ShareCard'

function buildTweetText(picks, filterLabel, date) {
  const dateStr = date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const lines = picks.slice(0, 8).map(p => {
    const btts = p.btts_prob != null ? ` | BTTS ${Math.round(p.btts_prob)}%` : ''
    const corners = p.corners?.corner_call && p.corners.corner_call !== 'PASS'
      ? ` | CRN ${p.corners.corner_call}` : ''
    return `\u26bd ${p.home_team} vs ${p.away_team}${btts}${corners}`
  })
  const label = filterLabel || 'TOP PICKS'
  const header = `\uD83D\uDCCA ${label.toUpperCase()} \u2014 ${dateStr}`
  const footer = '\n\nPowered by @BlowroutHQ \uD83D\uDD17 blowrout.com\n#Football #BTTS #SportsBetting'
  const body = lines.join('\n')
  return `${header}\n\n${body}${footer}`
}

export default function ShareModal({ picks, filterLabel, date, sport, onClose }) {
  const cardRef = useRef(null)
  const [capturing, setCapturing] = useState(false)
  const [imgUrl, setImgUrl] = useState(null)
  const [step, setStep] = useState('preview') // 'preview' | 'done'

  const captureCard = useCallback(async () => {
    if (!cardRef.current) return null
    setCapturing(true)
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const url = canvas.toDataURL('image/png')
      setImgUrl(url)
      setStep('done')
      return url
    } finally {
      setCapturing(false)
    }
  }, [])

  const handleDownload = async () => {
    let url = imgUrl
    if (!url) url = await captureCard()
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `blowrout-picks-${date || 'today'}.png`
    a.click()
  }

  const handleTweet = async () => {
    const text = buildTweetText(picks, filterLabel, date)
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
    window.open(tweetUrl, '_blank', 'width=600,height=400')
  }

  const handleCopyImage = async () => {
    let url = imgUrl
    if (!url) url = await captureCard()
    if (!url) return
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      alert('Image copied to clipboard! Paste it directly into your X post.')
    } catch {
      // Fallback: just download
      handleDownload()
    }
  }

  return (
    <>
      {/* Off-screen ShareCard that html2canvas will capture */}
      <ShareCard ref={cardRef} picks={picks} filterLabel={filterLabel} date={date} sport={sport} />

      {/* Modal backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            border: '1px solid #334155',
            borderRadius: 16,
            padding: '28px 28px 24px',
            width: 480,
            maxWidth: '95vw',
            maxHeight: '90vh',
            overflowY: 'auto',
            zIndex: 9999,
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>Share Picks</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                {picks.length} pick{picks.length !== 1 ? 's' : ''} selected
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20, padding: 4 }}>✕</button>
          </div>

          {/* Filter label */}
          <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 20, fontSize: 13, color: '#93c5fd', fontWeight: 600 }}>
            {filterLabel || 'Top Picks'} &mdash; {date || new Date().toLocaleDateString('en-GB')}
          </div>

          {/* Pick summary list */}
          <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 20 }}>
            {picks.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: '#e2e8f0' }}>
                <span style={{ fontWeight: 600 }}>{p.home_team} vs {p.away_team}</span>
                <span style={{ color: '#64748b', fontSize: 12 }}>{p.league}</span>
              </div>
            ))}
          </div>

          {/* Image preview if captured */}
          {imgUrl && (
            <div style={{ marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid #334155' }}>
              <img src={imgUrl} alt="Share card preview" style={{ width: '100%', display: 'block' }} />
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Row 1: Image actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleDownload}
                disabled={capturing}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  opacity: capturing ? 0.7 : 1,
                }}
              >
                {capturing ? 'Generating…' : '⬇️ Download PNG'}
              </button>
              <button
                onClick={handleCopyImage}
                disabled={capturing}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #334155', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontWeight: 700, fontSize: 14,
                  opacity: capturing ? 0.7 : 1,
                }}
              >
                📋 Copy Image
              </button>
            </div>

            {/* Row 2: Tweet (text) */}
            <button
              onClick={handleTweet}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #1d9bf0, #0d6eb5)',
                color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              𝕏 Post on X (pre-filled text)
            </button>

            <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', lineHeight: 1.5 }}>
              Tip: Download the image, then paste it into your X post for maximum impact.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
