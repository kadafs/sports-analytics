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

export async function fetchPlayerProps(date = 'latest') {
  try {
    const filename = (date && date !== 'latest')
      ? `nba_player_props_${date}.json`
      : 'nba_player_props_latest.json'
    const r = await fetch(`${DATA}/basketball/${filename}?t=${Date.now()}`)
    if (!r.ok) {
      if (date !== 'latest') {
        const fallback = await fetch(`${DATA}/basketball/nba_player_props_latest.json?t=${Date.now()}`)
        if (fallback.ok) return await fallback.json()
      }
      return null
    }
    return await r.json()
  } catch (e) {
    console.error('Error fetching player props:', e)
    return null
  }
}

export async function fetchSdiIndex() {
  try {
    const [sdiRes, aliasRes] = await Promise.all([
      fetch(`${DATA}/basketball/team_sdi.json?t=${Date.now()}`),
      fetch(`${DATA}/basketball/team_aliases.json?t=${Date.now()}`).catch(() => null)
    ])
    if (!sdiRes.ok) return {}
    const d = await sdiRes.json()
    let aliases = {}
    if (aliasRes && aliasRes.ok) {
      try {
        const aData = await aliasRes.json()
        aliases = aData.aliases || {}
      } catch (e) {}
    }

    const STOP = new Set(['de','del','la','le','los','las','el','en','of','and','the','bc','bk','sk','fc','ac','sc','club','basket','basketball','sport','sports'])
    const teams = d.teams || []
    // Count first-words and individual words to identify unique shortcuts (split hyphens so "detroit-mercy" shares "detroit")
    const firstWordCounts = {}
    const wordCounts = {}
    for (const t of teams) {
      const cleanTokens = t.team.toLowerCase().replace(/[\-\.\,\/\'\"]/g, ' ').split(/\s+/).filter(Boolean)
      if (cleanTokens.length > 0) {
        firstWordCounts[cleanTokens[0]] = (firstWordCounts[cleanTokens[0]] || 0) + 1
      }
      for (const w of cleanTokens) {
        if (w.length >= 4 && !STOP.has(w)) wordCounts[w] = (wordCounts[w] || 0) + 1
      }
    }
    const index = {}
    for (const t of teams) {
      const full = t.team.toLowerCase().trim()
      index[full] = t
      const cleanTokens = full.replace(/[\-\.\,\/\'\"]/g, ' ').split(/\s+/).filter(Boolean)
      // Unique first-word shortcut
      if (cleanTokens.length > 0 && firstWordCounts[cleanTokens[0]] === 1 && !(cleanTokens[0] in index)) {
        index[cleanTokens[0]] = t
      }
      // Unique individual-word shortcuts
      for (const w of cleanTokens) {
        if (w.length >= 4 && !STOP.has(w) && wordCounts[w] === 1 && !(w in index)) {
          index[w] = t
        }
      }
    }

    // Index 2-word bigrams that uniquely identify a team (e.g. "virginia tech", "kennesaw state", "eastern illinois", "oregon state")
    const bigramCounts = {}
    for (const t of teams) {
      const cleanTokens = t.team.toLowerCase().replace(/[\-\.\,\/\'\"]/g, ' ').split(/\s+/).filter(Boolean)
      for (let i = 0; i < cleanTokens.length - 1; i++) {
        const bg = `${cleanTokens[i]} ${cleanTokens[i + 1]}`
        bigramCounts[bg] = (bigramCounts[bg] || 0) + 1
      }
    }
    for (const t of teams) {
      const cleanTokens = t.team.toLowerCase().replace(/[\-\.\,\/\'\"]/g, ' ').split(/\s+/).filter(Boolean)
      for (let i = 0; i < cleanTokens.length - 1; i++) {
        const bg = `${cleanTokens[i]} ${cleanTokens[i + 1]}`
        if (bigramCounts[bg] === 1 && !(bg in index)) {
          index[bg] = t
        }
      }
    }

    // Inject explicit aliases (e.g. "Detroit" -> "Detroit-Mercy Titans")
    for (const [shortName, fullName] of Object.entries(aliases)) {
      const targetKey = fullName.toLowerCase().trim()
      const target = index[targetKey]
      if (target) {
        index[shortName.toLowerCase().trim()] = target
      }
    }

    return index
  } catch (e) { return {} }
}
