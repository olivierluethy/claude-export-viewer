/**
 * Project ↔ chat relationship intelligence.
 *
 * Regular conversations carry NO project in the export (verified 0/280), so any
 * association is inference. This engine treats that inference as a *scored
 * recommendation problem*, not a yes/no classification: every unlinked chat is
 * evaluated against multiple candidate projects, each candidate keeps the
 * evidence that produced its score, and the result is deliberately allowed to be
 * "ambiguous" or "no meaningful relationship" instead of being forced into a
 * project.
 *
 * There is no embedding model offline, so "similarity" here is lexical
 * (TF-IDF cosine over the same vectors lib/related.js already builds) plus
 * honest metadata signals. The UI must never present it as semantic embeddings.
 *
 * Pipeline (see docs/RELATIONSHIP_ALGORITHM.md for the full rationale):
 *
 *   already in a project?  ──yes──▶ skipped (already shown inside that folder)
 *      │no  (no tag, no design link, no name-match inference)
 *      ▼
 *   candidate generation  (name matchers + term inverted index — not all-pairs)
 *      ▼
 *   candidate scoring      (5 weighted signals → 0–100, with evidence)
 *      ▼
 *   confidence classification  (floor / margin / decisive-title thresholds)
 *      ▼
 *   high · medium · ambiguous · none
 */

import { tokenize } from './related.js'
import { buildMatchers, nameEvidence, normTitle } from './projectLinks.js'

/* ------------------------------------------------------------------ tuning --
 * All thresholds live here, named, so behaviour is auditable in one place and
 * documented in docs/RELATIONSHIP_ALGORITHM.md.
 */

/** Signal weights. Sum = 1.0; the weighted sum is scaled ×100 to a 0–100 score. */
export const WEIGHTS = {
  name: 0.32, // project name appears in the chat (fuzzy/token-tolerant)
  content: 0.26, // TF-IDF cosine to the project's existing chats
  entity: 0.18, // shared distinctive entity — domain, extension id, repo
  terminology: 0.1, // the project's own distinctive terms appear in the chat
  toolsLangs: 0.08, // shared tools / programming languages
  temporal: 0.06, // written during the project's active period (weak — most chats overlap)
}

export const THRESHOLDS = {
  /** Below this best score, there is no meaningful relationship. Tuned so a
   * content- or entity-driven match survives but a lone weak signal (e.g. a
   * shared rare-but-generic domain plus temporal overlap) does not. */
  FLOOR: 20,
  /** At/above this best score a recommendation is "high" confidence. */
  HIGH: 60,
  /** A best this strong is recommended even if a runner-up is close. */
  DECISIVE: 74,
  /** If best − runnerUp is under this (and best isn't decisive), it's ambiguous. */
  MARGIN: 10,
  /** Max candidate projects fully scored per chat, after cheap pre-ranking. */
  MAX_CANDIDATES: 8,
  /** Chat top-terms consulted for candidate generation and content overlap. */
  CHAT_TERMS: 20,
  /** Distinctive terms kept per project profile. */
  PROFILE_TERMS: 30,
  /** An entity is a usable fingerprint only if it appears in ≤ this many chats.
   * Rare = distinctive (a product domain); common = a platform everyone cites. */
  ENTITY_MAX_DF: 8,
}

const WEEK = 7 * 86_400_000

/* -------------------------------------------------------- entity fingerprints --
 * Distinctive strings that identify a product across chats even when its project
 * name is never written: its domain, its Chrome extension id, a GitHub repo. A
 * single shared one of these is strong evidence two chats belong together.
 */

const DOMAIN_RE = /\b((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|io|app|dev|ai|net|org|co|ch|de|xyz|gg|sh|me))\b/gi
const EXT_ID_RE = /\b[a-p]{32}\b/g // Chrome/Edge extension ids
const GITHUB_RE = /github\.com\/([\w.-]+\/[\w.-]+)/gi

/**
 * Generic platforms that identify no project — a chat citing any of these tells
 * us nothing about which folder it belongs to. Stored as registrable domains
 * (no subdomain), matched after normalisation.
 */
const COMMON_DOMAINS = new Set([
  'google.com', 'gmail.com', 'youtube.com', 'github.com', 'gitlab.com', 'stackoverflow.com', 'wikipedia.org',
  'openai.com', 'chatgpt.com', 'anthropic.com', 'claude.ai', 'example.com', 'localhost.com', 'apple.com',
  'microsoft.com', 'amazon.com', 'aws.amazon.com', 'linkedin.com', 'x.com', 'twitter.com', 'whatsapp.com',
  'facebook.com', 'instagram.com', 'tiktok.com', 'reddit.com', 'medium.com', 'substack.com', 'notion.so',
  'vercel.app', 'vercel.com', 'netlify.app', 'netlify.com', 'pages.dev', 'web.app', 'firebaseapp.com',
  'firebase.com', 'supabase.com', 'supabase.co', 't.me', 'telegram.org', 'discord.com', 'discord.gg',
  'npmjs.com', 'mozilla.org', 'w3.org', 'cloudflare.com', 'stripe.com', 'paypal.com', 'wordpress.com',
  'asp.net', 'dotnet.microsoft.com', 'developer.android.com', 'chrome.com', 'wikipedia.com',
  'github.io', 'gitlab.io', 'herokuapp.com', 'onrender.com', 'glitch.me', 'repl.co', 'replit.com',
  'ngrok.io', 'gitbook.io', 'readthedocs.io', 'figma.com', 'canva.com', 'youtu.be', 'bit.ly',
  'draw.io', 'diagrams.net', 'excalidraw.com', 'miro.com', 'lucidchart.com', 'loom.com', 'imgur.com',
])

/** Reduce a hostname to its registrable domain: web.whatsapp.com → whatsapp.com. */
const registrable = (host) => host.toLowerCase().split('.').slice(-2).join('.')

export function extractEntities(text) {
  const set = new Set()
  const s = String(text || '')
  for (const m of s.matchAll(DOMAIN_RE)) {
    const d = registrable(m[1])
    if (!COMMON_DOMAINS.has(d)) set.add(d)
  }
  for (const m of s.matchAll(EXT_ID_RE)) set.add(m[0].toLowerCase())
  for (const m of s.matchAll(GITHUB_RE)) set.add(`gh:${m[1].toLowerCase()}`)
  return set
}

/* ----------------------------------------------------------- small helpers -- */

const unit = (map) => {
  let s = 0
  for (const w of map.values()) s += w * w
  const n = Math.sqrt(s) || 1
  const out = new Map()
  for (const [k, w] of map) out.set(k, w / n)
  return out
}

const cosine = (a, b) => {
  if (!a || !b) return 0
  // Iterate the smaller map; both are unit vectors so the dot product is cosine.
  const [small, big] = a.size <= b.size ? [a, b] : [b, a]
  let dot = 0
  for (const [term, w] of small) {
    const o = big.get(term)
    if (o) dot += w * o
  }
  return dot
}

/* ------------------------------------------------------------- profiles --
 * A project's "profile" is what we compare an unlinked chat against. It is
 * seeded from the project's ALREADY-KNOWN chats (your manual tags, the export's
 * design chats, and the current name-inferred links) plus the project's own
 * metadata. Profiles are the corpus knowledge; scoring never mutates them, so a
 * recommendation can never feed itself.
 */

function buildProfiles({ projects, links, relatedIndex, memories, matchers }) {
  const profiles = new Map()
  const memoryFor = (uuid) => memories?.projectMemories?.[uuid] || ''

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i]
    const group = links?.byProject?.get(p.uuid) ?? { auto: [], manual: [], design: [] }
    const memberConvs = [...group.manual, ...group.auto] // have TF-IDF vectors
    const memberCount = memberConvs.length + group.design.length

    // Centroid of member chat vectors → the project's vocabulary fingerprint.
    const sum = new Map()
    const times = []
    const tools = new Map()
    const langs = new Map()
    const entities = new Set()
    for (const c of memberConvs) {
      const vec = relatedIndex.vectors.get(c.uuid)
      if (vec) for (const [t, w] of vec) sum.set(t, (sum.get(t) || 0) + w)
      const when = c.updatedAtMs ?? c.createdAtMs
      if (when) times.push(when)
      for (const t of c.facets?.tools ?? []) tools.set(t, (tools.get(t) || 0) + 1)
      for (const l of c.facets?.languages ?? []) langs.set(l, (langs.get(l) || 0) + 1)
      for (const e of c._entities ?? extractEntities(c.searchText)) entities.add(e)
    }
    for (const d of group.design) {
      const when = d.updatedAtMs ?? d.createdAtMs
      if (when) times.push(when)
    }
    if (p.updatedAtMs) times.push(p.updatedAtMs)
    if (p.createdAtMs) times.push(p.createdAtMs)

    const centroid = unit(sum)

    // Distinctive terminology from the project's own words (name, description,
    // prompt template, remembered facts). Capped to the strongest terms.
    const termCounts = tokenize(`${p.name} ${p.name} ${p.description || ''} ${p.promptTemplate || ''} ${memoryFor(p.uuid)}`)
    const terms = new Set([...termCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, THRESHOLDS.PROFILE_TERMS).map(([t]) => t))

    const timeMin = times.length ? Math.min(...times) : null
    const timeMax = times.length ? Math.max(...times) : null

    profiles.set(p.uuid, {
      project: p,
      matcher: matchers[i] ?? null,
      centroid,
      terms,
      entities,
      tools,
      langs,
      memberCount,
      timeMin,
      timeMax,
    })
  }
  return profiles
}

/** term|entity -> Set(projectUuid): lets candidate generation skip unrelated projects. */
function buildTermIndex(profiles) {
  const idx = new Map()
  const add = (key, uuid) => {
    if (!idx.has(key)) idx.set(key, new Set())
    idx.get(key).add(uuid)
  }
  for (const [uuid, prof] of profiles) {
    for (const term of prof.centroid.keys()) add(term, uuid)
    for (const term of prof.terms) add(term, uuid)
    for (const e of prof.entities) add(`@${e}`, uuid) // namespaced so it can't collide with a term
  }
  return idx
}

/* -------------------------------------------------------------- scoring -- */

const round = (n) => Math.round(n * 10) / 10

/** Score one candidate project for one chat, returning score + evidence. */
function scoreCandidate({ conv, chatVec, chatTerms, chatEntities, title, body, prof }) {
  const evidence = []
  let score = 0

  // 1. Name mention.
  const nm = prof.matcher ? nameEvidence(title, body, prof.matcher) : null
  const nameVal = nm ? Math.min(1, nm.score) : 0
  const titleHit = !!nm?.titleHit
  if (nameVal > 0) {
    const pts = nameVal * WEIGHTS.name * 100
    score += pts
    evidence.push({
      key: 'name',
      value: nameVal,
      points: round(pts),
      label: titleHit ? 'Project name in the title' : 'Project name mentioned',
      detail: nm.reason,
    })
  }

  // 2. Content similarity (TF-IDF cosine to the project's chats).
  const cos = prof.memberCount ? cosine(chatVec, prof.centroid) : 0
  const contentVal = Math.min(1, cos * 2.2) // cosine rarely exceeds ~0.45 here
  if (contentVal > 0.05) {
    const pts = contentVal * WEIGHTS.content * 100
    score += pts
    evidence.push({
      key: 'content',
      value: contentVal,
      points: round(pts),
      label: 'Vocabulary overlap',
      detail: `Distinctive words in common with this project's ${prof.memberCount} chat${prof.memberCount === 1 ? '' : 's'}`,
    })
  }

  // 2b. Shared distinctive entity — a domain, extension id, or repo the project's
  // chats also use. Very strong: these are near-unique to a product.
  const sharedEntities = []
  for (const e of chatEntities) if (prof.entities.has(e)) sharedEntities.push(e)
  const entityVal = Math.min(1, sharedEntities.length / 1.5)
  if (entityVal > 0) {
    const pts = entityVal * WEIGHTS.entity * 100
    score += pts
    evidence.push({
      key: 'entity',
      value: entityVal,
      points: round(pts),
      label: 'Shared identifier',
      detail: `Also references ${sharedEntities.slice(0, 3).join(', ')}`,
    })
  }

  // 3. The project's own terminology showing up in the chat.
  const hitTerms = []
  for (const t of prof.terms) if (chatTerms.has(t)) hitTerms.push(t)
  const termVal = prof.terms.size ? Math.min(1, hitTerms.length / 5) : 0
  if (termVal > 0) {
    const pts = termVal * WEIGHTS.terminology * 100
    score += pts
    evidence.push({
      key: 'terminology',
      value: termVal,
      points: round(pts),
      label: 'Project terminology',
      detail: `Uses ${hitTerms.slice(0, 4).map((t) => `“${t}”`).join(', ')}`,
    })
  }

  // 4. Shared tools / languages.
  const sharedTools = (conv.facets?.tools ?? []).filter((t) => prof.tools.has(t))
  const sharedLangs = (conv.facets?.languages ?? []).filter((l) => prof.langs.has(l))
  const shared = [...sharedLangs, ...sharedTools]
  const tlVal = Math.min(1, shared.length / 4)
  if (tlVal > 0) {
    const pts = tlVal * WEIGHTS.toolsLangs * 100
    score += pts
    evidence.push({
      key: 'toolsLangs',
      value: tlVal,
      points: round(pts),
      label: 'Shared tools & languages',
      detail: `Also uses ${shared.slice(0, 4).join(', ')}`,
    })
  }

  // 5. Temporal proximity to the project's active period.
  const when = conv.updatedAtMs ?? conv.createdAtMs
  let tempVal = 0
  if (when && prof.timeMin != null) {
    if (when >= prof.timeMin && when <= prof.timeMax) tempVal = 1
    else {
      const gap = when < prof.timeMin ? prof.timeMin - when : when - prof.timeMax
      const weeks = gap / WEEK
      tempVal = weeks >= 8 ? 0 : 1 - weeks / 8 // linear decay to zero at 8 weeks
    }
  }
  if (tempVal > 0.15) {
    const pts = tempVal * WEIGHTS.temporal * 100
    score += pts
    evidence.push({
      key: 'temporal',
      value: tempVal,
      points: round(pts),
      label: 'Timing',
      detail: tempVal === 1 ? "Written during this project's active period" : "Close in time to this project's activity",
    })
  }

  evidence.sort((a, b) => b.points - a.points)
  return { projectUuid: prof.project.uuid, project: prof.project, score: round(score), titleHit, evidence }
}

/**
 * Turn a scored, sorted candidate list into a confidence verdict.
 * Exported so the algorithm's decision boundary is testable and documented.
 */
export function classify(candidates) {
  if (!candidates.length) return { status: 'none', top: null, candidates, rejected: 'no candidate project shared any signal' }
  const best = candidates[0]
  const runnerUp = candidates[1] ?? null

  if (best.score < THRESHOLDS.FLOOR) {
    return { status: 'none', top: null, candidates, rejected: `best match scored ${best.score}, under the ${THRESHOLDS.FLOOR} floor` }
  }

  const decisive = best.titleHit || best.score >= THRESHOLDS.DECISIVE
  const margin = best.score - (runnerUp?.score ?? 0)

  if (!decisive && runnerUp && margin < THRESHOLDS.MARGIN) {
    return {
      status: 'ambiguous',
      top: best,
      candidates,
      rejected: `${best.project.name} (${best.score}) and ${runnerUp.project.name} (${runnerUp.score}) are within ${THRESHOLDS.MARGIN} points`,
    }
  }

  const status = best.score >= THRESHOLDS.HIGH || decisive ? 'high' : 'medium'
  return { status, top: best, candidates, rejected: null }
}

/* ------------------------------------------------------- the whole corpus --
 * Build every recommendation once, memoised per model in ModelContext.
 */

export const STATUS_RANK = { high: 0, medium: 1, ambiguous: 2, none: 3 }

/**
 * @param {object} model  the derived model (conversations w/ searchText, projects,
 *                        links, relatedIndex, memories)
 * @param {object} opts   { dismissed: Set<`${chatUuid}::${projectUuid}`> }
 * @returns {{ byConversation, byProject, queue, stats }}
 */
export function buildRecommendations(model, { dismissed = new Set() } = {}) {
  const { conversations, projects, links, relatedIndex, memories } = model

  // Entity fingerprints, filtered to the DISTINCTIVE ones: an identifier is only
  // trustworthy if it's rare across the corpus. A product domain appears in a
  // handful of chats; a platform like linkedin.com appears everywhere and says
  // nothing about which project a chat belongs to.
  const entityDF = new Map()
  for (const c of conversations) {
    const es = extractEntities(c.searchText)
    for (const e of es) entityDF.set(e, (entityDF.get(e) || 0) + 1)
    c._entitiesRaw = es
  }
  const maxDF = Math.max(3, Math.min(THRESHOLDS.ENTITY_MAX_DF, Math.floor(conversations.length * 0.05)))
  for (const c of conversations) {
    c._entities = new Set([...c._entitiesRaw].filter((e) => entityDF.get(e) <= maxDF))
  }

  const matchers = buildMatchers(projects) // index-aligned with projects
  const profiles = buildProfiles({ projects, links, relatedIndex, memories, matchers })
  const termIndex = buildTermIndex(profiles)

  const byConversation = new Map()
  const byProject = new Map(projects.map((p) => [p.uuid, { high: [], medium: [], ambiguous: [] }]))
  const stats = { total: conversations.length, linked: 0, unlinked: 0, related: 0, high: 0, medium: 0, ambiguous: 0, none: 0 }

  for (const conv of conversations) {
    const existing = links?.byConversation?.get(conv.uuid)

    // Already in a project — you tagged it, or the export/name-match already
    // links it, so it shows up inside that folder. Recommending it there again
    // is noise; only chats with NO association at all are worth reviewing.
    if (existing) {
      stats.linked++
      continue
    }

    stats.unlinked++
    const chatVec = relatedIndex.vectors.get(conv.uuid)
    const title = normTitle(conv)
    const body = conv.searchText || ''
    const chatEntities = conv._entities ?? extractEntities(body)

    // Chat's strongest terms — drives both candidate generation and overlap.
    const chatTerms = new Set(
      chatVec ? [...chatVec.entries()].sort((a, b) => b[1] - a[1]).slice(0, THRESHOLDS.CHAT_TERMS).map(([t]) => t) : [],
    )

    // --- candidate generation: only projects that share a name hit, a term, or
    // a distinctive entity — never an all-pairs sweep.
    const candidateUuids = new Set()
    for (let i = 0; i < matchers.length; i++) {
      const m = matchers[i]
      if (m && nameEvidence(title, body, m)) candidateUuids.add(projects[i].uuid)
    }
    for (const term of chatTerms) {
      const owners = termIndex.get(term)
      if (owners) for (const uuid of owners) candidateUuids.add(uuid)
    }
    for (const e of chatEntities) {
      const owners = termIndex.get(`@${e}`)
      if (owners) for (const uuid of owners) candidateUuids.add(uuid)
    }

    // --- score, minus anything the user has explicitly rejected.
    let candidates = []
    for (const uuid of candidateUuids) {
      if (dismissed.has(`${conv.uuid}::${uuid}`)) continue
      const prof = profiles.get(uuid)
      if (!prof) continue
      candidates.push(scoreCandidate({ conv, chatVec, chatTerms, chatEntities, title, body, prof }))
    }
    candidates.sort((a, b) => b.score - a.score)
    candidates = candidates.slice(0, THRESHOLDS.MAX_CANDIDATES)

    const verdict = classify(candidates)
    const rec = { uuid: conv.uuid, ...verdict, thresholds: THRESHOLDS }
    byConversation.set(conv.uuid, rec)

    stats[rec.status]++
    if (rec.status !== 'none' && rec.top) {
      stats.related++
      byProject.get(rec.top.projectUuid)?.[rec.status].push(rec)
    }
  }

  // Review queue: everything worth a human look, best first.
  const queue = [...byConversation.values()]
    .filter((r) => r.status === 'high' || r.status === 'medium' || r.status === 'ambiguous')
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || (b.top?.score ?? 0) - (a.top?.score ?? 0))

  return { byConversation, byProject, queue, stats }
}

/** Project-level aggregation: recommendation counts per project, most first. */
export function projectRecommendationCounts(byProject, projectsById) {
  const rows = []
  for (const [uuid, buckets] of byProject) {
    const total = buckets.high.length + buckets.medium.length + buckets.ambiguous.length
    if (!total) continue
    rows.push({
      projectUuid: uuid,
      name: projectsById.get(uuid)?.name || 'Untitled project',
      total,
      high: buckets.high.length,
      medium: buckets.medium.length,
      ambiguous: buckets.ambiguous.length,
    })
  }
  return rows.sort((a, b) => b.total - a.total)
}
