/**
 * Shared vocabulary for relationship confidence — a recommendation's status, its
 * score, and the evidence behind it. One place so the review page, the per-chat
 * tagger and the related panel all read identically (see docs/STYLEGUIDE.md §7).
 *
 * Colour follows the established confidence inks: ochre = your own decision,
 * drafting blue = a confident machine match, muted/dim + dashed = rising
 * uncertainty. No new hues.
 */

/** status -> label + tone classes (border/text) + fill token for the meter. */
export const REC_STATUS = {
  confirmed: { label: 'confirmed', tone: 'text-[var(--human)] border-[var(--human)]/40', fill: 'var(--human)' },
  high: { label: 'high confidence', tone: 'text-[var(--assistant)] border-[var(--assistant)]/40', fill: 'var(--assistant)' },
  medium: { label: 'likely', tone: 'text-[var(--text-muted)] border-[var(--edge-strong)]', fill: 'var(--text-muted)' },
  ambiguous: {
    label: 'ambiguous',
    tone: 'text-[var(--text-dim)] border-dashed border-[var(--edge-strong)]',
    fill: 'var(--text-dim)',
  },
  none: { label: 'no match', tone: 'text-[var(--text-dim)] border-[var(--edge)]', fill: 'var(--text-dim)' },
}

export function RecBadge({ status, className = '' }) {
  const s = REC_STATUS[status]
  if (!s) return null
  return (
    <span className={`shrink-0 rounded border px-1.5 py-px font-mono text-[10px] ${s.tone} ${className}`}>
      {s.label}
    </span>
  )
}

/**
 * A thin score bar, 0–100, coloured by status. Identity is never colour alone —
 * the numeric score sits beside it.
 */
export function ConfidenceMeter({ score, status = 'medium', showValue = true }) {
  const s = REC_STATUS[status] ?? REC_STATUS.medium
  const pct = Math.max(0, Math.min(100, score ?? 0))
  return (
    <span className="flex items-center gap-2" title={`Confidence score ${Math.round(pct)} / 100`}>
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
        <span
          className="block h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%`, background: s.fill }}
        />
      </span>
      {showValue && (
        <span className="font-mono text-[10.5px] text-[var(--text-muted)] tabular-nums">{Math.round(pct)}</span>
      )}
    </span>
  )
}

/**
 * The signals that produced a score, strongest first, each with its point
 * contribution. This is the explainability surface — it reads straight from the
 * engine's `evidence[]`, so any new signal appears here automatically.
 */
export function EvidenceList({ evidence, max = 6 }) {
  if (!evidence?.length) return null
  const maxPts = Math.max(...evidence.map((e) => e.points), 1)
  return (
    <ul className="space-y-1.5">
      {evidence.slice(0, max).map((e) => (
        <li key={e.key} className="flex items-center gap-2.5">
          <span className="w-40 shrink-0 text-[12px] text-[var(--text-muted)]">{e.label}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <span
              className="block h-full rounded-full bg-[var(--assistant)]/70"
              style={{ width: `${Math.max(4, (e.points / maxPts) * 100)}%` }}
            />
          </span>
          <span className="w-8 shrink-0 text-right font-mono text-[10.5px] text-[var(--text-dim)] tabular-nums">
            +{Math.round(e.points)}
          </span>
          {e.detail && <span className="min-w-0 basis-full pl-[10.5rem] text-[11.5px] text-[var(--text-dim)]">{e.detail}</span>}
        </li>
      ))}
    </ul>
  )
}
