/**
 * The thread reader.
 *
 * Long threads are virtualised with dynamic measurement — some turns in this
 * corpus carry tens of kilobytes of tool output, so fixed row heights are not
 * an option. Short threads skip virtualisation entirely; the machinery costs
 * more than it saves below ~50 turns.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import MessageRow, { GapMarker } from './MessageRow.jsx'
import CopyButton from './ui/CopyButton.jsx'
import ProjectTagger from './ProjectTagger.jsx'
import RelatedPanel from './RelatedPanel.jsx'
import { fmtClock, fmtDate, fmtNum, stripMarkdown, titleOf, GAP_THRESHOLD_MS } from '../lib/format.js'
import { conversationToMarkdown } from '../lib/toMarkdown.js'
import { printDocument, setPrintOption, usePrintOptions, usePrinting } from '../lib/printing.js'
import { scrollWithin, useScrollSpy } from '../lib/useScrollSpy.js'
import { MarkdownViewContext } from './blocks/markdownView.js'

const VIRTUALIZE_ABOVE = 50

/** Interleaves gap markers between turns that are far apart in time. */
function buildRows(messages) {
  const rows = []
  let prevMs = null
  messages.forEach((m, i) => {
    if (prevMs != null && m.createdAtMs != null) {
      const delta = m.createdAtMs - prevMs
      if (delta >= GAP_THRESHOLD_MS) {
        rows.push({
          type: 'gap',
          key: `gap-${m.uuid}`,
          ms: delta,
          atMs: m.createdAtMs,
          crossesDay: new Date(prevMs).toDateString() !== new Date(m.createdAtMs).toDateString(),
        })
      }
    }
    if (m.createdAtMs != null) prevMs = m.createdAtMs
    rows.push({ type: 'message', key: m.uuid || `m-${i}`, message: m, index: i })
  })
  return rows
}

function Row({ row }) {
  return row.type === 'gap' ? (
    <GapMarker ms={row.ms} atMs={row.atMs} crossesDay={row.crossesDay} />
  ) : (
    <MessageRow message={row.message} index={row.index} />
  )
}

/** A one-line label for a turn in the outline. */
function turnPreview(message) {
  const text = stripMarkdown(message.plain || message.fallbackText || '')
  return text.slice(0, 70) || 'empty turn'
}

/**
 * Table of contents for a thread — one entry per turn you took, so the shape of
 * the conversation is visible and any point is one click away, without scrolling
 * to find it. The turn you're currently reading is marked.
 */
function TocRail({ outline, activeTurn, onJump }) {
  const navRef = useRef(null)
  useEffect(() => {
    const btn = navRef.current?.querySelector('[data-active="true"]')
    if (btn) scrollWithin(navRef.current, btn)
  }, [activeTurn])

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-l border-[var(--edge)] py-8 pr-4 pl-5 xl:flex print:hidden">
      <p className="rule-label mb-2">in this chat · {outline.length} turns</p>
      <nav ref={navRef} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
        {outline.map((o) => {
          const active = String(o.turnIndex) === String(activeTurn)
          return (
            <button
              key={o.turnIndex}
              data-active={active}
              onClick={() => onJump(o)}
              className={`flex w-full items-start gap-2 rounded px-1.5 py-1 text-left transition ${
                active ? 'bg-[var(--surface-high)]' : 'hover:bg-[var(--surface-high)]'
              }`}
            >
              <span
                className="mt-[3px] h-3 w-px shrink-0"
                style={{ background: active ? 'var(--human)' : 'transparent' }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[9.5px] text-[var(--text-dim)] tabular-nums">
                  {fmtClock(o.ms)}
                </span>
                <span
                  className={`block truncate text-[12px] leading-snug ${
                    active ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {o.preview}
                </span>
              </span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

/**
 * Summaries in this export run to full paragraphs — long enough to push the
 * first turn off screen. Clamped by default, with the full text one click away.
 */
function Summary({ text }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 260

  return (
    <div className="mt-3.5 border-l-2 border-[var(--edge-strong)] pl-3.5">
      <p
        className={`text-[13.5px] leading-relaxed text-[var(--text-muted)] print:line-clamp-none ${
          open || !long ? '' : 'line-clamp-3'
        }`}
      >
        {stripMarkdown(text)}
      </p>
      {long && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="rule-label mt-1 hover:text-[var(--text-muted)] print:hidden"
        >
          {open ? 'show less' : 'show full summary'}
        </button>
      )}
    </div>
  )
}

/** Opt-outs for the PDF. Tool output is the bulk of a long thread's page count. */
function PrintControls() {
  const opts = usePrintOptions()
  const items = [
    ['tools', 'tool output'],
    ['thinking', 'thinking'],
  ]
  return (
    <span className="flex items-center gap-2">
      {items.map(([key, label]) => (
        <label
          key={key}
          className="flex cursor-pointer items-center gap-1 font-mono text-[11px] text-[var(--text-muted)]"
          title={`Include ${label} in the printed PDF`}
        >
          <input
            type="checkbox"
            checked={opts[key]}
            onChange={(e) => setPrintOption(key, e.target.checked)}
            className="h-3 w-3 accent-[var(--human)]"
          />
          {label}
        </label>
      ))}
    </span>
  )
}

function Meta({ conversation }) {
  const f = conversation.facets
  const items = [
    `${fmtNum(f.messageCount)} messages`,
    `${fmtNum(f.humanCount)} you · ${fmtNum(f.assistantCount)} Claude`,
    f.tools.length ? `${f.tools.length} tool${f.tools.length > 1 ? 's' : ''}` : null,
    f.hasAttachments ? 'attachments' : null,
  ].filter(Boolean)

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="rule-label">
        {fmtDate(conversation.createdAtMs)}
        {conversation.updatedAtMs && conversation.updatedAtMs - conversation.createdAtMs > 864e5
          ? ` → ${fmtDate(conversation.updatedAtMs)}`
          : ''}
      </span>
      {items.map((t) => (
        <span key={t} className="rule-label before:mr-2.5 before:content-['·']">
          {t}
        </span>
      ))}
    </div>
  )
}

export default function ConversationDetail({ conversation }) {
  const rows = useMemo(() => buildRows(conversation.messages), [conversation])
  const printing = usePrinting()
  // Every turn must be on the page when printing, so virtualisation stands down.
  const virtualise = rows.length > VIRTUALIZE_ABOVE && !printing
  // The scroll container MUST be owned by this component. React attaches an
  // ancestor's ref only after descendant effects have run, so a ref handed down
  // from the route is still null when the virtualizer looks for its scroll
  // element — it then silently never attaches a scroll listener and the thread
  // freezes on the first screenful.
  const parentRef = useRef(null)
  const [mdView, setMdView] = useState('rendered')

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 240,
    overscan: 6,
    getItemKey: (i) => rows[i].key,
    enabled: virtualise,
  })

  // Jump back to the top when switching threads.
  useEffect(() => {
    if (parentRef.current) parentRef.current.scrollTop = 0
  }, [conversation.uuid])

  // Outline: one entry per turn you took (each starts an exchange).
  const outline = useMemo(() => {
    const out = []
    rows.forEach((r, rowIndex) => {
      if (r.type === 'message' && r.message.sender === 'human') {
        out.push({ rowIndex, turnIndex: r.index, ms: r.message.createdAtMs, preview: turnPreview(r.message) })
      }
    })
    return out
  }, [rows])

  const getScrollEl = useCallback(() => parentRef.current, [])
  const activeTurn = useScrollSpy(getScrollEl, '[data-spy]', { threshold: 96, deps: [conversation.uuid] })

  const jumpToTurn = useCallback(
    (o) => {
      if (!virtualise) {
        document.getElementById(`turn-${o.turnIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      // Virtualised: ask the virtualizer to bring the row in, then align precisely
      // once it has actually rendered (a few frames of grace).
      virtualizer.scrollToIndex(o.rowIndex, { align: 'start' })
      let tries = 0
      const align = () => {
        const el = document.getElementById(`turn-${o.turnIndex}`)
        if (el) el.scrollIntoView({ block: 'start' })
        else if (tries++ < 8) requestAnimationFrame(align)
      }
      requestAnimationFrame(align)
    },
    [virtualise, virtualizer],
  )

  const items = virtualizer.getVirtualItems()

  return (
    <MarkdownViewContext.Provider value={mdView}>
    <div className="flex h-full">
    <div ref={parentRef} className="h-full min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 pt-8 pb-24">
      <header className="mb-7 border-b border-[var(--edge)] pb-5">
        <h1 className="font-serif text-[1.65rem] leading-tight font-semibold tracking-tight text-balance">
          {titleOf(conversation)}
        </h1>
        <div className="mt-2.5">
          <Meta conversation={conversation} />
        </div>

        {conversation.summary?.trim() && <Summary text={conversation.summary.trim()} />}

        {conversation.facets.tools.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {conversation.facets.tools.map((t) => (
              <span
                key={t}
                className="rounded border border-[var(--edge)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--text-muted)]"
              >
                {t}
              </span>
            ))}
            {conversation.facets.languages.map((l) => (
              <span
                key={l}
                className="rounded border border-[var(--edge)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--human)]"
              >
                {l}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
          <CopyButton
            getText={() => conversationToMarkdown(conversation)}
            label="Copy chat as markdown"
            copiedLabel="Chat copied"
            title="Copy the whole thread as markdown"
          />
          {/* View prose as formatted markdown, or as its raw source. */}
          <span className="inline-flex overflow-hidden rounded-md border border-[var(--edge)]">
            {[
              ['rendered', 'rendered'],
              ['source', 'markdown'],
            ].map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setMdView(mode)}
                title={mode === 'source' ? 'Show the raw markdown source' : 'Show formatted markdown'}
                className={`px-2 py-1 font-mono text-[11px] transition ${
                  mdView === mode
                    ? 'bg-[var(--surface-high)] text-[var(--human)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </span>
          <PrintControls />
          <button
            onClick={printDocument}
            title="Opens your browser's print dialog — choose “Save as PDF”"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--edge)] px-2 py-1 font-mono text-[11px] tracking-wide text-[var(--text-muted)] transition hover:border-[var(--edge-strong)] hover:text-[var(--text)]"
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 9V3h10v6M7 19H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="7" y="15" width="10" height="6" />
            </svg>
            Save as PDF
          </button>
        </div>

        <ProjectTagger conversation={conversation} />
      </header>

      {virtualise ? (
        <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          <div
            className="absolute top-0 left-0 w-full"
            style={{ transform: `translateY(${items[0]?.start ?? 0}px)` }}
          >
            {items.map((vi) => {
              const row = rows[vi.index]
              const human = row.type === 'message' && row.message.sender === 'human'
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  id={human ? `turn-${row.index}` : undefined}
                  data-spy={human ? row.index : undefined}
                  className={human ? 'scroll-mt-4' : undefined}
                >
                  <Row row={row} />
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        rows.map((row) => {
          const human = row.type === 'message' && row.message.sender === 'human'
          return (
            <div
              key={row.key}
              id={human ? `turn-${row.index}` : undefined}
              data-spy={human ? row.index : undefined}
              className={human ? 'scroll-mt-4' : undefined}
            >
              <Row row={row} />
            </div>
          )
        })
      )}

        <RelatedPanel conversation={conversation} />
      </div>
    </div>
    {outline.length > 1 && <TocRail outline={outline} activeTurn={activeTurn} onJump={jumpToTurn} />}
    </div>
    </MarkdownViewContext.Provider>
  )
}
