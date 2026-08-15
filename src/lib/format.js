/** Shared formatting. Dates render in the viewer's locale; nothing is fetched. */

export const titleOf = (conv) =>
  conv.name?.trim() ||
  (conv.createdAtMs ? `Untitled — ${new Date(conv.createdAtMs).toLocaleDateString()}` : 'Untitled conversation')

export const fmtNum = (n) => (n ?? 0).toLocaleString()

export function fmtDate(ms, opts = {}) {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', ...opts })
}

export function fmtDateTime(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fmtClock(ms) {
  if (!ms) return '--:--'
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Relative age, for list rows: "3d", "5mo", "2y". */
export function fmtAge(ms) {
  if (!ms) return ''
  const s = (Date.now() - ms) / 1000
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  if (s < 2592000) return `${Math.round(s / 86400)}d`
  if (s < 31536000) return `${Math.round(s / 2592000)}mo`
  return `${(s / 31536000).toFixed(s < 63072000 ? 1 : 0)}y`
}

/**
 * Elapsed gap between two messages, printed on the time rail when the pause is
 * long enough to be worth seeing.
 */
export function fmtGap(ms) {
  const m = ms / 60000
  if (m < 60) return `${Math.round(m)} min`
  const h = m / 60
  if (h < 24) return `${h < 10 ? h.toFixed(1) : Math.round(h)} hr`
  const d = h / 24
  if (d < 30) return `${Math.round(d)} days`
  const mo = d / 30.44
  if (mo < 12) return `${Math.round(mo)} months`
  return `${(mo / 12).toFixed(1)} years`
}

/** Gaps shorter than this are just the pace of a conversation, not a break. */
export const GAP_THRESHOLD_MS = 20 * 60 * 1000

export function fmtBytes(n) {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Strips markdown syntax so previews read as prose. Summaries in this export
 * routinely start with "**Conversation Overview**", and the raw asterisks in a
 * list row are just noise.
 */
export function stripMarkdown(s) {
  return String(s || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(?=\S)(.*?)(?<=\S)\1/g, '$2')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Compact preview text for list rows. */
export function previewOf(conv) {
  const source =
    conv.summary?.trim() ||
    conv.messages.find((m) => m.sender === 'human' && m.plain.trim())?.plain ||
    conv.messages[0]?.plain ||
    ''
  return stripMarkdown(source).slice(0, 240)
}
