/**
 * The outline model behind the table of contents, shared by every chat view.
 *
 * A chat becomes a dated outline: day groups → one entry per turn (who spoke,
 * when, a one-line preview) → the assistant's own H1–H3 headings nested beneath
 * the turn that contains them. Nothing here touches the DOM or React — it is a
 * pure transform, rebuilt whenever the displayed chat changes.
 *
 * Anchors are supplied by the caller, not invented here: each turn carries an
 * `anchorId`, and each prose segment a `base`. Heading ids are composed as
 * `${base}-h${n}` in document order, which is exactly how <Markdown anchorBase>
 * numbers the headings it renders — so the two always agree.
 */

import { fmtDayLabel, stripMarkdown } from './format.js'

/**
 * H1–H3 in document order, ignoring anything inside a fenced code block.
 * ATX only (`#`, `##`, `###`) — the form assistant markdown actually uses.
 * @returns {{ level: number, text: string }[]}
 */
export function extractHeadings(md) {
  const out = []
  let fence = ''
  for (const line of String(md || '').split('\n')) {
    const f = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (f) {
      const marker = f[1][0]
      if (!fence) fence = marker
      else if (marker === fence) fence = ''
      continue
    }
    if (fence) continue
    const h = line.match(/^\s{0,3}(#{1,3})\s+(.+?)\s*#*\s*$/)
    if (h) out.push({ level: h[1].length, text: stripMarkdown(h[2]) })
  }
  return out
}

/**
 * @typedef {Object} OutlineTurn
 * @property {string} anchorId        DOM id of the turn container ('turn-…')
 * @property {'human'|'assistant'} role
 * @property {string} roleLabel       what the view calls this speaker
 * @property {number|null} ms         message timestamp
 * @property {string} preview         one-line, markdown stripped
 * @property {{ base: string, text: string }[]} proseSegments  rendered elsewhere
 */

/**
 * Group turns under date headers and attach nested heading sub-entries.
 * @param {OutlineTurn[]} turns
 * @returns {{ key: string, label: string, ms: number|null, turns: object[] }[]}
 */
export function buildChatOutline(turns) {
  const groups = []
  let current = null

  for (const t of turns) {
    const headings = []
    for (const seg of t.proseSegments || []) {
      extractHeadings(seg.text).forEach((h, i) => {
        headings.push({ ...h, anchorId: `${seg.base}-h${i}` })
      })
    }

    const entry = {
      anchorId: t.anchorId,
      role: t.role,
      roleLabel: t.roleLabel,
      ms: t.ms ?? null,
      preview: t.preview,
      headings,
    }

    const dayKey = t.ms != null ? new Date(t.ms).toDateString() : 'undated'
    if (!current || current.key !== dayKey) {
      current = { key: dayKey, label: t.ms != null ? fmtDayLabel(t.ms) : 'Undated', ms: t.ms ?? null, turns: [] }
      groups.push(current)
    }
    current.turns.push(entry)
  }

  return groups
}
