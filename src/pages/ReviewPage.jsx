/**
 * Relationship review — turn scored recommendations into real links.
 *
 * The engine (lib/projectRecommend.js) decides *what* is worth reviewing and
 * *why*; this page makes the review practical at the scale of a whole archive:
 * understand the shape of the unlinked data first (the dashboard), narrow to a
 * project or a confidence band, then confirm / reject / reassign one chat — or
 * bulk-confirm the high-confidence ones — without opening each thread.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useModel } from '../lib/ModelContext.jsx'
import { projectRecommendationCounts } from '../lib/projectRecommend.js'
import { fmtDate, fmtDateLong, fmtNum, titleOf } from '../lib/format.js'
import { ConfidenceMeter, EvidenceList, RecBadge, REC_STATUS } from '../components/ui/Confidence.jsx'

const STATUS_FILTERS = [
  ['all', 'all'],
  ['high', 'high'],
  ['medium', 'likely'],
  ['ambiguous', 'ambiguous'],
]

function Tile({ value, label, sub, fill }) {
  return (
    <div className="rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)] px-4 py-3.5">
      <div className="flex items-baseline gap-2">
        {fill && <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: fill }} />}
        <span className="font-serif text-[1.9rem] leading-none font-semibold tabular-nums">{fmtNum(value)}</span>
      </div>
      <div className="mt-1.5 text-[12.5px] font-medium">{label}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-[var(--text-dim)]">{sub}</div>}
    </div>
  )
}

/** Stacked proportion bar for the confidence breakdown. */
function BreakdownBar({ stats }) {
  const parts = [
    { key: 'high', n: stats.high, fill: REC_STATUS.high.fill },
    { key: 'medium', n: stats.medium, fill: REC_STATUS.medium.fill },
    { key: 'ambiguous', n: stats.ambiguous, fill: REC_STATUS.ambiguous.fill },
    { key: 'none', n: stats.none, fill: 'var(--surface-high)' },
  ]
  const total = parts.reduce((s, p) => s + p.n, 0) || 1
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
      {parts.map((p) => (
        <span key={p.key} style={{ width: `${(p.n / total) * 100}%`, background: p.fill }} title={`${p.key}: ${p.n}`} />
      ))}
    </div>
  )
}

function ReviewCard({ rec, conv, project }) {
  const model = useModel()
  const [open, setOpen] = useState(false)
  const top = rec.top

  return (
    <li className="rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)] p-4 transition hover:border-[var(--edge-strong)]">
      <div className="flex items-baseline gap-2">
        <Link to={`/chats/${conv.uuid}`} className="min-w-0 flex-1 truncate text-[13.5px] font-medium hover:text-[var(--assistant)]">
          {titleOf(conv)}
        </Link>
        <span className="shrink-0 font-mono text-[10.5px] text-[var(--text-dim)] tabular-nums">
          {fmtNum(conv.facets.messageCount)} msg
        </span>
        <span
          className="shrink-0 font-mono text-[10.5px] text-[var(--text-dim)]"
          title={`Last active: ${fmtDateLong(conv.updatedAtMs)}`}
        >
          {fmtDate(conv.updatedAtMs)}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="rule-label">{rec.status === 'ambiguous' ? 'best guess' : 'recommended'}</span>
        <Link to={`/projects/${top.projectUuid}`} className="text-[13px] font-medium hover:text-[var(--assistant)]">
          {project?.name || 'Unknown project'}
        </Link>
        <RecBadge status={rec.status} />
        <ConfidenceMeter score={top.score} status={rec.status} />
        <button
          onClick={() => setOpen((o) => !o)}
          className="rule-label ml-auto rounded border border-[var(--edge)] px-1.5 py-0.5 hover:text-[var(--text)]"
          aria-expanded={open}
        >
          {open ? 'hide why' : 'why'}
        </button>
      </div>

      {rec.status === 'ambiguous' && rec.rejected && (
        <p className="mt-1.5 text-[11.5px] text-[var(--text-dim)]">{rec.rejected}. Pick the right one or skip.</p>
      )}

      {/* Evidence + competing candidates — the explainability surface. Animated
          open/close, but fully usable when motion is reduced. */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="mt-3 rounded-lg border border-[var(--edge)] bg-[var(--surface-sunken)]/40 p-3">
            <p className="rule-label mb-2">why this project</p>
            <EvidenceList evidence={top.evidence} />
            {rec.candidates.length > 1 && (
              <div className="mt-3 border-t border-[var(--edge)] pt-2.5">
                <p className="rule-label mb-1.5">also considered</p>
                <ul className="flex flex-wrap gap-x-3 gap-y-1">
                  {rec.candidates.slice(1, 5).map((c) => (
                    <li key={c.projectUuid} className="flex items-center gap-1.5">
                      <button
                        onClick={() => model.confirmRecommendation(conv.uuid, c.projectUuid)}
                        className="text-[12px] text-[var(--text-muted)] hover:text-[var(--human)]"
                        title={`Assign to ${c.project.name} instead`}
                      >
                        {c.project.name}
                      </button>
                      <span className="font-mono text-[10px] text-[var(--text-dim)] tabular-nums">{c.score}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => model.confirmRecommendation(conv.uuid, top.projectUuid)}
          className="rounded-md border border-[var(--human)]/45 px-2.5 py-1 font-mono text-[11px] text-[var(--human)] transition hover:bg-[var(--human)]/10"
        >
          confirm → {project?.name?.length > 18 ? `${project.name.slice(0, 17)}…` : project?.name}
        </button>
        <button
          onClick={() => model.dismissRecommendation(conv.uuid, top.projectUuid)}
          className="rule-label rounded-md border border-[var(--edge)] px-2 py-1 transition hover:border-[var(--edge-strong)] hover:text-[var(--text)]"
          title="Not this project — remove this suggestion"
        >
          reject
        </button>
        <select
          value=""
          onChange={(e) => e.target.value && model.confirmRecommendation(conv.uuid, e.target.value)}
          className="ml-auto rounded-md border border-[var(--edge)] bg-[var(--surface-raised)] px-2 py-1 font-mono text-[11px] text-[var(--text-muted)]"
          title="Assign to a different project"
        >
          <option value="">reassign…</option>
          {model.projects.map((p) => (
            <option key={p.uuid} value={p.uuid}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </li>
  )
}

export default function ReviewPage() {
  const model = useModel()
  const navigate = useNavigate()
  const { stats, queue, byProject } = model.recommendations
  const [status, setStatus] = useState('all')
  const [projectFilter, setProjectFilter] = useState('')

  const projectRows = useMemo(
    () => projectRecommendationCounts(byProject, model.projectsById),
    [byProject, model.projectsById],
  )

  const visible = useMemo(() => {
    return queue.filter((r) => {
      if (status !== 'all' && r.status !== status) return false
      if (projectFilter && r.top?.projectUuid !== projectFilter) return false
      return true
    })
  }, [queue, status, projectFilter])

  const highCount = useMemo(() => visible.filter((r) => r.status === 'high').length, [visible])

  const confirmAllHigh = async () => {
    for (const r of visible.filter((v) => v.status === 'high')) {
      await model.confirmRecommendation(r.uuid, r.top.projectUuid)
    }
  }

  const projName = projectFilter ? model.projectsById.get(projectFilter)?.name : null

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <p className="rule-label">Relationship review</p>
        <h1 className="mt-1.5 font-serif text-3xl font-semibold tracking-tight">
          {fmtNum(stats.related)} of {fmtNum(stats.unlinked)} unlinked chat{stats.unlinked === 1 ? '' : 's'} look related
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">
          This looks only at chats that aren’t in any project yet — {fmtNum(stats.linked)} are already linked and are left
          alone. For the rest, matches are inferred from name mentions, shared vocabulary, tools and timing. Nothing is
          linked until you confirm it; high-confidence matches can be confirmed in bulk, ambiguous ones are yours to decide.
        </p>

        {/* -------- dashboard -------- */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile value={stats.unlinked} label="Not in any project" sub={`${fmtNum(stats.linked)} already linked`} />
          <Tile value={stats.related} label="Look related" sub="worth a review" />
          <Tile value={stats.high} label="High confidence" sub="safe to bulk-confirm" fill={REC_STATUS.high.fill} />
          <Tile value={stats.none} label="No meaningful link" sub="stay unlinked" />
        </div>

        <div className="mt-4 rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)] px-4 py-3.5">
          <BreakdownBar stats={stats} />
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
            {[
              ['high', 'High', stats.high],
              ['medium', 'Likely', stats.medium],
              ['ambiguous', 'Ambiguous', stats.ambiguous],
              ['none', 'No match', stats.none],
            ].map(([key, label, n]) => (
              <span key={key} className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]">
                <span
                  className="h-2 w-2 rounded-[2px]"
                  style={{ background: key === 'none' ? 'var(--surface-high)' : REC_STATUS[key].fill }}
                />
                {label} <span className="font-mono text-[var(--text-dim)] tabular-nums">{fmtNum(n)}</span>
              </span>
            ))}
          </div>
        </div>

        {/* -------- project aggregation -------- */}
        {projectRows.length > 0 && (
          <section className="mt-10">
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-[13px] font-medium">Recommendations by project</h2>
              <span className="rule-label">click to filter</span>
            </div>
            <ul className="space-y-1">
              {projectRows.slice(0, 12).map((r) => {
                const top = projectRows[0].total || 1
                const active = projectFilter === r.projectUuid
                return (
                  <li key={r.projectUuid}>
                    <button
                      onClick={() => setProjectFilter(active ? '' : r.projectUuid)}
                      className={`flex w-full items-center gap-3 rounded px-1.5 py-1 text-left transition hover:bg-[var(--surface-high)] ${
                        active ? 'bg-[var(--surface-high)]' : ''
                      }`}
                    >
                      <span className="w-44 shrink-0 truncate text-[12.5px]" title={r.name}>
                        {r.name}
                      </span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-[3px] bg-[var(--surface-sunken)]">
                        <span
                          className="block h-full rounded-[3px] bg-[var(--assistant)]/70"
                          style={{ width: `${Math.max(3, (r.total / top) * 100)}%` }}
                        />
                      </span>
                      <span className="w-24 shrink-0 text-right font-mono text-[10.5px] text-[var(--text-dim)] tabular-nums">
                        {r.total} rec{r.total === 1 ? '' : 's'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* -------- review queue -------- */}
        <section className="mt-10">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-[13px] font-medium">Review queue</h2>
            <span className="rule-label">{visible.length} shown</span>
            <div className="ml-auto flex items-center gap-1">
              {STATUS_FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setStatus(key)}
                  className={`rounded-md border px-2 py-1 font-mono text-[11px] transition ${
                    status === key
                      ? 'border-[var(--human)]/50 text-[var(--human)]'
                      : 'border-[var(--edge)] text-[var(--text-muted)] hover:border-[var(--edge-strong)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {projName && (
            <div className="mb-3 flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
              <span>
                Filtered to <span className="font-medium text-[var(--text)]">{projName}</span>
              </span>
              <button onClick={() => setProjectFilter('')} className="rule-label hover:text-[var(--text)]">
                clear ✕
              </button>
            </div>
          )}

          {highCount > 1 && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--human)]/30 bg-[var(--human)]/5 px-3 py-2">
              <span className="text-[12.5px] text-[var(--text-muted)]">
                {fmtNum(highCount)} high-confidence match{highCount === 1 ? '' : 'es'} in view.
              </span>
              <button
                onClick={confirmAllHigh}
                className="ml-auto rounded-md border border-[var(--human)]/45 px-2.5 py-1 font-mono text-[11px] text-[var(--human)] transition hover:bg-[var(--human)]/10"
              >
                confirm all {fmtNum(highCount)}
              </button>
            </div>
          )}

          {visible.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--edge-strong)] px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
              {queue.length === 0
                ? 'Nothing to review — no unlinked chat has a strong enough match to recommend.'
                : 'Nothing matches these filters. All caught up here.'}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {visible.map((rec) => {
                const conv = model.conversationsById.get(rec.uuid)
                const project = model.projectsById.get(rec.top.projectUuid)
                if (!conv) return null
                return <ReviewCard key={rec.uuid} rec={rec} conv={conv} project={project} />
              })}
            </ul>
          )}
        </section>

        <p className="mt-8 text-[11.5px] text-[var(--text-dim)]">
          Confirming a match tags the chat (kept on this device, survives re-uploading your export). Rejecting removes
          just that suggestion.{' '}
          <button onClick={() => navigate('/projects')} className="underline hover:text-[var(--text-muted)]">
            See linked projects →
          </button>
        </p>
      </div>
    </div>
  )
}
