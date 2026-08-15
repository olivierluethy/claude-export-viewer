export default function ParseProgress({ progress }) {
  const pct = progress?.total ? Math.round((progress.done / progress.total) * 100) : null

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6">
      <div className="rounded-2xl border border-[var(--edge)] bg-[var(--surface-raised)] p-7">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ochre-500 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ochre-500" />
          </span>
          <p className="text-sm font-medium">{progress?.label ?? 'Working'}</p>
        </div>

        <p className="mt-1.5 pl-[22px] text-[13px] text-[var(--text-muted)]">
          {progress?.detail
            ? progress.detail
            : progress?.total
              ? `${progress.done.toLocaleString()} of ${progress.total.toLocaleString()}`
              : 'This runs in a background worker — the page stays responsive.'}
        </p>

        <div className="mt-5 h-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
          <div
            className={`h-full rounded-full bg-ochre-500 transition-[width] duration-200 ${pct === null ? 'w-1/3 animate-pulse' : ''}`}
            style={pct === null ? undefined : { width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
