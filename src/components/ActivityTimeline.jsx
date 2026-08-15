/**
 * The activity timeline, rebuilt around discovery instead of scrolling.
 *
 * The problem it solves: with a plain chronological list you cannot tell what
 * date range exists, how much is there, or whether a given date holds anything
 * without scrolling the whole thing. So this view leads with structure —
 *
 *   - a sticky month jump-index (left) with per-month counts, click to jump;
 *   - sticky month headers and day sub-headers as you scroll;
 *   - a chat count on every day, with a density tick relative to the busiest day.
 *
 * Scrolling is for browsing within a month you chose, never the way you find out
 * whether a date has activity.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { buildActivityCalendar } from '../lib/stats.js'
import { fmtDayLabel, fmtMonthYear, fmtNum, fmtWeekday, titleOf } from '../lib/format.js'
import { findScrollParent, scrollWithin, useScrollSpy } from '../lib/useScrollSpy.js'

export default function ActivityTimeline({ conversations }) {
  const calendar = useMemo(() => buildActivityCalendar(conversations), [conversations])
  const busiestDay = useMemo(
    () => Math.max(1, ...calendar.flatMap((m) => m.days.map((d) => d.count))),
    [calendar],
  )
  const totalChats = useMemo(() => calendar.reduce((s, m) => s + m.total, 0), [calendar])

  const rootRef = useRef(null)
  const navRef = useRef(null)
  const getScrollEl = useCallback(() => findScrollParent(rootRef.current), [])
  // Which month is currently at the top of the scroll — mirrors the sticky header.
  const activeMonth = useScrollSpy(getScrollEl, '[data-spy]', { threshold: 12, deps: [calendar.length] })

  // Keep the active month visible in the jump-index as you scroll the list.
  useEffect(() => {
    if (!activeMonth || !navRef.current) return
    const btn = navRef.current.querySelector('[data-active="true"]')
    if (btn) scrollWithin(navRef.current, btn)
  }, [activeMonth])

  if (!calendar.length) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--edge-strong)] px-4 py-6 text-center text-[13px] text-[var(--text-muted)]">
        No dated conversations to place on a timeline.
      </p>
    )
  }

  const jumpTo = (key) => document.getElementById(`m-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div ref={rootRef} className="grid gap-x-8 gap-y-4 md:grid-cols-[10rem_1fr]">
      {/* Jump index — the map of what exists, before any scrolling. */}
      <nav className="top-2 self-start md:sticky">
        <p className="rule-label mb-1">
          {calendar.length} month{calendar.length === 1 ? '' : 's'} · {fmtNum(totalChats)} chats
        </p>
        <ul
          ref={navRef}
          className="flex max-h-[68vh] flex-row gap-1 overflow-x-auto pb-1 md:flex-col md:gap-0.5 md:overflow-x-visible md:overflow-y-auto md:pr-1"
        >
          {calendar.map((m) => {
            const active = activeMonth === m.key
            return (
              <li key={m.key} className="shrink-0">
                <button
                  onClick={() => jumpTo(m.key)}
                  data-active={active}
                  className={`flex w-full items-baseline gap-2 rounded px-1.5 py-0.5 text-left transition ${
                    active ? 'bg-[var(--surface-high)] text-[var(--text)]' : 'hover:bg-[var(--surface-high)]'
                  }`}
                >
                  <span
                    className="h-3 w-px shrink-0 translate-y-0.5 self-center"
                    style={{ background: active ? 'var(--human)' : 'transparent' }}
                    aria-hidden
                  />
                  <span className="flex-1 truncate text-[12px] whitespace-nowrap">{fmtMonthYear(m.ms)}</span>
                  <span className="font-mono text-[10px] text-[var(--text-dim)] tabular-nums">{m.total}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* The grouped list — sticky headers keep "where am I" answered while scrolling. */}
      <div className="min-w-0">
        {calendar.map((month) => (
          <section key={month.key} id={`m-${month.key}`} data-spy={month.key} className="scroll-mt-2">
            <h3 className="sticky top-0 z-10 -mx-1 mb-2 flex items-baseline gap-2 bg-[var(--surface)] px-1 py-1.5">
              <span className="font-serif text-[15px] font-semibold tracking-tight">{fmtMonthYear(month.ms)}</span>
              <span className="rule-label">
                {month.total} chat{month.total === 1 ? '' : 's'}
              </span>
            </h3>

            <div className="space-y-4">
              {month.days.map((day) => (
                <div key={day.key} className="grid grid-cols-[var(--gutter)_1fr] gap-x-3.5 [--gutter:4.75rem]">
                  {/* Day rail — date, weekday, count, and a density tick. */}
                  <div className="relative">
                    <span className="absolute top-0 right-0 bottom-0 w-px bg-[var(--rail)]" aria-hidden />
                    <div className="sticky top-11 pr-3 text-right">
                      <span className="block font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
                        {fmtDayLabel(day.ms)}
                      </span>
                      <span className="rule-label block">{fmtWeekday(day.ms)}</span>
                      <span className="mt-1 flex items-center justify-end gap-1.5">
                        <span className="h-1 w-8 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                          <span
                            className="block h-full rounded-full bg-[var(--chart-human)]"
                            style={{ width: `${Math.max(10, (day.count / busiestDay) * 100)}%` }}
                          />
                        </span>
                        <span className="font-mono text-[10px] text-[var(--text-dim)] tabular-nums">{day.count}</span>
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-0.5 pb-1">
                    {day.conversations.map((c) => (
                      <li key={c.uuid}>
                        <Link
                          to={`/chats/${c.uuid}`}
                          className="flex items-baseline gap-2 rounded px-1.5 py-1 transition hover:bg-[var(--surface-high)]"
                        >
                          <span className="min-w-0 flex-1 truncate text-[13px]">{titleOf(c)}</span>
                          <span className="shrink-0 font-mono text-[10px] text-[var(--text-dim)] tabular-nums">
                            {fmtNum(c.facets.messageCount)} msg
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
