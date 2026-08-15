/**
 * Step-1 verification view: what the parser actually found, so the numbers can
 * be checked against the real export before any feature work is layered on.
 */

const fmt = (n) => (n ?? 0).toLocaleString()
const day = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : '—')
const mb = (bytes) => (bytes == null ? null : `${(bytes / 1024 / 1024).toFixed(0)} MB`)

const CACHE_COPY = {
  restored: { tone: 'ok', text: 'Restored from this browser’s local cache — no re-upload needed.' },
  saving: { tone: 'busy', text: 'Caching to IndexedDB so your next visit loads instantly…' },
  saved: { tone: 'ok', text: 'Cached locally. Your next visit will load straight from this browser.' },
  failed: { tone: 'warn', text: 'Could not cache locally — the export is loaded for this session only.' },
}

function CacheBar({ cache, usage, onReset }) {
  if (!cache) return null
  const copy = CACHE_COPY[cache.state]
  if (!copy) return null
  const dot =
    copy.tone === 'ok' ? 'bg-emerald-400' : copy.tone === 'busy' ? 'bg-ochre-400 animate-pulse' : 'bg-amber-400'

  return (
    <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)] px-4 py-3">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <p className="text-[13px] text-[var(--text-muted)]">
        {copy.text}
        {cache.state === 'failed' && cache.reason === 'quota' && (
          <span className="text-amber-300/80"> Storage quota exceeded — free up disk space and re-upload to cache.</span>
        )}
        {cache.state === 'failed' && cache.reason && cache.reason !== 'quota' && (
          <span className="text-amber-300/80"> ({cache.reason})</span>
        )}
        {cache.savedAt && <span className="text-[var(--text-dim)]"> Cached {new Date(cache.savedAt).toLocaleString()}.</span>}
      </p>
      {usage?.usage != null && (
        <span className="ml-auto font-mono text-[12px] text-[var(--text-dim)]">
          {mb(usage.usage)} used{usage.quota ? ` of ${mb(usage.quota)} available` : ''}
        </span>
      )}
      <button
        onClick={onReset}
        className="rounded-md border border-[var(--edge-strong)] px-2.5 py-1 text-[12px] font-medium transition hover:bg-[var(--surface-sunken)]"
      >
        Clear cache
      </button>
    </div>
  )
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)] px-4 py-3.5">
      <div className="text-[26px] leading-none font-semibold tabular-nums">{fmt(value)}</div>
      <div className="mt-1.5 text-[13px] font-medium">{label}</div>
      {hint && <div className="mt-0.5 text-[12px] text-[var(--text-dim)]">{hint}</div>}
    </div>
  )
}

function Bars({ title, rows, max }) {
  const top = max ?? (rows[0]?.[1] ?? 1)
  return (
    <section>
      <h3 className="mb-3 text-[13px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">{title}</h3>
      <ul className="space-y-1.5">
        {rows.map(([label, n]) => (
          <li key={label} className="flex items-center gap-3">
            <span className="w-44 shrink-0 truncate font-mono text-[12.5px]" title={label}>
              {label}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
              <span className="block h-full rounded-full bg-ochre-500/70" style={{ width: `${(n / top) * 100}%` }} />
            </span>
            <span className="w-12 shrink-0 text-right text-[12.5px] tabular-nums text-[var(--text-muted)]">
              {fmt(n)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function ParseSummary({ model, onReset, cache, usage }) {
  const s = model.summary
  const c = s.counts

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="rule-label">Overview</p>
          <h1 className="mt-1.5 font-serif text-3xl font-semibold tracking-tight">Your archive</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {day(s.dateRange.fromMs)} → {day(s.dateRange.toMs)} · parsed entirely in your browser
          </p>
        </div>
        <button
          onClick={onReset}
          className="rounded-lg border border-[var(--edge-strong)] px-3.5 py-2 text-sm font-medium transition hover:bg-[var(--surface-raised)]"
        >
          Clear data / re-upload
        </button>
      </header>

      <CacheBar cache={cache} usage={usage} onReset={onReset} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Conversations" value={c.conversations} hint={`${fmt(c.unnamedConversations)} unnamed`} />
        <Stat label="Messages" value={c.messages} hint={`${fmt(c.humanMessages)} human · ${fmt(c.assistantMessages)} assistant`} />
        <Stat label="Projects" value={c.projects} hint={`${fmt(c.projectDocs)} docs · ${fmt(c.projectMemoriesLinked)} linked memories`} />
        <Stat label="Design chats" value={c.designChats} hint={`${fmt(c.designChatMessages)} messages`} />
        <Stat label="Tool calls" value={c.toolCalls} hint={`${fmt(s.tools.length)} distinct tools · ${fmt(c.errorResults)} errors`} />
        <Stat label="Thinking blocks" value={c.thinkingBlocks} />
        <Stat label="Attachments" value={c.attachments} hint={`${fmt(c.fileRefs)} file refs`} />
        <Stat label="Memory files" value={c.memoryFiles} hint={`${fmt(c.projectMemories)} project memories`} />
        <Stat label="Reflection periods" value={c.reflectionPeriods} />
        <Stat label="Login events" value={c.loginEvents} />
        <Stat label="Code languages" value={s.languages.length} />
        <Stat label="Empty messages" value={c.emptyMessages} hint="no blocks, no text" />
      </div>

      {model.owner && (
        <p className="mt-5 text-[13px] text-[var(--text-dim)]">
          Export owner: <span className="text-[var(--text-muted)]">{model.owner.fullName || '—'}</span> · contact
          details parsed but kept masked until you open the profile view.
        </p>
      )}

      <div className="mt-11 grid gap-9 lg:grid-cols-2">
        <Bars title="Content block types" rows={s.blockKinds} />
        <Bars title="Tools — conversations using each" rows={s.tools.slice(0, 12)} />
        <Bars title="Languages — conversations containing each" rows={s.languages.slice(0, 12)} />
        <section>
          <h3 className="mb-3 text-[13px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
            Parser notes
          </h3>
          {s.warnings.length ? (
            <ul className="space-y-2">
              {s.warnings.map((w, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-[13px] leading-relaxed text-amber-200/90"
                >
                  {w}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[var(--text-muted)]">
              Every file matched its expected shape. No unrecognised block types.
            </p>
          )}
          {s.skippedFiles.length > 0 && (
            <p className="mt-3 text-[12.5px] text-[var(--text-dim)]">
              {fmt(s.skippedFiles.length)} file(s) in the export were not recognised as export data and were
              ignored.
            </p>
          )}
        </section>
      </div>

    </div>
  )
}
