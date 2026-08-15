/**
 * A timestamp that is never a guess: an absolute date the reader can trust, with
 * the relative age beside or under it. Solves the "ago 26" problem — a relative
 * label alone is ambiguous, so it always travels with the real date.
 *
 * `layout="inline"` → "Aug 20, 2026 · 3 days ago" on one line.
 * `layout="stacked"` → absolute on top, muted relative under it.
 */

import { fmtAgo, fmtDate, fmtDateLong, fmtDateTime } from '../../lib/format.js'

export default function RelativeTime({ ms, layout = 'inline', withTime = false, className = '' }) {
  if (!ms) return <span className={className}>—</span>
  const absolute = withTime ? fmtDateTime(ms) : fmtDate(ms)
  const ago = fmtAgo(ms)

  if (layout === 'stacked') {
    return (
      <span className={`inline-flex flex-col leading-tight ${className}`} title={fmtDateLong(ms)}>
        <span className="tabular-nums">{absolute}</span>
        <span className="text-[10.5px] text-[var(--text-dim)]">{ago}</span>
      </span>
    )
  }

  return (
    <span className={className} title={fmtDateLong(ms)}>
      <span className="tabular-nums">{absolute}</span>
      <span className="text-[var(--text-dim)]"> · {ago}</span>
    </span>
  )
}
