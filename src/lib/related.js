/**
 * "Related chats", by local heuristic.
 *
 * There is no embedding model available offline, so this is NOT semantic
 * similarity and the UI must not imply that it is. It combines four signals
 * that are cheap and honest:
 *
 *   1. shared distinctive terms   (TF-IDF over the corpus)   — weight 0.60
 *   2. same project               (inferred or tagged)       — weight 0.15
 *   3. shared tools and languages                            — weight 0.15
 *   4. temporal proximity                                    — weight 0.10
 *
 * Each result carries the reasons that fired, so you can judge it yourself.
 */

// Bilingual corpus (German/English), so both stoplists are needed.
const STOP = new Set(
  `the a an and or but if then than that this these those with without for from into onto of to in on at by as is
   are was were be been being do does did done have has had having will would can could should may might must not
   no yes it its it's you your yours i me my mine we our ours they them their he she his her what which who whom
   how when where why all any both each few more most other some such only own same so too very just also about
   after before again further once here there when why how any because while during above below up down out off
   over under how much many
   der die das dem den des ein eine einen einem eines einer und oder aber wenn dann als dass dieser diese dieses
   mit ohne für von zu im in auf an bei ist sind war waren sein wird werden kann können soll sollen muss müssen
   nicht kein keine ich du er sie es wir ihr mein dein was welche wer wie wann wo warum alle jeder mehr auch nur
   sehr schon noch mal dann dabei damit dafür hier dort über unter aus nach vor durch um beim zum zur
   claude chat message user assistant code file files project`
    .split(/\s+/)
    .filter(Boolean),
)

const TOKEN_RE = /[\p{L}][\p{L}\p{N}_-]{2,}/gu
const TOP_TERMS = 40
const TEXT_CAP = 12000

/**
 * Bag-of-terms for a piece of text: term -> frequency, stoplisted and length
 * bounded. Exported so the project-recommendation engine tokenises project
 * metadata with exactly the same rules the relatedness index uses.
 */
export function tokenize(text) {
  const counts = new Map()
  const slice = String(text || '').slice(0, TEXT_CAP).toLowerCase()
  for (const m of slice.matchAll(TOKEN_RE)) {
    const t = m[0]
    if (t.length < 3 || t.length > 28 || STOP.has(t)) continue
    counts.set(t, (counts.get(t) || 0) + 1)
  }
  return counts
}

/**
 * Builds the TF-IDF model plus an inverted index. One pass over the corpus;
 * memoise this per model, not per render.
 */
export function buildRelatednessIndex(conversations) {
  const docs = new Map() // uuid -> Map(term -> tf)
  const df = new Map()

  for (const c of conversations) {
    const tf = tokenize(`${c.name} ${c.name} ${c.summary} ${c.searchText}`)
    docs.set(c.uuid, tf)
    for (const term of tf.keys()) df.set(term, (df.get(term) || 0) + 1)
  }

  const N = conversations.length || 1
  const vectors = new Map() // uuid -> Map(term -> weight), top terms only
  const inverted = new Map() // term -> [uuid]

  for (const [uuid, tf] of docs) {
    const scored = []
    for (const [term, freq] of tf) {
      const d = df.get(term) || 1
      // Terms in almost every conversation carry no signal.
      if (d > N * 0.4) continue
      scored.push([term, (1 + Math.log(freq)) * Math.log(N / d)])
    }
    scored.sort((a, b) => b[1] - a[1])
    const top = scored.slice(0, TOP_TERMS)
    const norm = Math.sqrt(top.reduce((s, [, w]) => s + w * w, 0)) || 1
    const vec = new Map(top.map(([t, w]) => [t, w / norm]))
    vectors.set(uuid, vec)
    for (const term of vec.keys()) {
      if (!inverted.has(term)) inverted.set(term, [])
      inverted.get(term).push(uuid)
    }
  }

  return { vectors, inverted }
}

const WEEK = 7 * 86_400_000

/**
 * @returns {Array<{conversation, score, reasons: string[]}>}
 */
export function findRelated({ conversation, conversations, byId, index, links, limit = 6 }) {
  const vec = index.vectors.get(conversation.uuid)
  if (!vec) return []

  const termScores = new Map()
  const sharedTerms = new Map()

  for (const [term, weight] of vec) {
    const bucket = index.inverted.get(term)
    if (!bucket || bucket.length > conversations.length * 0.4) continue
    for (const otherUuid of bucket) {
      if (otherUuid === conversation.uuid) continue
      const otherWeight = index.vectors.get(otherUuid)?.get(term) ?? 0
      if (!otherWeight) continue
      termScores.set(otherUuid, (termScores.get(otherUuid) || 0) + weight * otherWeight)
      if (!sharedTerms.has(otherUuid)) sharedTerms.set(otherUuid, [])
      const list = sharedTerms.get(otherUuid)
      if (list.length < 4) list.push(term)
    }
  }

  const myProject = links?.byConversation.get(conversation.uuid)?.projectUuid ?? null
  const myTools = new Set(conversation.facets.tools)
  const myLangs = new Set(conversation.facets.languages)
  const myWhen = conversation.updatedAtMs ?? conversation.createdAtMs

  const out = []
  for (const [uuid, termSim] of termScores) {
    const other = byId.get(uuid)
    if (!other) continue

    const reasons = []
    let score = termSim * 0.6
    const terms = sharedTerms.get(uuid) ?? []
    if (terms.length) reasons.push(`shares ${terms.slice(0, 3).map((t) => `“${t}”`).join(', ')}`)

    const otherProject = links?.byConversation.get(uuid)?.projectUuid ?? null
    if (myProject && otherProject === myProject) {
      score += 0.15
      reasons.push('same project')
    }

    const sharedTools = other.facets.tools.filter((t) => myTools.has(t))
    const sharedLangs = other.facets.languages.filter((l) => myLangs.has(l))
    if (sharedTools.length || sharedLangs.length) {
      const overlap = (sharedTools.length + sharedLangs.length) / 8
      score += Math.min(0.15, overlap * 0.15)
      const bits = [...sharedLangs.slice(0, 2), ...sharedTools.slice(0, 2)]
      if (bits.length) reasons.push(`also uses ${bits.join(', ')}`)
    }

    const otherWhen = other.updatedAtMs ?? other.createdAtMs
    if (myWhen && otherWhen) {
      const weeks = Math.abs(myWhen - otherWhen) / WEEK
      if (weeks <= 2) {
        score += 0.1 * (1 - weeks / 2)
        reasons.push(weeks < 1 ? 'same week' : 'within a fortnight')
      }
    }

    if (score > 0.04) out.push({ conversation: other, score, reasons })
  }

  out.sort((a, b) => b.score - a.score)
  return out.slice(0, limit)
}
