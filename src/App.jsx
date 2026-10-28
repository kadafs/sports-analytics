import { useState, useEffect, useMemo } from 'react'
import { fetchDates, fetchPredictions, fetchLeaderboard, fetchTeamLeaderboard, fetchSdiIndex } from './api'
import Header from './components/Header'
import Scorecard from './components/Scorecard'
import LeagueGroup from './components/LeagueGroup'
import TeamTracker from './components/TeamTracker'
import LiveDashboard from './components/LiveDashboard'

function isWomensLeague(league = '') {
  const l = league.toLowerCase()
  return l.includes('women') || l.includes('woman') || l.includes('ladies') || / w$/.test(l)
}

function isPlayoffGame(stage = '') {
  if (!stage) return false
  const s = String(stage).toLowerCase()
  return s.includes('final') || s.includes('place') || s.includes('playoff') || s.includes('championship')
}

function getSdiRecord(teamName, sdiIndex) {
  if (!teamName || !sdiIndex) return null
  const key = teamName.toLowerCase().trim()
  // 1. Exact match
  let rec = sdiIndex[key]
  if (rec) return rec
  // 2. Women suffix variants
  const words = key.split(' ')
  if (key.endsWith(' w') || key.endsWith(' (w)')) {
    rec = sdiIndex[words[0] + ' w']
    if (rec) return rec
  }
  // 3. Single-word lookup (unique word shortcuts already indexed)
  if (words.length === 1) {
    rec = sdiIndex[words[0]]
  }
  return rec || null
}

function groupByLeague(predictions, sport) {
  const map = new Map()
  for (const p of predictions) {
    const key = `${p.league_id}||${p.league}||${p.country}`
    if (!map.has(key)) map.set(key, { league: p.league, country: p.country, league_id: p.league_id, games: [] })
    map.get(key).games.push(p)
  }

  if (sport === 'basketball') {
    return [...map.values()].map(group => {
      const consolidatedMap = new Map()
      for (const game of group.games) {
        const fixtureKey = `${game.home_team}||${game.away_team}||${game.time}`
        if (!consolidatedMap.has(fixtureKey)) {
          consolidatedMap.set(fixtureKey, {
            home_team: game.home_team,
            away_team: game.away_team,
            time: game.time,
            predictions: {}
          })
        }
        const consolidated = consolidatedMap.get(fixtureKey)
        const isAdv = game.model_architecture?.includes('ADVANCED')
        if (isAdv) consolidated.predictions.adv = game
        else consolidated.predictions.srs = game

        // Sync match-level info to top level (status, scores, result)
        if (game.status) consolidated.status = game.status
        if (game.actual_home_score !== undefined) consolidated.actual_home_score = game.actual_home_score
        if (game.actual_away_score !== undefined) consolidated.actual_away_score = game.actual_away_score
        if (game.actual_result) consolidated.actual_result = game.actual_result
      }
      return { ...group, games: [...consolidatedMap.values()] }
    })
  }

  return [...map.values()]
}

const LEAGUE_PRIORITY = {
  // Tier 1: Continental (UEFA / CONMEBOL)
  2: 1, 3: 2, 848: 3, 13: 4, 11: 5, 10: 6,
  
  // Tier 2: Premier League
  39: 10,
  
  // Tier 3: Elite Europe
  140: 20, 135: 21, 78: 22,
  
  // Tier 4: Ligue 1 & Major European Sub-Elite + Championship & MLS
  61: 30, 40: 31, 253: 32, 88: 33, 94: 34,
  
  // Tier 5: Top 5 Domestic Cups
  45: 40, 48: 41, 143: 42, 137: 43, 81: 44, 66: 45, 529: 46,
  
  // Tier 6: High-End Europe + Russia Premier
  144: 50, 203: 51, 179: 52, 218: 53, 207: 54, 197: 55, 345: 56, 235: 57,
  
  // Tier 7: Mid-Tier Europe WITH corners/bookings stats (API-confirmed quality)
  119: 60, 113: 61, 103: 62, 210: 63, 285: 64, 106: 65, 283: 66, 89: 67,
  244: 68, 172: 69, 145: 70, 271: 71, 286: 72, 204: 73, 116: 74, 357: 75, 332: 76, 333: 77, 318: 78,
  
  // Tier 8: Top 5 Second Divisions + Quality 2nd Tiers with stats
  141: 81, 136: 82, 79: 83, 62: 84, 41: 86, 95: 87, 114: 88,
  
  // Tier 9: Elite Americas (all with corners/bookings stats)
  71: 90, 73: 91, 128: 92, 239: 93, 242: 94, 265: 95, 268: 96, 72: 97, 281: 98, 250: 99, 344: 100, 16: 101,
  
  // Tier 10: North America
  262: 105, 772: 107, 479: 108,
  
  // Tier 11: Emerging / Cash Leagues
  307: 112,
  
  // Tier 12: Asia, Africa & Middle East (with stats coverage)
  98: 120, 292: 121, 188: 122, 169: 123, 288: 124, 301: 125, 305: 126, 233: 127,
  
  // Tier 13: Lower / Cups / Historical
  254: 133, 237: 134, 252: 135,
  
  // Tier 14: Regional 2nd Divisions
  134: 140, 236: 141, 42: 142, 46: 143, 80: 144,  // Germany 3. Liga (3rd Tier)
  
  // Tier 15: Women's Leagues
  549: 150,
  
  // Tier 16: Regional / State Leagues
  1035: 160, 1232: 161, 1168: 162
}

const WORLD_LEAGUE_PRIORITY = {
  // Senior Global & Continental Tournaments
  1: 1,    // World Cup
  4: 2,    // Euro Championship
  5: 3,    // UEFA Nations League
  8: 4,    // Copa America
  6: 5,    // Africa Cup of Nations
  7: 6,    // AFC Asian Cup
  25: 7,   // Gulf Cup of Nations
  536: 8,  // CONCACAF Nations League
  9: 9,    // Copa Oro (Gold Cup)
  2: 10,   // UEFA Champions League
  3: 11,   // UEFA Europa League
  848: 12, // UEFA Europa Conference League
  531: 13, // UEFA Super Cup
  13: 14,  // Copa Libertadores
  11: 15,  // Copa Sudamericana
  15: 16,  // FIFA Club World Cup
  10: 20,  // Friendlies
  803: 25, // Asian Games
  667: 30, // Friendlies Clubs
  // Youth & Women's International
  33: 40,  // Olympic Games Men
  34: 41,  // Olympic Games Women
  886: 45, // UEFA U17 Championship - Qualification
  771: 46, // COSAFA U20 Championship
  920: 50, // World Cup - U20 - Women
  525: 55, // UEFA Champions League Women
  1191: 56 // UEFA Europa Cup - Women
}

function sortGroups(groups, sortBy, sport = 'football', leaderboard = []) {
  if (sortBy === 'country') {
    return [...groups].sort((a, b) => {
      const aIsWorld = (a.country || '').trim().toUpperCase() === 'WORLD'
      const bIsWorld = (b.country || '').trim().toUpperCase() === 'WORLD'
      if (aIsWorld && !bIsWorld) return -1
      if (!aIsWorld && bIsWorld) return 1
      const cDiff = a.country.localeCompare(b.country)
      if (cDiff !== 0) return cDiff
      return a.league.localeCompare(b.league)
    })
  }
  if (sortBy === 'time') return [...groups]
  if (sortBy === 'o25') {
    // Sort games within each group by O2.5 desc, then sort groups by their best O2.5
    const sorted = groups.map(g => ({
      ...g,
      games: [...(g.games || [])].sort((a, b) => {
        const ao = (a.match_center || {}).over_2_5_prob ?? 0
        const bo = (b.match_center || {}).over_2_5_prob ?? 0
        return bo - ao
      })
    }))
    return sorted.sort((a, b) => {
      const best = g => Math.max(...(g.games || []).map(x => (x.match_center || {}).over_2_5_prob ?? 0))
      return best(b) - best(a)
    })
  }
  
  // Football Smart Competition Sort: Top tiers & marquee pinned, rest sorted by BTTS Edge/ROI
  if (sport === 'football') {
    const lbMap = new Map()
    for (const entry of (leaderboard || [])) {
      if (entry.league_id) lbMap.set(entry.league_id, entry)
      if (entry.name) lbMap.set(entry.name, entry)
    }

    const PINNED_LEAGUE_IDS = new Set([
      // UEFA & CONMEBOL Continental
      2, 3, 848, 531, 13, 11, 10,
      // European First Divisions (Top Flights)
      39, 140, 135, 78, 61, 88, 94,   // England, Spain, Italy, Germany, France, Netherlands, Portugal
      144, 203, 179, 218, 207, 197, 345, 235, // Belgium, Turkey, Scotland, Austria, Switzerland, Greece, Czech, Russia
      119, 113, 103, 210, 106, 283, 333, 271, 244, 172, 286, 116, 357, 332, 318, // Denmark, Sweden, Norway, Croatia, Poland, Romania, Ukraine, Hungary, Finland, Bulgaria, Serbia, Belarus, Ireland, Slovakia, Cyprus
      // Major Domestic Cups
      45, 48, 143, 137, 81, 66, 529,
      // Pinned Key Leagues
      40,  // England Championship
      253  // USA Major League Soccer
    ])

    const isPinned = (lid, prio) => PINNED_LEAGUE_IDS.has(lid)

    const computeRankScore = (g) => {
      const isWorld = (g.country || '').trim().toUpperCase() === 'WORLD'
      if (isWorld) {
        const wprio = WORLD_LEAGUE_PRIORITY[g.league_id] || 100
        return 200000 - wprio
      }

      const prio = LEAGUE_PRIORITY[g.league_id] || 999
      if (isPinned(g.league_id, prio)) {
        return 100000 - prio
      }

      const nameKey = `${(g.country || '').toUpperCase()} — ${(g.league || '').toUpperCase()}`
      const stats = lbMap.get(g.league_id) || lbMap.get(nameKey)
      if (stats && stats.btts_plays >= 5) {
        const roi = stats.btts_roi ?? 0.0
        const hit = stats.btts_hit_rate ?? 0.0
        if (roi > 0) {
          return 10000 + (roi * 100.0) + hit
        } else {
          return (roi * 100.0) + hit
        }
      }
      return 5000 - prio
    }

    return [...groups].sort((a, b) => {
      const scoreDiff = computeRankScore(b) - computeRankScore(a)
      if (scoreDiff !== 0) return scoreDiff
      return a.league.localeCompare(b.league)
    })
  }

  // Basketball / Fallback: Sort by global tier, then alphabetical
  return [...groups].sort((a, b) => {
    const aIsWorld = (a.country || '').trim().toUpperCase() === 'WORLD'
    const bIsWorld = (b.country || '').trim().toUpperCase() === 'WORLD'
    if (aIsWorld && !bIsWorld) return -1
    if (!aIsWorld && bIsWorld) return 1
    const aPrio = LEAGUE_PRIORITY[a.league_id] || 999
    const bPrio = LEAGUE_PRIORITY[b.league_id] || 999
    if (aPrio !== bPrio) return aPrio - bPrio
    return a.league.localeCompare(b.league)
  })
}


// Helper to look up team stats from leaderboard
function getTeamBufferStats(teamName, leagueId, teamLbMap, teamLeaderboard) {
  if (!teamName) return { hitRate: null, games: 0 }
  const key = `${leagueId}__${teamName.toLowerCase().trim()}`
  let entry = teamLbMap ? teamLbMap.get(key) : null
  if (!entry && Array.isArray(teamLeaderboard)) {
    const nameLower = teamName.toLowerCase().trim()
    entry = teamLeaderboard.find(t => t.league_id === leagueId && (
      (t.name || '').toLowerCase().trim() === nameLower ||
      (t.name || '').toLowerCase().includes(nameLower) ||
      nameLower.includes((t.name || '').toLowerCase().trim())
    ))
  }
  if (entry) {
    return {
      hitRate: entry.flat_floor_rate ?? null,
      games: entry.flat_floor_total ?? entry.graded_totals ?? 0
    }
  }
  return { hitRate: null, games: 0 }
}

export function computeBufferHitRateRating(p, teamLbMap, teamLeaderboard) {
  if (p.buffer_tier) {
    return { score: p.buffer_score ?? 0, tier: p.buffer_tier, weightedHitRate: p.weighted_hit_rate }
  }

  const hStats = getTeamBufferStats(p.home_team, p.league_id, teamLbMap, teamLeaderboard)
  const aStats = getTeamBufferStats(p.away_team, p.league_id, teamLbMap, teamLeaderboard)

  const hrA = aStats.hitRate
  const hrH = hStats.hitRate
  const gamesA = aStats.games || (p.graded_a ?? 0)
  const gamesH = hStats.games || (p.graded_h ?? 0)

  if (hrA == null || hrH == null || gamesA === 0 || gamesH === 0) {
    return { score: 8, weightedHitRate: null, tier: '[UNTRACKED]', minGames: Math.min(gamesA, gamesH) }
  }

  const lowerHr = Math.min(hrA, hrH)
  const higherHr = Math.max(hrA, hrH)
  const weightedHr = (0.6 * lowerHr) + (0.4 * higherHr)

  let baseScore = 0
  if (weightedHr >= 0.80) baseScore = 50
  else if (weightedHr >= 0.65) baseScore = 33
  else if (weightedHr >= 0.50) baseScore = 16
  else baseScore = 0

  const minGames = Math.min(gamesA, gamesH)
  let score = 0
  if (minGames >= 5) score = baseScore
  else if (minGames === 4) score = Math.floor(baseScore * 0.8)
  else if (minGames === 3) score = Math.floor(baseScore * 0.6)
  else score = Math.min(15, Math.floor(baseScore * 0.3))

  let tier = '[AVOID]'
  if (score >= 40) tier = '[ELITE BUFFER]'
  else if (score >= 28) tier = '[STRONG BUFFER]'
  else if (score >= 16) tier = '[NEUTRAL]'
  else if (score > 0) tier = '[MARGINAL]'

  return { score, weightedHitRate: weightedHr, tier, minGames }
}

function filterPredictions(predictions, decision, outcome, country, drawMin, sport, leaderboard = [], maxMape = 100, filterBttsHitRate = 0, filterWomen = 'all', hidePlayoffs = false, smartEdgeFilter = false, teamLeaderboard = [], filterCorner = 'all', filterO25 = 0, filterConfidence = 'all', filterClash = false, filterShootout = false, filterDragDown = false, filterBuffer = 'all', filterShots = 'all', filterSDI = 'all', sdiIndex = {}) {
  // Pre-build O(1) lookup map for team leaderboard
  const teamLbMap = new Map(teamLeaderboard.map(t => [`${t.league_id}__${(t.name || '').toLowerCase()}`, t]))
  return predictions.filter(p => {
    if (hidePlayoffs && isPlayoffGame(p.stage)) return false
    if (filterWomen === 'women' && !isWomensLeague(p.league)) return false
    if (filterWomen === 'men'   &&  isWomensLeague(p.league)) return false
    // Sport-specific decision mapping
    const pDecision = sport === 'football' ? p.btts_decision : p.decision
    if (decision !== 'all' && pDecision !== decision) return false
    if (outcome !== 'all' && p.outcome_decision && !p.outcome_decision.startsWith(outcome)) return false
    if (outcome !== 'all' && !p.outcome_decision) return false
    
    if (country  !== 'all' && p.country        !== country)  return false
    if (sport === 'football' && drawMin !== 0) {
      if (drawMin === -1) {
        // Smart Draw Mode (100% Pure Mathematics - Zero Bookmaker Dependency):
        // 1. High-Draw Environment: ELITE/HIGH draw tier league or draw_value_flag
        // 2. Model Draw Support: Model Draw >= 28%
        // 3. Low Expected Goals: Match Total xG <= 2.8
        // 4. Mathematical Parity / Deadlock: Neither team has > 45% model win probability
        const stats = leaderboard.find(x => (p.league_id && x.league_id === p.league_id) || x.name === `${p.country?.toUpperCase()} — ${p.league?.toUpperCase()}`)
        const isHighDrawLeague = p.is_high_draw_league === true || (stats && (stats.draw_tier === 'ELITE' || stats.draw_tier === 'HIGH' || (stats.regressed_draw_rate || 0) >= 27.0 || (stats.raw_draw_rate || 0) >= 28.5))
        const isDrawValue = p.draw_value_flag === true
        const modelDrawProb = p.draw_prob_1x2 ?? p.draw_prob ?? 0
        if (!(isHighDrawLeague || isDrawValue) || modelDrawProb < 28.0) return false

        // Rule 1: Low projected total goals (xG <= 2.8)
        const xgTotal = p.xg_total ?? ((p.xg_home ?? 0) + (p.xg_away ?? 0))
        if (xgTotal > 2.8) return false

        // Rule 2: Mathematical Parity / Deadlock (neither team favored > 45%)
        const hProb = p.home_win_prob ?? 0
        const aProb = p.away_win_prob ?? 0
        if (hProb > 45.0 || aProb > 45.0) return false
      } else {
        const modelDrawProb = p.draw_prob_1x2 ?? p.draw_prob ?? 0
        if (modelDrawProb < drawMin) return false
      }
    }
    
    if (sport === 'football' && filterShots !== 'all') {
      const shots = p.shots || {}
      const shTier = shots.shots_confidence_tier || ''
      const sotTier = shots.sot_confidence_tier || ''
      const sc = shots.shots_call || ''
      const sotc = shots.sot_call || ''
      if (filterShots === 'elite') {
        if (shTier !== '[ELITE SHOTS]') return false
      } else if (filterShots === 'strong') {
        if (!['[ELITE SHOTS]', '[STRONG SHOTS]'].includes(shTier)) return false
      } else if (filterShots === 'solid') {
        if (!['[ELITE SHOTS]', '[STRONG SHOTS]', '[SOLID SHOTS]'].includes(shTier)) return false
      } else if (filterShots === 'sot_elite') {
        if (sotTier !== '[ELITE SOT]') return false
      } else if (filterShots === 'sot_all') {
        if (!sotc || sotc === 'PASS') return false
      } else if (filterShots === 'plays') {
        if ((!sc || sc === 'PASS') && (!sotc || sotc === 'PASS')) return false
      }
    }

    if (sport === 'football' && filterCorner !== 'all') {
      const c = p.corners || {}
      const expCorners = c.exp_total_corners ?? c.exp_total
      if (filterCorner === 'plays') {
        if (c.corner_call !== 'YES' && c.corner_call !== 'NO') return false
      } else if (filterCorner === 'over') {
        if (!(c.corner_call === 'YES' && (c.corner_call_line || '').includes('OVER'))) return false
      } else if (filterCorner === 'under') {
        if (!(c.corner_call === 'NO' && (c.corner_call_line || '').includes('UNDER'))) return false
      } else if (filterCorner === 'exp_high') {
        if (expCorners == null || expCorners < 10.5) return false
      } else if (filterCorner === 'exp_low') {
        if (expCorners == null || expCorners >= 9.5) return false
      }
    }
    
    if (sport === 'football' && filterBttsHitRate > 0) {
      // Filter 1: Poisson model probability >= selected threshold
      if ((p.btts_prob ?? 0) < filterBttsHitRate) return false

      // Filter 2: Team model accuracy (enforced when team leaderboard is loaded)
      // Requires at least ONE team to have >= 3 graded games on record.
      // If either team has >= 3 graded games, accuracy must be >= 70%.
      if (teamLbMap.size > 0) {
        const TEAM_MIN_PLAYS = 3
        const TEAM_HIT_RATE  = filterBttsHitRate
        const homeStats = teamLbMap.get(`${p.league_id}__${(p.home_team || '').toLowerCase()}`)
        const awayStats = teamLbMap.get(`${p.league_id}__${(p.away_team || '').toLowerCase()}`)
        const hPlays = homeStats?.btts_plays ?? 0
        const aPlays = awayStats?.btts_plays ?? 0
        const hRate  = homeStats?.btts_hit_rate ?? 100
        const aRate  = awayStats?.btts_hit_rate ?? 100

        // Must have at least one team with >= 3 games on record
        if (hPlays < TEAM_MIN_PLAYS && aPlays < TEAM_MIN_PLAYS) return false

        // If either team has >= 3 games, accuracy must meet threshold
        if (hPlays >= TEAM_MIN_PLAYS && hRate < TEAM_HIT_RATE) return false
        if (aPlays >= TEAM_MIN_PLAYS && aRate < TEAM_HIT_RATE) return false
      }
    }
    
    if (sport === 'football' && filterO25 > 0) {
      const o25Prob = (p.match_center || {}).over_2_5_prob ?? p.over_2_5_prob ?? 0
      if (o25Prob < filterO25) return false
    }
    
    // MAPE Filter -- league-level accuracy check (Basketball only)
    if (sport === 'basketball' && maxMape < 100) {
      const stats = leaderboard.find(x => (p.league_id && x.league_id === p.league_id) || x.name === `${p.country?.toUpperCase()} — ${p.league?.toUpperCase()}`)
      if (!stats) return false
      const isAdv = p.model_architecture?.includes('ADVANCED')
      const targetStats = isAdv ? stats.adv : stats.srs
      if (!targetStats || targetStats.graded_totals === 0) return false
      if (targetStats.mape > maxMape) return false
    }

    // Confidence Band Filter -- per-matchup (Basketball only)
    if (sport === 'basketball' && filterConfidence !== 'all') {
      const band = (p.confidence_score_band || '').trim()
      if (filterConfidence === '[MODERATE]+') {
        if (!['[ELITE]', '[HIGH]', '[SOLID]', '[MODERATE]'].includes(band)) return false
      } else if (filterConfidence === '[SOLID]+') {
        if (!['[ELITE]', '[HIGH]', '[SOLID]'].includes(band)) return false
      } else if (filterConfidence === '[HIGH]+') {
        if (!['[ELITE]', '[HIGH]'].includes(band)) return false
      } else {
        if (band !== filterConfidence) return false
      }
      // Enforce min_graded >= 3 (consistent with backend confidence engine default)
      const gradedH = p.graded_h ?? 0
      const gradedA = p.graded_a ?? 0
      if (gradedH < 3 || gradedA < 3) return false
    }

    // Historical Buffer Hit Rate Filter (-5 pt buffer floor, Basketball only)
    if (sport === 'basketball' && filterBuffer !== 'all') {
      const buf = computeBufferHitRateRating(p, teamLbMap, teamLeaderboard)
      if (filterBuffer === '[STRONG]+') {
        if (!['[ELITE BUFFER]', '[STRONG BUFFER]'].includes(buf.tier)) return false
      } else if (filterBuffer === '[ELITE BUFFER]') {
        if (buf.tier !== '[ELITE BUFFER]') return false
      } else if (filterBuffer === '[STRONG BUFFER]') {
        if (buf.tier !== '[STRONG BUFFER]') return false
      } else if (filterBuffer === '[NEUTRAL]') {
        if (buf.tier !== '[NEUTRAL]') return false
      } else if (filterBuffer === '[MARGINAL]') {
        if (buf.tier !== '[MARGINAL]') return false
      } else if (filterBuffer === '[AVOID]') {
        if (buf.tier !== '[AVOID]') return false
      }

      // Enforce min_graded >= 3
      const gradedH = p.graded_h ?? 0
      const gradedA = p.graded_a ?? 0
      if (gradedH < 3 || gradedA < 3) return false
    }
    
    // Smart Edge Filter (Basketball only)
    if (sport === 'basketball' && smartEdgeFilter) {
      // 1. Volume Check (>= 10 graded games in leaderboard)
      const stats = leaderboard.find(x => (p.league_id && x.league_id === p.league_id) || x.name === `${p.country?.toUpperCase()} — ${p.league?.toUpperCase()}`)
      if (!stats) return false
      // 1. Team Volume Check (Both teams must have >= 10 matches played)
      const mc = p.match_center || {}
      const hMatches = mc.statsH?.played || 0
      const aMatches = mc.statsA?.played || 0
      
      if (hMatches < 10 || aMatches < 10) return false

      // 2. Stability Check
      const h_vol = p.home_team_volatility
      const a_vol = p.away_team_volatility
      if (h_vol == null || a_vol == null) return false

      if (isWomensLeague(p.league)) {
        // Women: Both Colored (<= 16.6)
        if (h_vol > 16.6 || a_vol > 16.6) return false
      } else {
        // Men: Both Green (< 14.8)
        if (h_vol >= 14.8 || a_vol >= 14.8) return false
      }
    }
    // Clash Filter (Basketball only: 65.2% Under rate)
    if (sport === 'basketball' && filterClash) {
      if (!p.is_clash) return false
    }
    // Shootout Filter (Basketball only: 61.1% Over model / 77.8% Over market)
    if (sport === 'basketball' && filterShootout) {
      if (!p.is_shootout) return false
    }
    // Drag-Down Filter (Basketball only: 77.7% Under rate vs market, -9.4 pts miss)
    if (sport === 'basketball' && filterDragDown) {
      const maeH = p.mae_h ?? null
      const maeA = p.mae_a ?? null
      const band = (p.confidence_score_band || p.band || '')
      const floorStatus = p.floor_status || ''
      const isDragDown = Boolean(
        p.is_drag_down || (
          band.includes('[AVOID]') &&
          floorStatus.startsWith('WEAK') &&
          maeH != null && maeA != null &&
          Math.min(maeH, maeA) <= 11.5 &&
          Math.max(maeH, maeA) >= 14.5
        )
      )
      if (!isDragDown) return false
    }
    // SDI Filter (Basketball only) — live lookup from team_sdi.json index
    if (sport === 'basketball' && filterSDI !== 'all') {
      // Prefer embedded sdiH/sdiA; fall back to live sdiIndex lookup
      const hRec = p.sdiH || getSdiRecord(p.home_team, sdiIndex)
      const aRec = p.sdiA || getSdiRecord(p.away_team, sdiIndex)
      const hRisk = hRec?.risk
      const aRisk = aRec?.risk
      if (filterSDI === 'balanced') {
        // Both teams must be GREEN (low scoring concentration)
        if (!hRisk || !aRisk || hRisk !== 'GREEN' || aRisk !== 'GREEN') return false
      } else if (filterSDI === 'volatile') {
        // At least one team RED (high star dependency)
        if (hRisk !== 'RED' && aRisk !== 'RED') return false
      } else if (filterSDI === 'no_data') {
        // Only show games where NEITHER team has SDI data yet
        if (hRisk || aRisk) return false
      } else {
        // Exact tier: at least one team must match (GREEN / AMBER / RED)
        const tier = filterSDI.toUpperCase()
        if (hRisk !== tier && aRisk !== tier) return false
      }
    }

    return true
  })
}

export default function App() {
  const [sport,         setSport]         = useState('basketball')
  const [dates,         setDates]         = useState([])   // [{date,graded,...}]
  const [selectedDate,  setSelectedDate]  = useState(null)
  const [data,          setData]          = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)
  const [sortBy,        setSortBy]        = useState('competition')
  const [filterDecision,setFilterDecision]= useState('all')
  const [filterOutcome, setFilterOutcome] = useState('all')
  const [filterCorner,  setFilterCorner]  = useState('all')
  const [filterShots,   setFilterShots]   = useState('all') // 'all' | 'plays' | 'over' | 'under' | 'exp_high' | 'exp_low'
  const [filterCountry, setFilterCountry] = useState('all')
  const [filterDraw,    setFilterDraw]    = useState(0)    // min draw_prob_1x2 threshold
  const [filterBttsHitRate, setFilterBttsHitRate] = useState(0) // min BTTS hit rate percentage
  const [filterO25,     setFilterO25]     = useState(0)    // min Over 2.5 probability percentage
  const [filterMape,    setFilterMape]    = useState(100)  // max error percentage
  const [filterConfidence, setFilterConfidence] = useState('all') // 'all' | '[HIGH]' | '[MODERATE]+'
  const [filterBuffer,     setFilterBuffer]     = useState('all') // 'all' | '[STRONG]+' | '[ELITE BUFFER]' | '[STRONG BUFFER]' | '[NEUTRAL]' | '[AVOID]'
  const [filterWomen,   setFilterWomen]   = useState('all') // 'all' | 'women' | 'men'
  const [hidePlayoffs,  setHidePlayoffs]  = useState(false) // true = hide playoff games
  const [smartEdgeFilter, setSmartEdgeFilter] = useState(false) // 🎯 Smart Edge filter
  const [filterClash, setFilterClash] = useState(false) // ⚡ Clash Under filter
  const [filterShootout, setFilterShootout] = useState(false) // 🔥 Shootout Over filter
  const [filterDragDown, setFilterDragDown] = useState(false) // ⚓ Drag-Down Under filter
  const [filterSDI,      setFilterSDI]      = useState('all') // ⭐ SDI tier filter: all | balanced | amber | red | volatile
  
  // High-level App View Mode 
  const [viewMode,      setViewMode]      = useState('matches') // 'matches' | 'teams' | 'live'

  const [compactMode, setCompactMode] = useState(true)

  const toggleCompact = () => setCompactMode(prev => !prev)

  // ── Night Shift ──────────────────────────────────────────
  const [nightShift, setNightShift] = useState(() => {
    const manual = localStorage.getItem('nightShiftOverride')
    return manual !== null ? manual === 'true' : true
  })

  // Apply theme to body
  useEffect(() => {
    document.body.dataset.theme = nightShift ? 'dark' : 'light'
  }, [nightShift])

  const toggleNightShift = () => {
    setNightShift(prev => {
      const next = !prev
      localStorage.setItem('nightShiftOverride', String(next))
      return next
    })
  }
  
  const [leaderboard,   setLeaderboard]   = useState([])
  const [teamLeaderboard, setTeamLeaderboard] = useState([])
  const [sdiIndex,        setSdiIndex]        = useState({}) // team_name -> sdi record
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    let isActive = true
    setLoading(true)
    fetchDates(sport)
      .then(d => { 
        if (!isActive) return
        setDates(d)
        if (d.length > 0) {
          const now = new Date()
          const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
          const utcToday = now.toISOString().slice(0, 10)

          // 1. Try to find Today's date entry in the dates list
          const matchesToday = d.find(x => {
            const base = x.date.replace('_v2', '')
            return base === localToday || base === utcToday
          })

          // 2. Check if user already explicitly selected a date
          const isSelectedToday = selectedDate && (
            selectedDate.replace('_v2', '') === localToday ||
            selectedDate.replace('_v2', '') === utcToday
          )
          const matchesSelected = selectedDate ? d.find(x => x.date === selectedDate) : null

          if (!selectedDate || isSelectedToday) {
            // Initial visit OR user was on "Today": always prefer Today for this sport
            if (matchesToday) {
              setSelectedDate(matchesToday.date)
            } else {
              // If today doesn't exist, pick the most recent date <= today (avoid future dates)
              const pastOrToday = d.filter(x => x.date.replace('_v2', '') <= localToday)
              setSelectedDate(pastOrToday.length > 0 ? pastOrToday[0].date : d[0].date)
            }
          } else if (matchesSelected) {
            // User had explicitly selected a past date and it exists in this sport: keep it
            setSelectedDate(matchesSelected.date)
          } else if (matchesToday) {
            // Selected date from other sport doesn't exist here: fallback to Today
            setSelectedDate(matchesToday.date)
          } else {
            const pastOrToday = d.filter(x => x.date.replace('_v2', '') <= localToday)
            setSelectedDate(pastOrToday.length > 0 ? pastOrToday[0].date : d[0].date)
          }
        } else {
          setSelectedDate(null)
          setData(null)
        }
        setLoading(false)
      })
      .catch(() => {
        if (!isActive) return
        setError(`Could not fetch ${sport} dates.`)
        setLoading(false)
      })
      
    fetchLeaderboard(sport)
      .then(d => { if (isActive) setLeaderboard(d) })
      .catch(e => console.warn(`Could not fetch ${sport} leaderboard:`, e))
      
    fetchTeamLeaderboard(sport)
      .then(d => { if (isActive) setTeamLeaderboard(d) })
      .catch(e => console.warn(`Could not fetch ${sport} team leaderboard:`, e))

    if (sport === 'basketball') {
      fetchSdiIndex()
        .then(idx => { if (isActive) setSdiIndex(idx) })
        .catch(() => setSdiIndex({}))
    }

    return () => { isActive = false }
  }, [sport])

  useEffect(() => {
    if (!selectedDate) return
    let isActive = true
    setLoading(true); setError(null); 
    fetchPredictions(selectedDate, sport)
      .then(d => { 
        if (isActive) {
          setData(d); setLoading(false) 
        }
      })
      .catch(e => { 
        if (isActive) {
          setError(e.message); setLoading(false) 
        }
      })
    return () => { isActive = false }
  }, [selectedDate, sport])

  const countries = useMemo(() => {
    if (!data || !data.predictions) return []
    const list = [...new Set(data.predictions.map(p => p.country).filter(Boolean))]
    list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    return ['all', ...list]
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    return filterPredictions(data.predictions, filterDecision, filterOutcome, filterCountry, filterDraw, sport, leaderboard, filterMape, filterBttsHitRate, filterWomen, hidePlayoffs, smartEdgeFilter, teamLeaderboard, filterCorner, filterO25, filterConfidence, filterClash, filterShootout, filterDragDown, filterBuffer, filterShots, filterSDI, sdiIndex
    );
  }, [data, filterDecision, filterOutcome, filterCountry, filterDraw, sport, leaderboard, filterMape, filterBttsHitRate, filterWomen, hidePlayoffs, smartEdgeFilter, teamLeaderboard, filterCorner, filterO25, filterConfidence, filterClash, filterShootout, filterDragDown, filterBuffer, filterShots, filterSDI, sdiIndex])

  const groups = useMemo(() => sortGroups(groupByLeague(filtered, sport), sortBy, sport, leaderboard), [filtered, sortBy, sport, leaderboard])

  const counts = useMemo(() => {
    if (sport === 'football') {
      const yes    = filtered.filter(p => p.btts_decision === 'PLAY YES').length
      const no     = filtered.filter(p => p.btts_decision === 'PLAY NO' || p.btts_decision === '[STRONG] PLAY NO').length
      const strong = filtered.filter(p => p.btts_decision === '[STRONG] PLAY NO').length
      const pass   = filtered.filter(p => p.btts_decision === 'PASS').length
      return { total: filtered.length, yes, no, strong, pass }
    } else {
      const yes    = filtered.filter(p => p.decision === 'PLAY OVER').length
      const no     = filtered.filter(p => p.decision === 'PLAY UNDER').length
      const strong = filtered.filter(p => (p.edge ?? 0) > 5.0).length
      const pass   = filtered.filter(p => p.decision === 'PASS' || p.decision === 'MODEL ONLY').length
      // Count unique fixtures (not raw predictions which may include both models)
      const matchSet = new Set(filtered.map(p => `${p.home_team}||${p.away_team}||${p.time}`))
      return { total: matchSet.size, yes, no, strong, pass }
    }
  }, [filtered, sport])

  // Is this date graded at all (partially or fully)?
  const dateInfo    = dates.find(d => d.date === selectedDate)
  const hasGrading  = (dateInfo?.graded_count ?? 0) > 0

  return (
    <div className={`app ${compactMode ? 'compact-mode' : ''}`}>
      <Header 
        dates={dates} 
        selected={selectedDate} 
        onSelect={setSelectedDate} 
        sport={sport}
        setSport={(s) => { 
          setSport(s); 
          setData(null);
          setError(null);
          setFilterDecision('all');
          setFilterOutcome('all');
            setFilterCorner('all');
          setFilterShots('all'); 
          setFilterCountry('all'); 
          setFilterDraw(0); 
          setFilterBttsHitRate(0);
          setFilterO25(0);
          setFilterMape(100);
          setFilterConfidence('all');
          setFilterBuffer('all');
          setFilterWomen('all');
          setHidePlayoffs(false);
          setSmartEdgeFilter(false);
          setFilterClash(false);
          setFilterShootout(false);
          setFilterDragDown(false);
          setViewMode('matches');
        }}
        filterDecision={filterDecision}
        setFilterDecision={setFilterDecision}
        filterDraw={filterDraw}
        setFilterDraw={setFilterDraw}
        setFilterCountry={setFilterCountry}
        compactMode={compactMode}
        toggleCompact={toggleCompact}
        nightShift={nightShift}
        toggleNightShift={toggleNightShift}
      />
      <div className="main-wrapper">



        {/* Scorecard (only shown if grading data exists) */}
        {hasGrading && data && <Scorecard data={data} sport={sport} />}

        {/* API connection error — shown prominently above controls */}
        {error && !loading && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: '12px 16px', marginBottom: 12, color: '#991b1b', fontWeight: 600, fontSize: 13 }}>
            ❌ {error}
          </div>
        )}

        {/* Controls row */}
        <div className="controls-bar">
          {sport === 'basketball' && (
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 2, marginRight: 16 }}>
              {[['all', 'All'], ['women', '♀ Women'], ['men', '♂ Men']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilterWomen(val)}
                  style={{
                    padding: '4px 12px',
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: filterWomen === val ? '#fff' : 'transparent',
                    color: filterWomen === val
                      ? (val === 'women' ? '#db2777' : val === 'men' ? '#2563eb' : '#0f172a')
                      : '#64748b',
                    boxShadow: filterWomen === val ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="control-group">
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Sort:</span>
            {['competition', 'country', 'time'].map(s => (
              <button key={s} className={`control-btn ${sortBy === s ? 'active' : ''}`} onClick={() => setSortBy(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}

          </div>

          {sport === 'football' && (
            <div className="control-group">
              <select className="filter-select" value={filterOutcome} onChange={e => setFilterOutcome(e.target.value)}>
                <option value="all">All 1X2</option>
                <option value="[STRONG] PLAY">[STRONG] PLAY</option>
                <option value="PLAY">PLAY (Any)</option>
                <option value="LEAN">LEAN</option>
              </select>

              <select className="filter-select" value={filterDraw} onChange={e => setFilterDraw(Number(e.target.value))}>
                <option value={0}>Draw (All)</option>
                <option value={-1}>{'\uD83C\uDFAF'} Smart Draw Value</option>
                <option value={30}>{'Draw \u2265 30%'}</option>
                <option value={33}>{'Draw \u2265 33%'}</option>
                <option value={35}>{'Draw \u2265 35%'}</option>
                <option value={38}>{'Draw \u2265 38%'}</option>
              </select>

              <select className="filter-select" value={filterBttsHitRate} onChange={e => setFilterBttsHitRate(Number(e.target.value))}>
                <option value={0}>BTTS (All)</option>
                <option value={70}>BTTS ≥ 70%</option>
                <option value={60}>BTTS ≥ 60%</option>
                <option value={50}>BTTS ≥ 50%</option>
              </select>

              <select className="filter-select" value={filterO25} onChange={e => setFilterO25(Number(e.target.value))}>
                <option value={0}>O2.5 (All)</option>
                <option value={80}>O2.5 ≥ 80%</option>
                <option value={75}>O2.5 ≥ 75%</option>
                <option value={70}>O2.5 ≥ 70%</option>
                <option value={65}>O2.5 ≥ 65%</option>
                <option value={60}>O2.5 ≥ 60%</option>
                <option value={50}>O2.5 ≥ 50%</option>
              </select>

              <select className="filter-select" value={filterCorner} onChange={e => setFilterCorner(e.target.value)}>
                <option value="all">All corners</option>
                <option value="plays">All Plays (YES / NO)</option>
                <option value="over">OVER 10.5 (YES)</option>
                <option value="under">UNDER 10.5 (NO)</option>
                <option value="exp_high">Exp ≥ 10.5</option>
                <option value="exp_low">Exp &lt; 9.5</option>
              </select>

              <select className="filter-select" value={filterShots} onChange={e => setFilterShots(e.target.value)}>
                <option value="all">All shots</option>
                <option value="elite">⚡ [ELITE SHOTS] (80+)</option>
                <option value="strong">🔥 [STRONG SHOTS]+ (65+)</option>
                <option value="solid">🛡️ [SOLID SHOTS]+ (50+)</option>
                <option value="sot_elite">🎯 [ELITE SOT] Only</option>
                <option value="sot_all">🎯 Any SoT Play</option>
                <option value="plays">⚽ Any Shots/SoT</option>
              </select>
            </div>
          )}

          {sport === 'basketball' && (
            <div className="control-group">
              <select className="filter-select" style={{ width: '130px' }} value={filterMape} onChange={e => setFilterMape(Number(e.target.value))}>
                <option value={100}>League MAPE</option>
                <option value={10.0}>&lt; 10.0% MAPE</option>
                <option value={8.0}>&lt; 8.0% MAPE</option>
                <option value={6.5}>&lt; 6.5% MAPE</option>
                <option value={5.0}>&lt; 5.0% MAPE</option>
              </select>

              <select className="filter-select" style={{ width: '150px' }} value={filterConfidence} onChange={e => setFilterConfidence(e.target.value)}>
                <option value="all">Confidence: All</option>
                <option value="[ELITE]">⭐ Elite (90+)</option>
                <option value="[HIGH]">🟢 High (75–89)</option>
                <option value="[SOLID]">🟡 Solid (60–74)</option>
                <option value="[MODERATE]">🟠 Moderate (45–59)</option>
                <option value="[LOW]">🔵 Low (30–44)</option>
                <option value="[AVOID]">🔴 Avoid (&lt; 30)</option>
                <option value="[SOLID]+">⚡ Solid+ (60+)</option>
                <option value="[MODERATE]+">⚡ Moderate+ (45+)</option>
              </select>

              <select className="filter-select" style={{ width: '160px' }} value={filterBuffer} onChange={e => setFilterBuffer(e.target.value)}>
                <option value="all">Buffer Floor: All</option>
                <option value="[ELITE BUFFER]">🏆 Elite Buffer (40+ pts)</option>
                <option value="[STRONG]+">🛡️ Strong+ (28+ pts)</option>
                <option value="[STRONG BUFFER]">🟢 Strong Buffer (28–39)</option>
                <option value="[NEUTRAL]">🟡 Neutral (16–27)</option>
                <option value="[MARGINAL]">🟠 Marginal (1–15)</option>
                <option value="[AVOID]">⛔ Avoid (0 pts)</option>
              </select>

              <select
                className="filter-select"
                style={{ width: '170px' }}
                value={filterSDI}
                onChange={e => setFilterSDI(e.target.value)}
                title="Star Dependency Index — filter by scoring concentration risk tier"
              >
                <option value="all">⭐ SDI Risk: All</option>
                <option value="balanced">🟢 Balanced (Both GREEN)</option>
                <option value="amber">🟡 Moderate (Has AMBER)</option>
                <option value="red">🔴 High Dep (Has RED)</option>
                <option value="volatile">⚠️ Any Volatile (≥1 RED)</option>
              </select>

              <button
                onClick={() => setHidePlayoffs(!hidePlayoffs)}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: `1px solid ${hidePlayoffs ? '#fecaca' : '#e2e8f0'}`,
                  cursor: 'pointer',
                  background: hidePlayoffs ? '#fef2f2' : '#f8fafc',
                  color: hidePlayoffs ? '#ef4444' : '#64748b',
                  transition: 'all 0.15s'
                }}
                title={hidePlayoffs ? "Playoff games are hidden" : "Showing playoff games"}
              >
                {hidePlayoffs ? '❌ Playoffs Hidden' : '🏆 Playoffs Included'}
              </button>

              <button
                onClick={() => {
                  setSmartEdgeFilter(!smartEdgeFilter)
                  if (!smartEdgeFilter) {
                    setFilterWomen('all') // Ensure we see both men and women to see the full Smart Edge board
                  }
                }}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 800,
                  borderRadius: 6,
                  border: `1px solid ${smartEdgeFilter ? '#fef08a' : '#e2e8f0'}`,
                  cursor: 'pointer',
                  background: smartEdgeFilter ? '#fef9c3' : '#f8fafc',
                  color: smartEdgeFilter ? '#854d0e' : '#64748b',
                  transition: 'all 0.15s'
                }}
                title="Only show Men (Green/Green) and Women (Colored/Colored) in leagues with ≥10 graded games"
              >
                {smartEdgeFilter ? '🎯 Smart Edge: ON' : '🎯 Smart Edge'}
              </button>

              <button
                onClick={() => setFilterClash(!filterClash)}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 800,
                  borderRadius: 6,
                  border: `1px solid ${filterClash ? '#f59e0b' : '#e2e8f0'}`,
                  cursor: 'pointer',
                  background: filterClash ? '#fef3c7' : '#f8fafc',
                  color: filterClash ? '#b45309' : '#64748b',
                  transition: 'all 0.15s'
                }}
                title="Filter games flagged with Clash of the Inefficient (Empirical Under signal — 70.8% hit on Sharp Over)"
              >
                {filterClash ? '⚡ Clash Under: ON' : '⚡ Clash Signals'}
              </button>

              <button
                onClick={() => setFilterShootout(!filterShootout)}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 800,
                  borderRadius: 6,
                  border: `1px solid ${filterShootout ? '#ef4444' : '#e2e8f0'}`,
                  cursor: 'pointer',
                  background: filterShootout ? '#fee2e2' : '#f8fafc',
                  color: filterShootout ? '#b91c1c' : '#64748b',
                  transition: 'all 0.15s'
                }}
                title="Filter games flagged with Shootout / Glass Cannons (72.6% Over market hit rate / +8.0 pts)"
              >
                {filterShootout ? '🔥 Shootout Over: ON' : '🔥 Shootout Signals'}
              </button>

              <button
                onClick={() => setFilterDragDown(!filterDragDown)}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 800,
                  borderRadius: 6,
                  border: `1px solid ${filterDragDown ? '#991b1b' : '#e2e8f0'}`,
                  cursor: 'pointer',
                  background: filterDragDown ? '#fee2e2' : '#f8fafc',
                  color: filterDragDown ? '#991b1b' : '#64748b',
                  transition: 'all 0.15s'
                }}
                title="Filter Drag-Down Under games (Asymmetric MAE + Weak Floor: 77.7% empirical Under win rate / -9.4 pts vs market)"
              >
                {filterDragDown ? '⚓ Drag-Down Under: ON' : '⚓ Drag-Down Under'}
              </button>
            </div>
          )}

          <div className="control-group">
            <select className="filter-select" value={filterCountry} onChange={e => setFilterCountry(e.target.value)}>
              {countries.map(c => <option key={c} value={c}>{c === 'all' ? 'All countries' : c}</option>)}
            </select>
          </div>

          <div className="controls-bar-right">
            {data && (
              <div className="summary-pill">
                <strong>{counts.total}</strong> games
                {sport === 'football' && (
                  <>
                    {' · '}
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>{counts.yes} YES</span> ·{' '}
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>{counts.no} NO</span>
                    {counts.strong > 0 && <span style={{ color: '#7f1d1d', fontWeight: 700 }}> ({counts.strong} ⚡)</span>} ·{' '}
                    <span style={{ color: '#6b7280' }}>{counts.pass} PASS</span>
                  </>
                )}
              </div>
            )}



            {/* Night Shift Toggle — sits next to Compact */}
            <button
              className={`control-btn ${viewMode === 'live' ? 'active' : ''}`}
              onClick={() => setViewMode(viewMode === 'live' ? 'matches' : 'live')}
              style={{ background: viewMode === 'live' ? '#ef4444' : '', color: viewMode === 'live' ? '#fff' : '', fontWeight: 700 }}
              title="Live In-Play Radar"
            >
              🔴 LIVE
            </button>
            <button
              className={`night-shift-btn ${nightShift ? 'active' : ''}`}
              onClick={toggleNightShift}
              title="Night Shift: click to toggle"
            >
              {nightShift ? '🌙' : '☀️'}
            </button>
          </div>

        </div>

        {loading && <div className="loading">⚽ Loading predictions…</div>}
        {error   && <div className="empty-state"><div className="icon">❌</div><p>{error}</p></div>}
        {!loading && !error && viewMode === 'matches' && groups.length === 0 && data && (
          <div className="empty-state"><div className="icon">📭</div><p>No predictions match your filters.</p></div>
        )}

        {!loading && !error && viewMode === 'teams' && (
          <TeamTracker teamLeaderboard={teamLeaderboard} />
        )}

        {viewMode === 'live' && (
          <LiveDashboard />
        )}

        {!loading && !error && viewMode === 'matches' && groups.length > 0 && (
          <div className="predictions-table">
            {groups.map(g => {
              const stats = leaderboard.find(x => (g.league_id && x.league_id === g.league_id) || x.name === `${g.country?.toUpperCase()} — ${g.league?.toUpperCase()}`)
              return <LeagueGroup key={`${g.league_id}-${g.league}`} group={{...g, stats}} sport={sport} teamLeaderboard={teamLeaderboard} />
            })}
          </div>
        )}


        {/* Scroll to Top Button */}
        <button 
          className={`scroll-top-btn ${showScrollTop ? 'visible' : ''}`} 
          onClick={scrollToTop}
          title="Go to top"
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
