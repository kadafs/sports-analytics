/**
 * api.js
 * Dev:  proxied via Vite → localhost:8080 (FastAPI)
 * Prod: static JSON files bundled in Vercel at /data/football/
 */

const isDev = import.meta.env.DEV
const API   = '/api'
const DATA  = '/data'

export async function fetchDates(sport = 'football') {
  if (isDev) {
    const r = await fetch(`${API}/dates?sport=${sport}`)
    if (!r.ok) throw new Error(`Failed to fetch ${sport} dates`)
    const d = await r.json()
    return d.dates
  }
  const r = await fetch(`${DATA}/${sport}/dates_index.json?t=${Date.now()}`)
  if (!r.ok) throw new Error(`Failed to fetch ${sport} dates index`)
  const d = await r.json()
  return d.dates
}

export async function fetchPredictions(date, sport = 'football') {
  if (isDev) {
    const r = await fetch(`${API}/${sport}?date=${date}`)
    if (!r.ok) throw new Error(`No ${sport} predictions for ${date}`)
    return r.json()
  }
  const r = await fetch(`${DATA}/${sport}/universal_predictions_${date}.json?t=${Date.now()}`)
  if (!r.ok) throw new Error(`No ${sport} predictions for ${date}`)
  return r.json()
}

export async function fetchLeaderboard(sport = 'football') {
  if (isDev) {
    const r = await fetch(`${API}/leaderboard?sport=${sport}`)
    if (!r.ok) return []
    const d = await r.json()
    return d.leaderboard || []
  }
  const r = await fetch(`${DATA}/${sport}/league_leaderboard.json?t=${Date.now()}`)
  if (!r.ok) return []
  const d = await r.json()
  return d.leaderboard || []
}

export async function fetchTeamLeaderboard(sport = 'football') {
  if (isDev) {
    // Falls back to static fetch if dev API isn't built out for teams yet
    try {
      const r = await fetch(`${API}/team_leaderboard?sport=${sport}`)
      if (r.ok) {
        const d = await r.json()
        return d.leaderboard || []
      }
    } catch (e) {}
  }
  
  const lbFile = sport === 'football' ? 'football_leaderboard.json' : 'basketball_leaderboard.json'
  const r = await fetch(`${DATA}/${sport}/${lbFile}?t=${Date.now()}`)
  if (!r.ok) return []
  const d = await r.json()
  return d.leaderboard || []
}

export async function fetchBasketballSignalStats() {
  try {
    const r = await fetch(`${DATA}/basketball/basketball_signal_stats.json?t=${Date.now()}`)
    if (r.ok) return r.json()
  } catch (e) {}
  return null
}

export async function fetchSdiIndex() {
  try {
    const r = await fetch(`${DATA}/basketball/team_sdi.json?t=${Date.now()}`)
    if (!r.ok) return {}
    const d = await r.json()
    const STOP = new Set(['de','del','la','le','los','las','el','en','of','and','the','bc','bk','sk','fc','ac','sc','club','basket','basketball','sport','sports'])
    const teams = d.teams || []
    // Count first-words and individual words to identify unique shortcuts
    const firstWordCounts = {}
    const wordCounts = {}
    for (const t of teams) {
      const words = t.team.toLowerCase().split(' ')
      firstWordCounts[words[0]] = (firstWordCounts[words[0]] || 0) + 1
      for (const w of words) {
        if (w.length >= 4 && !STOP.has(w)) wordCounts[w] = (wordCounts[w] || 0) + 1
      }
    }
    const index = {}
    for (const t of teams) {
      const full = t.team.toLowerCase()
      index[full] = t
      const words = full.split(' ')
      // Unique first-word shortcut
      if (firstWordCounts[words[0]] === 1 && !(words[0] in index)) index[words[0]] = t
      // Unique individual-word shortcuts
      for (const w of words) {
        if (w.length >= 4 && !STOP.has(w) && wordCounts[w] === 1 && !(w in index)) index[w] = t
      }
    }
    return index
  } catch (e) { return {} }
}
