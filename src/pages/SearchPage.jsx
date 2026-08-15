/**
 * Search: fuzzy over titles and summaries, exact over message bodies, with
 * combinable filters. Results show the matched snippet with the query marked,
 * because seeing *why* something matched is most of the value.
 */

import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useModel } from '../lib/ModelContext.jsx'
import { applyFilters, EMPTY_FILTERS, filtersActive, searchConversations } from '../lib/search.js'
import { fmtDate, fmtNum, previewOf, titleOf } from '../lib/format.js'
import { ConfidenceBadge } from './ProjectsPage.jsx'

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="rule-label">{label}</span>
      {children}
    </label>
  )
}

const selectCls =
  'rounded-md border border-[var(--edge)] bg-[var(--surface-raised)] px-2 py-1.5 text-[12.5px] text-[var(--text)] focus:border-[var(--edge-strong)]'

function Snippet({ snippet }) {
  return (
    <p className="mt-1 text-[12px] leading-[1.55] text-[var(--text-muted)]">
      <span
        className="mr-1.5 font-mono text-[10px]"
        style={{ color: snippet.sender === 'human' ? 'var(--human)' : 'var(--assistant)' }}
      >
        {snippet.sender === 'human' ? 'you' : 'claude'}
      </span>
      {snippet.before}
      <mark className="rounded-[2px] bg-[var(--human)]/25 px-0.5 text-[var(--text)]">{snippet.match}</mark>
      {snippet.after}
    </p>
  )
}

export default function SearchPage() {
  const model = useModel()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') || '')
  const deferredQuery = useDeferredValue(query)

  // Filters live in the URL so a chart click, a shared link and the back button
  // all land on the same result set.
  const PARAM = {
    from: 'from',
    to: 'to',
    projectUuid: 'project',
    tool: 'tool',
    language: 'language',
    sender: 'sender',
  }

  const filters = useMemo(
    () => ({
      ...EMPTY_FILTERS,
      from: params.get('from') || '',
      to: params.get('to') || '',
      projectUuid: params.get('project') || '',
      tool: params.get('tool') || '',
      language: params.get('language') || '',
      sender: params.get('sender') || '',
      hasCode: params.get('code') === '1',
      hasAttachments: params.get('files') === '1',
    }),
    [params],
  )

  const writeParams = (mutate) => {
    const next = new URLSearchParams(params)
    mutate(next)
    setParams(next, { replace: true })
  }

  const setFilter = (key, value) => {
    const name = PARAM[key] ?? (key === 'hasCode' ? 'code' : 'files')
    writeParams((next) => {
      const encoded = typeof value === 'boolean' ? (value ? '1' : '') : value
      if (encoded) next.set(name, encoded)
      else next.delete(name)
    })
  }

  const setFilters = () =>
    writeParams((next) => {
      for (const n of ['from', 'to', 'project', 'tool', 'language', 'sender', 'code', 'files']) next.delete(n)
    })

  const filtered = useMemo(
    () => applyFilters(model.conversations, filters, model.links),
    [model.conversations, model.links, filters],
  )

  const results = useMemo(() => {
    const q = deferredQuery.trim()
    if (q.length < 2) {
      return filtersActive(filters)
        ? filtered.map((c) => ({ conversation: c, score: 0, snippets: [], exactHits: 0 }))
        : []
    }
    const allowed = new Set(filtered.map((c) => c.uuid))
    return searchConversations({
      index: model.searchIndex,
      conversations: filtered,
      byId: model.conversationsById,
      query: q,
    }).filter((r) => allowed.has(r.conversation.uuid))
  }, [deferredQuery, filtered, filters, model.searchIndex, model.conversationsById])

  const showing = deferredQuery.trim().length >= 2 || filtersActive(filters)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-9">
        <p className="rule-label">Search</p>
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            writeParams((next) => (e.target.value ? next.set('q', e.target.value) : next.delete('q')))
          }}
          placeholder="Search everything — titles, summaries, message text"
          className="mt-2 w-full border-b border-[var(--edge-strong)] bg-transparent pb-2.5 font-serif text-[1.6rem] tracking-tight placeholder:text-[var(--text-dim)] focus:border-[var(--human)] focus:outline-none"
        />

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <Field label="from">
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilter('from', e.target.value)}
              className={selectCls}
            />
          </Field>
          <Field label="to">
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilter('to', e.target.value)}
              className={selectCls}
            />
          </Field>
          <Field label="project">
            <select
              value={filters.projectUuid}
              onChange={(e) => setFilter('projectUuid', e.target.value)}
              className={selectCls}
            >
              <option value="">any</option>
              {model.projects.map((p) => (
                <option key={p.uuid} value={p.uuid}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="tool">
            <select value={filters.tool} onChange={(e) => setFilter('tool', e.target.value)} className={selectCls}>
              <option value="">any</option>
              {model.facets.tools.map(([t, n]) => (
                <option key={t} value={t}>
                  {t} ({n})
                </option>
              ))}
            </select>
          </Field>
          <Field label="language">
            <select
              value={filters.language}
              onChange={(e) => setFilter('language', e.target.value)}
              className={selectCls}
            >
              <option value="">any</option>
              {model.facets.languages.map(([l, n]) => (
                <option key={l} value={l}>
                  {l} ({n})
                </option>
              ))}
            </select>
          </Field>

          <button
            onClick={() => setFilter('hasCode', !filters.hasCode)}
            className={`rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition ${
              filters.hasCode
                ? 'border-[var(--human)]/50 text-[var(--human)]'
                : 'border-[var(--edge)] text-[var(--text-muted)]'
            }`}
          >
            has code
          </button>
          <button
            onClick={() => setFilter('hasAttachments', !filters.hasAttachments)}
            className={`rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition ${
              filters.hasAttachments
                ? 'border-[var(--human)]/50 text-[var(--human)]'
                : 'border-[var(--edge)] text-[var(--text-muted)]'
            }`}
          >
            has files
          </button>

          {filtersActive(filters) && (
            <button
              onClick={() => setFilters()}
              className="rule-label ml-auto hover:text-[var(--text-muted)]"
            >
              clear filters
            </button>
          )}
        </div>

        <p className="mt-5 border-t border-[var(--edge)] pt-3 text-[12.5px] text-[var(--text-dim)]">
          {showing
            ? `${fmtNum(results.length)} of ${fmtNum(model.conversations.length)} conversations`
            : `Type to search ${fmtNum(model.conversations.length)} conversations · ${fmtNum(model.summary.counts.messages)} messages`}
        </p>

        {showing && results.length === 0 && (
          <p className="mt-8 rounded-lg border border-dashed border-[var(--edge-strong)] px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
            Nothing matched. Try fewer filters, or a shorter word — search tolerates typos in titles but needs the
            exact spelling inside message text.
          </p>
        )}

        <ul className="mt-3 divide-y divide-[var(--edge)]">
          {results.slice(0, 100).map((r) => {
            const link = model.links.byConversation.get(r.conversation.uuid)
            return (
              <li key={r.conversation.uuid}>
                <Link to={`/chats/${r.conversation.uuid}`} className="block py-3 transition hover:opacity-80">
                  <div className="flex items-baseline gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                      {titleOf(r.conversation)}
                    </h3>
                    {link && <ConfidenceBadge confidence={link.confidence} />}
                    <span className="shrink-0 font-mono text-[10.5px] text-[var(--text-dim)]">
                      {fmtDate(r.conversation.updatedAtMs)}
                    </span>
                  </div>

                  {r.snippets.length ? (
                    r.snippets.map((s, i) => <Snippet key={i} snippet={s} />)
                  ) : (
                    <p className="mt-1 line-clamp-2 text-[12px] leading-[1.55] text-[var(--text-muted)]">
                      {previewOf(r.conversation)}
                    </p>
                  )}

                  <div className="mt-1.5 flex flex-wrap gap-x-2.5">
                    <span className="font-mono text-[10px] text-[var(--text-dim)]">
                      {fmtNum(r.conversation.facets.messageCount)} msg
                    </span>
                    {r.exactHits > 0 && (
                      <span className="font-mono text-[10px] text-[var(--human)]">
                        {r.exactHits}
                        {r.exactHits >= 50 ? '+' : ''} match{r.exactHits === 1 ? '' : 'es'}
                      </span>
                    )}
                    {r.viaFuzzy && r.exactHits === 0 && (
                      <span className="font-mono text-[10px] text-[var(--assistant)]">fuzzy title match</span>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>

        {results.length > 100 && (
          <p className="rule-label mt-4">showing the first 100 · narrow with filters to see more</p>
        )}
      </div>
    </div>
  )
}
