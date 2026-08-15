/**
 * The thread index. Virtualised — 280 rows today, but the same list carries
 * search results later and should not care how many there are.
 */

import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { NavLink } from 'react-router-dom'
import { fmtAge, fmtDateLong, fmtNum, previewOf, titleOf } from '../lib/format.js'

const ROW_HEIGHT = 92

function Marks({ facets }) {
  const marks = []
  if (facets.hasCode) marks.push(['code', 'var(--human)'])
  if (facets.tools.length) marks.push([`${facets.tools.length} tools`, 'var(--assistant)'])
  if (facets.hasAttachments) marks.push(['files', 'var(--text-dim)'])
  return (
    <div className="flex shrink-0 gap-1.5">
      {marks.map(([label, color]) => (
        <span key={label} className="font-mono text-[10px] tracking-wide" style={{ color }}>
          {label}
        </span>
      ))}
    </div>
  )
}

function Row({ conversation, to }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block border-b border-[var(--edge)] px-4 py-3 transition-colors ${
          isActive ? 'bg-[var(--surface-high)]' : 'hover:bg-[var(--surface-raised)]'
        }`
      }
    >
      {({ isActive }) => (
        <div className="flex gap-3">
          <span
            className="mt-1.5 h-[3px] w-[3px] shrink-0 rounded-full transition-colors"
            style={{ background: isActive ? 'var(--human)' : 'var(--edge-strong)' }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{titleOf(conversation)}</h3>
              <span
                className="shrink-0 font-mono text-[10.5px] text-[var(--text-dim)] tabular-nums"
                title={`Last active: ${fmtDateLong(conversation.updatedAtMs)}`}
              >
                {fmtAge(conversation.updatedAtMs)}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[12px] leading-[1.5] text-[var(--text-muted)]">
              {previewOf(conversation)}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-mono text-[10px] text-[var(--text-dim)] tabular-nums">
                {fmtNum(conversation.facets.messageCount)} msg
              </span>
              <Marks facets={conversation.facets} />
            </div>
          </div>
        </div>
      )}
    </NavLink>
  )
}

export default function ConversationList({ conversations, basePath = '/chats', header }) {
  const parentRef = useRef(null)
  const virtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (i) => conversations[i].uuid,
  })

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="px-4 py-8 text-[13px] text-[var(--text-muted)]">
            No conversations match. Try a broader search or clear the filters.
          </p>
        ) : (
          <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((vi) => (
              <div
                key={vi.key}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full"
                style={{ transform: `translateY(${vi.start}px)` }}
              >
                <Row conversation={conversations[vi.index]} to={`${basePath}/${conversations[vi.index].uuid}`} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
