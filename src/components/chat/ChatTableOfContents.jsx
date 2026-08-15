/**
 * The reader's outline — a permanent right-hand fixture of every chat view.
 *
 * A dated table of contents built from the turns of the chat: each turn shows
 * who spoke, when, and a one-line preview, with the assistant's own headings
 * nested beneath. It tracks the reader (scroll-spy marks the turn in view) and
 * jumps anywhere on click. On wide screens it's a sticky rail; below that it
 * folds into a drawer so it never simply vanishes.
 *
 * The visual language is the app's own: the ruled tick coloured by speaker
 * (ochre = you, drafting blue = Claude), monospace clock times, small-caps
 * date labels — the same time-rail grammar the threads themselves use.
 */

import { useEffect, useRef, useState } from 'react'
import { fmtClock } from '../../lib/format.js'
import { scrollWithin } from '../../lib/useScrollSpy.js'

const INK = { human: 'var(--human)', assistant: 'var(--assistant)' }
const HEADING_INDENT = { 1: 'pl-[1.35rem]', 2: 'pl-[1.9rem]', 3: 'pl-[2.45rem]' }

/** True when the active anchor is this turn, or a heading inside it. */
const turnActive = (id, anchorId) => id === anchorId || (id != null && id.startsWith(`${anchorId}-`))

function TocList({ groups, activeId, onJump }) {
  const navRef = useRef(null)

  // Keep the marked entry visible in the outline as the reader scrolls the chat.
  useEffect(() => {
    const el = navRef.current?.querySelector('[data-active="true"]')
    if (el) scrollWithin(navRef.current, el)
  }, [activeId])

  return (
    <nav ref={navRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
      {groups.map((g) => (
        <div key={g.key}>
          <p className="rule-label sticky top-0 z-10 bg-[var(--surface-raised)] py-1">{g.label}</p>
          <div className="space-y-0.5">
            {g.turns.map((t) => {
              const active = turnActive(activeId, t.anchorId)
              return (
                <div key={t.anchorId}>
                  <button
                    data-active={active}
                    onClick={() => onJump(t.anchorId, t.anchorId)}
                    className={`flex w-full items-start gap-2 rounded px-1.5 py-1 text-left transition ${
                      active ? 'bg-[var(--surface-high)]' : 'hover:bg-[var(--surface-high)]'
                    }`}
                  >
                    <span
                      className="mt-[3px] h-3 w-px shrink-0"
                      style={{ background: INK[t.role], opacity: active ? 1 : 0.55 }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[9.5px] tabular-nums text-[var(--text-dim)]">
                        {t.roleLabel}
                        {t.ms != null ? ` · ${fmtClock(t.ms)}` : ''}
                      </span>
                      <span
                        className={`block truncate text-[12px] leading-snug ${
                          active ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {t.preview}
                      </span>
                    </span>
                  </button>

                  {t.headings.map((h) => {
                    const on = activeId === h.anchorId
                    return (
                      <button
                        key={h.anchorId}
                        data-active={on}
                        onClick={() => onJump(h.anchorId, t.anchorId)}
                        className={`flex w-full items-start gap-1.5 rounded py-0.5 pr-1.5 text-left transition ${
                          HEADING_INDENT[h.level] || HEADING_INDENT[3]
                        } ${on ? 'bg-[var(--surface-high)]' : 'hover:bg-[var(--surface-high)]'}`}
                      >
                        <span
                          className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full"
                          style={{ background: 'var(--text-dim)' }}
                          aria-hidden
                        />
                        <span
                          className={`min-w-0 flex-1 truncate text-[11px] leading-snug ${
                            on ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'
                          }`}
                        >
                          {h.text}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

export default function ChatTableOfContents({ groups, activeId, onJump, turnCount }) {
  const [open, setOpen] = useState(false)
  if (!groups.length) return null

  const heading = <p className="rule-label mb-2 shrink-0">in this chat · {turnCount} turns</p>

  return (
    <>
      {/* Wide screens: a sticky rail that shares the thread's right edge. */}
      <aside className="hidden w-56 shrink-0 flex-col border-l border-[var(--edge)] py-8 pr-4 pl-5 xl:flex print:hidden">
        {heading}
        <TocList groups={groups} activeId={activeId} onJump={onJump} />
      </aside>

      {/* Narrow screens: a drawer, so the outline is one tap away, never gone. */}
      <div className="xl:hidden print:hidden">
        <button
          onClick={() => setOpen(true)}
          title="Show the chat outline"
          className="fixed right-4 bottom-4 z-30 inline-flex items-center gap-1.5 rounded-full border border-[var(--edge-strong)] bg-[var(--surface-raised)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--text-muted)] shadow-lg transition hover:text-[var(--text)]"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
          </svg>
          Contents
        </button>

        {open && (
          <div className="fixed inset-0 z-40">
            <div className="absolute inset-0 bg-[var(--surface-sunken)]/70 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
            <aside className="absolute top-0 right-0 bottom-0 flex w-72 max-w-[85vw] flex-col border-l border-[var(--edge)] bg-[var(--surface-raised)] py-6 pr-3 pl-5">
              <div className="mb-2 flex shrink-0 items-baseline justify-between pr-1">
                {heading}
                <button
                  onClick={() => setOpen(false)}
                  className="rule-label hover:text-[var(--text)]"
                  title="Close the outline"
                >
                  close
                </button>
              </div>
              <TocList
                groups={groups}
                activeId={activeId}
                onJump={(anchorId, fallbackId) => {
                  onJump(anchorId, fallbackId)
                  setOpen(false)
                }}
              />
            </aside>
          </div>
        )}
      </div>
    </>
  )
}
