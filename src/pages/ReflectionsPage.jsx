/**
 * Reflections — the one genuinely essayistic content in the export, so this is
 * where the serif face earns its keep and the measure narrows for reading.
 */

import { useState } from 'react'
import { useModel } from '../lib/ModelContext.jsx'
import { fmtNum } from '../lib/format.js'

function periodLabel(period) {
  const m = /^(\d{4})-(\d{2})$/.exec(period || '')
  if (!m) return period || 'Reflection'
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export default function ReflectionsPage() {
  const model = useModel()
  const periods = model.reflections?.periods ?? []
  const [active, setActive] = useState(0)
  const r = periods[active]

  if (!periods.length) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-[13px] text-[var(--text-muted)]">This export contains no reflections.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <p className="rule-label">Reflections</p>

        {periods.length > 1 && (
          <div className="mt-3 flex gap-1.5">
            {periods.map((p, i) => (
              <button
                key={p.period}
                onClick={() => setActive(i)}
                className={`rounded-md border px-2.5 py-1 font-mono text-[11px] transition ${
                  i === active
                    ? 'border-[var(--human)]/45 text-[var(--human)]'
                    : 'border-[var(--edge)] text-[var(--text-muted)] hover:border-[var(--edge-strong)]'
                }`}
              >
                {p.period}
              </button>
            ))}
          </div>
        )}

        <header className="mt-6 border-b border-[var(--edge)] pb-6">
          <h1 className="font-serif text-[2rem] leading-tight font-semibold tracking-tight text-balance">
            {r.heroTitle || periodLabel(r.period)}
          </h1>
          {r.heroBody && (
            <p className="mt-3 font-serif text-[15px] leading-[1.75] text-[var(--text-muted)]">{r.heroBody}</p>
          )}
        </header>

        {r.stats.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            {r.stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)] p-4">
                <div className="font-serif text-[1.75rem] leading-none font-semibold tabular-nums">
                  {typeof s.n === 'number' ? fmtNum(s.n) : s.n}
                </div>
                <div className="mt-1.5 text-[12.5px] font-medium">{s.label}</div>
                {s.sublabel && <div className="mt-0.5 text-[11.5px] text-[var(--text-dim)]">{s.sublabel}</div>}
              </div>
            ))}
          </div>
        )}

        {r.topics.length > 0 && (
          <section className="mt-8">
            <h2 className="rule-label mb-3">What you spent time on</h2>
            <ul className="space-y-3">
              {r.topics.map((t) => (
                <li key={t.title}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13.5px] font-medium">{t.title}</span>
                    {t.percent != null && (
                      <span className="ml-auto font-mono text-[11px] text-[var(--text-dim)] tabular-nums">
                        {Math.round(t.percent)}%
                      </span>
                    )}
                  </div>
                  {t.percent != null && (
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                      <div className="h-full rounded-full bg-[var(--human)]/70" style={{ width: `${t.percent}%` }} />
                    </div>
                  )}
                  {t.description && (
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{t.description}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {r.sections.map((s) => (
          <section key={s.key} className="mt-9">
            <h2 className="rule-label mb-3">{s.label}</h2>
            <div className="space-y-5">
              {s.items.map((item, i) => (
                <article key={i}>
                  <h3 className="font-serif text-[17px] font-semibold tracking-tight">{item.title}</h3>
                  {item.skill && <p className="rule-label mt-0.5">{item.skill}</p>}
                  <p className="mt-1.5 font-serif text-[14.5px] leading-[1.75] text-[var(--text-muted)]">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
