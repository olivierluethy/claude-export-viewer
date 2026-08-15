/**
 * Activity: when the work happened, and what it was made of.
 *
 * Forms chosen by job, not by habit — vertical bars for change over time
 * (ordered, dense, comparable), horizontal bars for the category breakdowns
 * (labels like `ask_user_input_v0` need room to be read), stat tiles for the
 * headline figures that aren't a chart at all.
 *
 * Palette: the two chart inks are validated against both surfaces for CVD
 * separation and contrast — see index.css. Identity is never colour alone: the
 * legend is always present, and a table view carries the same numbers.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useModel } from '../lib/ModelContext.jsx'
import {
  breakdownByLanguage,
  breakdownByProject,
  breakdownByTool,
  buildActivitySeries,
  isoDate,
} from '../lib/stats.js'
import { fmtDate, fmtNum } from '../lib/format.js'
import ActivityTimeline from '../components/ActivityTimeline.jsx'

const GRANULARITIES = [
  ['day', 'day'],
  ['week', 'week'],
  ['month', 'month'],
]

function Tile({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)] px-4 py-3.5">
      <div className="font-serif text-[1.9rem] leading-none font-semibold tabular-nums">{value}</div>
      <div className="mt-1.5 text-[12.5px] font-medium">{label}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-[var(--text-dim)]">{sub}</div>}
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--edge-strong)] bg-[var(--surface-raised)] px-3 py-2 shadow-lg">
      <p className="mb-1 font-mono text-[11px] text-[var(--text-muted)]">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-baseline gap-2 text-[12px]">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: p.color }} />
          <span className="text-[var(--text-muted)]">{p.name}</span>
          <span className="ml-auto tabular-nums">{fmtNum(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

/** Horizontal bars — the right form when category names are long. */
function RankedBars({ rows, valueKey, max, onSelect }) {
  const top = max ?? rows[0]?.[valueKey] ?? 1
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.key || r.name}>
          <button
            onClick={() => onSelect?.(r)}
            disabled={!onSelect}
            className="flex w-full items-center gap-3 rounded px-1 py-0.5 text-left transition enabled:hover:bg-[var(--surface-high)]"
          >
            <span className="w-40 shrink-0 truncate font-mono text-[11.5px]" title={r.name}>
              {r.name}
            </span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-[3px] bg-[var(--surface-sunken)]">
              <span
                className="block h-full rounded-[3px]"
                style={{ width: `${Math.max(2, (r[valueKey] / top) * 100)}%`, background: 'var(--chart-human)' }}
              />
            </span>
            <span className="w-16 shrink-0 text-right font-mono text-[11.5px] text-[var(--text-muted)] tabular-nums">
              {fmtNum(r[valueKey])}
            </span>
          </button>
        </li>
      ))}
      {rows.length === 0 && <li className="rule-label">nothing recorded</li>}
    </ul>
  )
}

function Section({ title, note, children, aside }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="text-[13px] font-medium">{title}</h2>
        {note && <span className="rule-label">{note}</span>}
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

export default function ActivityPage() {
  const model = useModel()
  const navigate = useNavigate()
  const [granularity, setGranularity] = useState('month')
  const [showTable, setShowTable] = useState(false)

  const series = useMemo(
    () => buildActivitySeries(model.conversations, granularity),
    [model.conversations, granularity],
  )
  const projects = useMemo(
    () => breakdownByProject(model.conversations, model.projects, model.links),
    [model.conversations, model.projects, model.links],
  )
  const tools = useMemo(() => breakdownByTool(model.conversations), [model.conversations])
  const languages = useMemo(() => breakdownByLanguage(model.conversations), [model.conversations])

  const counts = model.summary.counts
  const range = model.summary.dateRange
  const days = range.fromMs && range.toMs ? Math.max(1, Math.round((range.toMs - range.fromMs) / 86_400_000)) : 1

  const goToRange = (bucket) =>
    navigate(`/search?from=${isoDate(bucket.fromMs)}&to=${isoDate(bucket.toMs)}`)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <p className="rule-label">Activity</p>
        <h1 className="mt-1.5 font-serif text-3xl font-semibold tracking-tight">
          {fmtDate(range.fromMs)} → {fmtDate(range.toMs)}
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Conversations" value={fmtNum(counts.conversations)} />
          <Tile label="Messages" value={fmtNum(counts.messages)} />
          <Tile
            label="Messages per week"
            value={fmtNum(Math.round(counts.messages / (days / 7)))}
            sub={`across ${fmtNum(Math.round(days / 7))} weeks`}
          />
          <Tile label="Tool calls" value={fmtNum(counts.toolCalls)} sub={`${tools.length} distinct tools`} />
        </div>

        <Section
          title="Messages over time"
          note="click a bar to filter"
          aside={
            <div className="flex items-center gap-1">
              {GRANULARITIES.map(([g, label]) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={`rounded-md border px-2 py-1 font-mono text-[11px] transition ${
                    granularity === g
                      ? 'border-[var(--human)]/50 text-[var(--human)]'
                      : 'border-[var(--edge)] text-[var(--text-muted)] hover:border-[var(--edge-strong)]'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => setShowTable((s) => !s)}
                className="rule-label ml-2 rounded-md border border-[var(--edge)] px-2 py-1 hover:text-[var(--text-muted)]"
              >
                {showTable ? 'chart' : 'table'}
              </button>
            </div>
          }
        >
          <Legend
            items={[
              { label: 'You', color: 'var(--chart-human)' },
              { label: 'Claude', color: 'var(--chart-assistant)' },
            ]}
          />

          {showTable ? (
            <div className="scroll-x mt-3 max-h-96 overflow-y-auto rounded-lg border border-[var(--edge)]">
              <table className="w-full border-collapse text-[12px]">
                <thead className="sticky top-0 bg-[var(--surface-sunken)]">
                  <tr>
                    {['Period', 'You', 'Claude', 'Messages', 'Chats started'].map((h) => (
                      <th key={h} className="rule-label border-b border-[var(--edge)] px-3 py-2 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {series.map((b) => (
                    <tr key={b.key}>
                      <td className="border-b border-[var(--edge)] px-3 py-1.5 font-mono">{b.label}</td>
                      <td className="border-b border-[var(--edge)] px-3 py-1.5 tabular-nums">{fmtNum(b.human)}</td>
                      <td className="border-b border-[var(--edge)] px-3 py-1.5 tabular-nums">
                        {fmtNum(b.assistant)}
                      </td>
                      <td className="border-b border-[var(--edge)] px-3 py-1.5 tabular-nums">
                        {fmtNum(b.messages)}
                      </td>
                      <td className="border-b border-[var(--edge)] px-3 py-1.5 tabular-nums">{fmtNum(b.chats)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-3 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'var(--chart-axis)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--chart-grid)' }}
                    interval="preserveStartEnd"
                    minTickGap={18}
                  />
                  <YAxis
                    tick={{ fill: 'var(--chart-axis)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                    tickLine={false}
                    axisLine={false}
                    width={38}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--chart-grid)' }} />
                  {/* 2px surface stroke gives the stacked segments their gap. */}
                  <Bar
                    dataKey="human"
                    name="You"
                    stackId="m"
                    fill="var(--chart-human)"
                    stroke="var(--surface)"
                    strokeWidth={2}
                    onClick={goToRange}
                    cursor="pointer"
                  />
                  <Bar
                    dataKey="assistant"
                    name="Claude"
                    stackId="m"
                    fill="var(--chart-assistant)"
                    stroke="var(--surface)"
                    strokeWidth={2}
                    radius={[3, 3, 0, 0]}
                    onClick={goToRange}
                    cursor="pointer"
                  >
                    {series.map((b) => (
                      <Cell key={b.key} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        <div className="grid gap-8 md:grid-cols-2">
          <Section title="By project" note={`${projects.length} groups`}>
            <RankedBars
              rows={projects.slice(0, 12)}
              valueKey="chats"
              onSelect={(r) => r.key && navigate(`/projects/${r.key}`)}
            />
          </Section>

          <Section title="By tool" note="calls">
            <RankedBars
              rows={tools.slice(0, 12)}
              valueKey="calls"
              onSelect={(r) => navigate(`/search?tool=${encodeURIComponent(r.key)}`)}
            />
          </Section>

          <Section title="By language" note="conversations containing">
            <RankedBars
              rows={languages.slice(0, 12)}
              valueKey="chats"
              onSelect={(r) => navigate(`/search?language=${encodeURIComponent(r.key)}`)}
            />
          </Section>

          <Section title="Chats started" note="per period">
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'var(--chart-axis)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--chart-grid)' }}
                    interval="preserveStartEnd"
                    minTickGap={18}
                  />
                  <YAxis
                    tick={{ fill: 'var(--chart-axis)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--chart-grid)' }} />
                  <Bar
                    dataKey="chats"
                    name="Chats started"
                    fill="var(--chart-human)"
                    radius={[3, 3, 0, 0]}
                    onClick={goToRange}
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>

        <Section title="Timeline" note="jump to any month · newest first">
          <ActivityTimeline conversations={model.conversations} />
        </Section>
      </div>
    </div>
  )
}
