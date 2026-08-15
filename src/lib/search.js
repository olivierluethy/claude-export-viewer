/**
 * Search over the archive.
 *
 * Two layers, deliberately:
 *  - Fuse.js gives typo tolerance over the short, high-signal fields (title,
 *    summary, project names). It is NOT pointed at whole message bodies —
 *    fuzzy-matching 24 kB strings is both slow and noisy.
 *  - An exact, case-insensitive scan over message text finds occurrences inside
 *    threads and produces the highlighted snippets.
 *
 * Results are merged, so a typo still surfaces the thread by title while an
 * exact phrase still finds it by body.
 */

import Fuse from 'fuse.js'

export const FUSE_OPTIONS = {
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.4,
  minMatchCharLength: 2,
  keys: [
    { name: 'name', weight: 3 },
    { name: 'summary', weight: 1.5 },
    { name: 'head', weight: 1 },
  ],
}

/** Small, fuzzy-friendly documents — the first slice of each thread's text. */
export function buildFuseDocs(conversations) {
  return conversations.map((c) => ({
    uuid: c.uuid,
    name: c.name || '',
    summary: c.summary || '',
    head: (c.searchText || '').slice(0, 1200),
  }))
}

export function createIndex(conversations) {
  const docs = buildFuseDocs(conversations)
  return { fuse: new Fuse(docs, FUSE_OPTIONS), docs }
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Extracts up to `max` snippets around occurrences of `query`.
 * @returns {Array<{before, match, after, messageIndex, sender}>}
 */
export function findSnippets(conversation, query, max = 3, radius = 90) {
  if (!query || query.length < 2) return []
  const re = new RegExp(escapeRe(query), 'i')
  const out = []
  for (let i = 0; i < conversation.messages.length && out.length < max; i++) {
    const m = conversation.messages[i]
    const text = m.plain || m.fallbackText || ''
    if (!text) continue
    const hit = re.exec(text)
    if (!hit) continue
    const start = Math.max(0, hit.index - radius)
    const end = Math.min(text.length, hit.index + hit[0].length + radius)
    out.push({
      before: (start > 0 ? '…' : '') + text.slice(start, hit.index).replace(/\s+/g, ' '),
      match: hit[0],
      after: text.slice(hit.index + hit[0].length, end).replace(/\s+/g, ' ') + (end < text.length ? '…' : ''),
      messageIndex: i,
      sender: m.sender,
    })
  }
  return out
}

/** Total exact occurrences across a thread — used for ranking. */
function countOccurrences(conversation, query) {
  if (!query || query.length < 2) return 0
  const needle = query.toLowerCase()
  let n = 0
  const hay = (conversation.searchText || '').toLowerCase()
  let idx = hay.indexOf(needle)
  while (idx !== -1 && n < 50) {
    n++
    idx = hay.indexOf(needle, idx + needle.length)
  }
  return n
}

/**
 * @returns {Array<{conversation, score, snippets, exactHits, viaFuzzy}>}
 */
export function searchConversations({ index, conversations, byId, query }) {
  const q = query.trim()
  if (q.length < 2) return []

  const results = new Map()

  // Layer 1 — fuzzy over titles/summaries/heads.
  for (const r of index.fuse.search(q, { limit: 200 })) {
    const conversation = byId.get(r.item.uuid)
    if (!conversation) continue
    results.set(r.item.uuid, {
      conversation,
      // Fuse score: 0 is perfect. Invert to "higher is better".
      score: (1 - (r.score ?? 1)) * 2,
      viaFuzzy: true,
      exactHits: 0,
      snippets: [],
    })
  }

  // Layer 2 — exact occurrences anywhere in the thread.
  for (const c of conversations) {
    const hits = countOccurrences(c, q)
    if (!hits) continue
    const existing = results.get(c.uuid)
    const bonus = 1 + Math.min(hits, 20) * 0.15
    if (existing) {
      existing.exactHits = hits
      existing.score += bonus
    } else {
      results.set(c.uuid, { conversation: c, score: bonus, viaFuzzy: false, exactHits: hits, snippets: [] })
    }
  }

  const list = [...results.values()].sort((a, b) => b.score - a.score)
  // Snippets only for what will actually be shown — the scan is not free.
  for (const r of list.slice(0, 60)) r.snippets = findSnippets(r.conversation, q)
  return list
}

/* ------------------------------------------------------------------ filters */

export const EMPTY_FILTERS = {
  from: '',
  to: '',
  projectUuid: '',
  tool: '',
  language: '',
  sender: '',
  hasCode: false,
  hasAttachments: false,
}

export function filtersActive(f) {
  return (
    !!f.from ||
    !!f.to ||
    !!f.projectUuid ||
    !!f.tool ||
    !!f.language ||
    !!f.sender ||
    f.hasCode ||
    f.hasAttachments
  )
}

export function applyFilters(conversations, filters, links) {
  const fromMs = filters.from ? Date.parse(filters.from) : null
  const toMs = filters.to ? Date.parse(filters.to) + 86_400_000 : null

  return conversations.filter((c) => {
    const when = c.updatedAtMs ?? c.createdAtMs
    if (fromMs != null && (when == null || when < fromMs)) return false
    if (toMs != null && (when == null || when > toMs)) return false

    if (filters.projectUuid) {
      const link = links?.byConversation.get(c.uuid)
      if (!link || link.projectUuid !== filters.projectUuid) return false
    }
    if (filters.tool && !c.facets.tools.includes(filters.tool)) return false
    if (filters.language && !c.facets.languages.includes(filters.language)) return false
    if (filters.hasCode && !c.facets.hasCode) return false
    if (filters.hasAttachments && !c.facets.hasAttachments) return false
    if (filters.sender === 'human' && !c.facets.humanCount) return false
    if (filters.sender === 'assistant' && !c.facets.assistantCount) return false
    return true
  })
}

/** Facet values actually present in the corpus, with counts. */
export function collectFacets(conversations) {
  const tools = new Map()
  const languages = new Map()
  for (const c of conversations) {
    for (const t of c.facets.tools) tools.set(t, (tools.get(t) || 0) + 1)
    for (const l of c.facets.languages) languages.set(l, (languages.get(l) || 0) + 1)
  }
  const sort = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return { tools: sort(tools), languages: sort(languages) }
}
