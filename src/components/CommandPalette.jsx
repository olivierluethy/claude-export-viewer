/**
 * Global jump-to palette. Cmd/Ctrl-K anywhere, or `/` when not already typing.
 * Searches conversations, projects, design chats and memory files at once.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModel } from '../lib/ModelContext.jsx'
import { searchConversations } from '../lib/search.js'
import { titleOf, fmtDate } from '../lib/format.js'

const KIND_LABEL = { chat: 'chat', project: 'project', design: 'design', memory: 'memory' }

export default function CommandPalette() {
  const model = useModel()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setCursor(0)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === '/' && !typing && !open) {
        e.preventDefault()
        setOpen(true)
      } else if (e.key === 'Escape' && open) {
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  const results = useMemo(() => {
    const q = query.trim()
    if (q.length < 2) {
      return model.conversations.slice(0, 8).map((c) => ({
        kind: 'chat',
        key: c.uuid,
        to: `/chats/${c.uuid}`,
        title: titleOf(c),
        meta: fmtDate(c.updatedAtMs),
      }))
    }
    const lower = q.toLowerCase()
    const out = []

    for (const p of model.projects) {
      if (p.name?.toLowerCase().includes(lower)) {
        out.push({ kind: 'project', key: p.uuid, to: `/projects/${p.uuid}`, title: p.name, meta: 'project' })
      }
    }
    for (const d of model.designChats) {
      if (`${d.projectName} ${d.title}`.toLowerCase().includes(lower)) {
        out.push({
          kind: 'design',
          key: d.uuid,
          to: `/design/${d.uuid}`,
          title: `${d.projectName || d.title} · design chat`,
          meta: `${d.messages.length} messages`,
        })
      }
    }
    for (const f of model.memories?.files ?? []) {
      if (f.path.toLowerCase().includes(lower)) {
        out.push({ kind: 'memory', key: f.path, to: '/memories', title: f.name, meta: f.path })
      }
    }

    const chats = searchConversations({
      index: model.searchIndex,
      conversations: model.conversations,
      byId: model.conversationsById,
      query: q,
    }).slice(0, 12)

    for (const r of chats) {
      out.push({
        kind: 'chat',
        key: r.conversation.uuid,
        to: `/chats/${r.conversation.uuid}`,
        title: titleOf(r.conversation),
        meta: r.snippets[0]
          ? `${r.snippets[0].before}${r.snippets[0].match}${r.snippets[0].after}`.slice(0, 90)
          : fmtDate(r.conversation.updatedAtMs),
      })
    }
    return out.slice(0, 20)
  }, [query, model])

  useEffect(() => setCursor(0), [query])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  const go = (item) => {
    if (!item) return
    navigate(item.to)
    close()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(results[cursor])
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh] print:hidden"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--edge-strong)] bg-[var(--surface-raised)] shadow-2xl"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Jump to a chat, project or memory…"
          className="w-full border-b border-[var(--edge)] bg-transparent px-4 py-3.5 text-[14px] placeholder:text-[var(--text-dim)] focus:outline-none"
        />

        <ul ref={listRef} className="max-h-[52vh] overflow-y-auto py-1">
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-[13px] text-[var(--text-muted)]">
              Nothing matched “{query}”.
            </li>
          )}
          {results.map((item, i) => (
            <li key={`${item.kind}-${item.key}`}>
              <button
                data-active={i === cursor}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(item)}
                className={`flex w-full items-baseline gap-2.5 px-4 py-2 text-left transition ${
                  i === cursor ? 'bg-[var(--surface-high)]' : ''
                }`}
              >
                <span className="w-14 shrink-0 font-mono text-[10px] text-[var(--text-dim)]">
                  {KIND_LABEL[item.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{item.title}</span>
                  {item.meta && (
                    <span className="block truncate text-[11.5px] text-[var(--text-dim)]">{item.meta}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex gap-3 border-t border-[var(--edge)] px-4 py-2">
          <span className="rule-label">↑↓ move</span>
          <span className="rule-label">⏎ open</span>
          <span className="rule-label">esc close</span>
          <span className="rule-label ml-auto">⌘K / ctrl-K</span>
        </div>
      </div>
    </div>
  )
}
