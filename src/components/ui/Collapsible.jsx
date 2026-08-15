import { useState } from 'react'
import { usePrinting } from '../../lib/printing.js'

/**
 * Collapsed content is not rendered at all until opened — tool results in this
 * corpus routinely run to tens of kilobytes, and mounting them all would make
 * long threads crawl.
 *
 * Print mode is the one exception: it must contain the full record, so the
 * children mount while `printing` is true and unmount again afterwards. Doing
 * this with CSS instead (rendering hidden children with `print:block`) would
 * mount everything all the time and silently undo the optimisation.
 */
export default function Collapsible({ summary, defaultOpen = false, children, tone = 'neutral', dense = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const printing = usePrinting()
  const expanded = open || printing

  const toneRing =
    tone === 'error'
      ? 'border-red-500/35 bg-red-500/[0.06]'
      : tone === 'thinking'
        ? 'border-[var(--edge)] bg-[var(--surface-sunken)]'
        : 'border-[var(--edge)] bg-[var(--surface-raised)]'

  return (
    <div data-print-expand className={`overflow-hidden rounded-lg border ${toneRing}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={expanded}
        className={`flex w-full items-center gap-2 text-left transition hover:bg-[var(--surface-high)] ${
          dense ? 'px-2.5 py-1.5' : 'px-3 py-2'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-3 w-3 shrink-0 text-[var(--text-dim)] transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="min-w-0 flex-1">{summary}</div>
      </button>
      {expanded && <div className="border-t border-[var(--edge)]">{children}</div>}
    </div>
  )
}
