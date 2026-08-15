/**
 * Shared formatting. Nothing here is fetched.
 *
 * Dates follow the format chosen in lib/prefs.js, NOT the operating system's
 * locale. Following the OS meant a Spanish-configured machine printed August as
 * "ago" inside an English interface, which reads as the English word "ago".
 */

import { dateLocale, isIsoFormat } from './prefs.js'

const pad = (n) => String(n).padStart(2, '0')
/** Local-time ISO date. `toISOString()` would shift by the UTC offset. */
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const isoClock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

export const titleOf = (conv) =>
  conv.name?.trim() || (conv.createdAtMs ? `Untitled — ${fmtDate(conv.createdAtMs)}` : 'Untitled conversation')

export const fmtNum = (n) => (n ?? 0).toLocaleString()

export function fmtDate(ms, opts = {}) {
  if (!ms) return '—'
  const d = new Date(ms)
  if (isIsoFormat()) return isoDay(d)
  return d.toLocaleDateString(dateLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...opts,
  })
}

export function fmtDateTime(ms) {
  if (!ms) return '—'
  const d = new Date(ms)
  if (isIsoFormat()) return `${isoDay(d)} ${isoClock(d)}`
  return d.toLocaleString(dateLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** Full, spelled-out date for tooltips — the unambiguous fallback. */
export function fmtDateLong(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleString(dateLocale(), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function fmtClock(ms) {
  if (!ms) return '--:--'
  return new Date(ms).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** "August 2026" (or "2026-08" under ISO) — month-group headers. */
export function fmtMonthYear(ms) {
  if (!ms) return '—'
  const d = new Date(ms)
  if (isIsoFormat()) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  return d.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' })
}

/** "Aug 15" (or "2026-08-15" under ISO) — day-group headers. */
export function fmtDayLabel(ms) {
  if (!ms) return '—'
  const d = new Date(ms)
  if (isIsoFormat()) return isoDay(d)
  return d.toLocaleDateString(dateLocale(), { month: 'short', day: 'numeric' })
}

/** Short weekday ("Sat"), for the day rail. */
export function fmtWeekday(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString(dateLocale(), { weekday: 'short' })
}

/**
 * Unambiguous relative age, spelled out: "today", "yesterday", "3 days ago",
 * "5 months ago". Always pair with an absolute date so it is never a guess.
 */
export function fmtAgo(ms) {
  if (!ms) return ''
  const s = (Date.now() - ms) / 1000
  if (s < 45) return 'just now'
  if (s < 5400) {
    const m = Math.round(s / 60)
    return m <= 1 ? 'a minute ago' : `${m} minutes ago`
  }
  const days = Math.floor(s / 86400)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.round(days / 30.44)
  if (months < 12) return months <= 1 ? 'a month ago' : `${months} months ago`
  const years = days / 365.25
  return years < 1.5 ? 'a year ago' : `${Math.round(years)} years ago`
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
