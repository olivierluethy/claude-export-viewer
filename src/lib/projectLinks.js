/**
 * Heuristic conversation → project association.
 *
 * Regular conversations in `conversations.json` carry NO project field — this
 * was verified across all 280 in the export. Only design chats have a real
 * `project` link. So everything here is inference, and the UI must always say
 * so: every result carries a confidence and a human-readable reason.
 *
 * Precedence, highest first:
 *   1. manual   — you tagged it yourself
 *   2. explicit — a design chat's own project field (never inferred)
 *   3. auto     — matched by this heuristic
 */

const ESCAPE = /[.*+?^${}()|[\]\\]/g
const esc = (s) => s.replace(ESCAPE, '\\$&')

/**
 * Names too generic to match on inside message text — hits would be noise.
 * "Watch" and "Collage" are real project names here but also ordinary words.
 */
const AMBIGUOUS_NAMES = new Set([
  'cv',
  'watch',
  'collage',
  'weft',
  'google search',
  'how to use claude',
  'chat',
  'notes',
  'test',
])

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()

function buildMatcher(project) {
  const name = norm(project.name)
  if (!name) return null
  return {
    project,
    name,
    // Whole-phrase, word-bounded. Avoids "CV" matching inside "CVS".
    re: new RegExp(`(?<![\\p{L}\\d])${esc(name)}(?![\\p{L}\\d])`, 'giu'),
    ambiguous: AMBIGUOUS_NAMES.has(name) || name.length <= 3,
  }
}

function countMatches(re, text, cap = 40) {
  if (!text) return 0
  re.lastIndex = 0
  let n = 0
  while (n < cap && re.exec(text) !== null) n++
  return n
}

/** Convenience: build the name matcher for every project, dropping empties. */
export function buildMatchers(projects) {
  return projects.map(buildMatcher).filter(Boolean)
}

/**
 * How strongly one project's NAME shows up in a conversation. This is the exact
 * logic `inferProject` uses per project, factored out so the recommendation
 * engine can consume the same signal without re-deriving it.
 *
 * @returns {{score, reason, titleHit, bodyHits}|null} null = no usable name hit
 */
export function nameEvidence(title, body, matcher) {
  const m = matcher
  if (!m) return null
  const titleHit = title ? countMatches(m.re, title, 1) > 0 : false
  const bodyHits = countMatches(m.re, body || '')

  if (titleHit) {
    return {
      score: 0.75 + Math.min(bodyHits, 10) * 0.02,
      reason: `“${m.project.name}” appears in the conversation title`,
      titleHit: true,
      bodyHits,
    }
  }
  // Too generic to infer from body text alone.
  if (m.ambiguous) return null
  if (bodyHits >= 3) {
    return {
      score: 0.45 + Math.min(bodyHits, 20) * 0.01,
      reason: `“${m.project.name}” mentioned ${bodyHits}× in the conversation`,
      titleHit: false,
      bodyHits,
    }
  }
  if (bodyHits >= 1 && m.name.length >= 8) {
    return {
      score: 0.32,
      reason: `“${m.project.name}” mentioned ${bodyHits}× in the conversation`,
      titleHit: false,
      bodyHits,
    }
  }
  return null
}

/** Lowercase, whitespace-collapsed conversation title — the form matchers expect. */
export const normTitle = (conversation) => norm(conversation.name)

/**
 * @param {object} conversation must carry `searchText` (see ModelContext)
 * @returns {{projectUuid, score, confidence, reason}|null}
 */
export function inferProject(conversation, matchers) {
  const title = norm(conversation.name)
  const body = conversation.searchText || ''
  const scored = []

  for (const m of matchers) {
    if (!m) continue
    const ev = nameEvidence(title, body, m)
    if (!ev) continue
    scored.push({ projectUuid: m.project.uuid, score: ev.score, reason: ev.reason })
  }

  if (!scored.length) return null
  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (best.score < 0.4) return null

  // Two projects matching almost equally well means neither is trustworthy.
  const runnerUp = scored[1]
  if (runnerUp && best.score - runnerUp.score < 0.06) {
    return { ...best, confidence: 'low', reason: `${best.reason} (also matches other projects)` }
  }
  return { ...best, confidence: best.score >= 0.7 ? 'high' : 'medium' }
}

/**
 * Resolves a design chat's project to a real project record.
 *
 * VERIFIED, and contrary to what the export docs imply: a design chat's
 * `project.uuid` matches NO project file — the two use different UUID
 * namespaces (checked against all 3 design chats and all 30 projects). The
 * `project.name` does match, for 2 of the 3; the third ("Watch") has no project
 * file in this export at all.
 *
 * So we join on the name the export itself declares. That is still far stronger
 * than the text heuristic — it is the export's own assertion, not our guess —
 * but it is a name join, not a UUID join, and must not be described otherwise.
 *
 * @returns {string|null} the real project uuid
 */
export function resolveDesignChatProject(designChat, projects) {
  if (!designChat?.projectName && !designChat?.projectUuid) return null
  const byUuid = projects.find((p) => p.uuid === designChat.projectUuid)
  if (byUuid) return byUuid.uuid
  const name = norm(designChat.projectName)
  if (!name) return null
  const byName = projects.find((p) => norm(p.name) === name)
  return byName ? byName.uuid : null
}

/**
 * Builds the full association map in one pass.
 * @returns {{byConversation: Map, byProject: Map}}
 */
export function buildProjectLinks({ conversations, projects, designChats, tags = {} }) {
  const matchers = projects.map(buildMatcher).filter(Boolean)
  const byConversation = new Map()
  const byProject = new Map(projects.map((p) => [p.uuid, { auto: [], manual: [], design: [] }]))

  for (const d of designChats) {
    const resolved = d.resolvedProjectUuid ?? resolveDesignChatProject(d, projects)
    if (resolved && byProject.has(resolved)) byProject.get(resolved).design.push(d)
  }

  for (const c of conversations) {
    const manual = tags[c.uuid]
    if (manual && byProject.has(manual)) {
      const link = { projectUuid: manual, source: 'manual', confidence: 'manual', reason: 'You tagged this chat' }
      byConversation.set(c.uuid, link)
      byProject.get(manual).manual.push(c)
      continue
    }
    const inferred = inferProject(c, matchers)
    if (inferred && byProject.has(inferred.projectUuid)) {
      const link = { ...inferred, source: 'auto' }
      byConversation.set(c.uuid, link)
      byProject.get(inferred.projectUuid).auto.push(c)
    }
  }

  return { byConversation, byProject }
}

export const CONFIDENCE_LABEL = {
  manual: { text: 'tagged by you', tone: 'manual' },
  high: { text: 'auto-matched', tone: 'high' },
  medium: { text: 'auto-matched, likely', tone: 'medium' },
  low: { text: 'auto-matched, uncertain', tone: 'low' },
}
