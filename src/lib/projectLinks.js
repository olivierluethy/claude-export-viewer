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

/** Filler words that carry no project identity when a name is tokenised. */
const NAME_STOP = new Set(['how', 'to', 'use', 'the', 'of', 'and', 'for', 'my', 'in', 'on', 'at', 'a', 'an', 'from', 'all'])

/** Split a joined name like "WarTrackerLive" / "ShareMyContact" into words. */
function splitCamel(word) {
  return word
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/\s+/)
}

/**
 * The significant tokens of a project name. Multi-word names split on spaces;
 * single joined words (WarTrackerLive) split on camel-case. Stopwords and very
 * short tokens are dropped. "WhatsApp Customizer" → [whatsapp, customizer];
 * "How to use Claude" → [claude]; "ShareMyContact" → [share, contact].
 */
function nameTokens(rawName) {
  let parts = String(rawName || '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
  if (parts.length === 1) parts = splitCamel(parts[0])
  return parts.map((p) => p.toLowerCase()).filter((t) => t.length >= 3 && !NAME_STOP.has(t))
}

const wordBounded = (src) => new RegExp(`(?<![\\p{L}\\d])${src}(?![\\p{L}\\d])`, 'giu')

/**
 * Matcher for one project name, tolerant of the near-misses that exact matching
 * loses. The reference case: the project is "WhatsApp Customizer" but every
 * mention in the chats is "WhatsApp **Web** Customizer", so an exact phrase
 * scores zero. Here a multi-token name also matches when its tokens appear in
 * order with a word or two between them, and (weaker) when all its tokens simply
 * appear somewhere in the chat.
 *
 * Single-token names stay conservative — exact phrase only — because a lone
 * common word ("prompt", "collage") would match far too much.
 */
function buildMatcher(project) {
  const name = norm(project.name)
  if (!name) return null
  const tokens = nameTokens(project.name)
  const multi = tokens.length >= 2

  // Up to two filler words allowed between consecutive name tokens.
  const gap = String.raw`(?:[^\p{L}\p{N}]+[\p{L}\p{N}]+){0,2}[^\p{L}\p{N}]+`
  const orderedRe = multi ? wordBounded(tokens.map(esc).join(gap)) : null

  return {
    project,
    name,
    tokens,
    multi,
    // Whole-phrase, word-bounded. Avoids "CV" matching inside "CVS".
    re: wordBounded(esc(name)),
    orderedRe,
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
  const t = title || ''
  const b = body || ''
  const label = m.project.name

  // --- conservative path: single-token OR ambiguous names, exact phrase only. ---
  // Ambiguous names ("Google Search", "CV") only ever match in the title, never
  // from body text — a common phrase in a message body is not evidence.
  if (!m.multi || m.ambiguous) {
    const titleHit = t ? countMatches(m.re, t, 1) > 0 : false
    const bodyHits = countMatches(m.re, b)
    if (titleHit) {
      return { score: 0.75 + Math.min(bodyHits, 10) * 0.02, reason: `“${label}” appears in the conversation title`, titleHit: true, bodyHits }
    }
    if (m.ambiguous) return null
    if (bodyHits >= 3) {
      return { score: 0.45 + Math.min(bodyHits, 20) * 0.01, reason: `“${label}” mentioned ${bodyHits}× in the conversation`, titleHit: false, bodyHits }
    }
    if (bodyHits >= 1 && m.name.length >= 8) {
      return { score: 0.32, reason: `“${label}” mentioned ${bodyHits}× in the conversation`, titleHit: false, bodyHits }
    }
    return null
  }

  // --- multi-token names: exact phrase, or the tokens in order with a word or
  // two between them ("WhatsApp Web Customizer" ⇒ "WhatsApp Customizer"). We
  // deliberately do NOT match tokens scattered far apart — that invites false
  // links from common words like "share" + "contact". ---
  const titleHit = (t && countMatches(m.re, t, 1) > 0) || (t && countMatches(m.orderedRe, t, 1) > 0)
  const bodyOrdered = countMatches(m.orderedRe, b)
  const bodyPhrase = countMatches(m.re, b)

  if (titleHit) {
    return { score: 0.75 + Math.min(bodyOrdered, 10) * 0.02, reason: `“${label}” named in the conversation title`, titleHit: true, bodyHits: bodyOrdered }
  }
  if (bodyOrdered >= 1) {
    const exact = bodyPhrase >= 1
    return {
      score: 0.5 + Math.min(bodyOrdered, 20) * 0.015,
      reason: exact
        ? `“${label}” mentioned ${bodyOrdered}× in the conversation`
        : `“${label}” referenced ${bodyOrdered}× (as a close variant) in the conversation`,
      titleHit: false,
      bodyHits: bodyOrdered,
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
