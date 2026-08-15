/**
 * Parser for `reflections/*.json` (1 file here, containing 2 periods).
 *
 * VERIFIED shape:
 *   { account_uuid, feedback: [], reflections: [ { period, content } ] }
 *
 * `content` carries more than the spec suggested — the full observed key set is:
 *   period               string
 *   hero_title           string
 *   hero_body            string
 *   stats                [{ label, n, sublabel }]
 *   topics               [{ title, description, percent }]
 *   about_your_time      [{ title, body }]
 *   expanding_your_skills[{ title, body, skill }]
 *   worth_thinking_about [{ title, body }]
 * Observed periods: "2026-06", "2026-07". `feedback` was empty.
 */

const arr = (v) => (Array.isArray(v) ? v : [])

export function parseReflections(raw, sourcePath) {
  if (!raw || typeof raw !== 'object') throw new Error(`${sourcePath}: not an object`)

  const periods = arr(raw.reflections).map((r) => {
    const c = r.content || {}
    return {
      period: r.period ?? c.period ?? '',
      heroTitle: c.hero_title || '',
      heroBody: c.hero_body || '',
      stats: arr(c.stats).map((s) => ({ label: s.label ?? '', n: s.n ?? null, sublabel: s.sublabel ?? '' })),
      topics: arr(c.topics).map((t) => ({
        title: t.title ?? '',
        description: t.description ?? '',
        percent: typeof t.percent === 'number' ? t.percent : null,
      })),
      sections: [
        { key: 'about_your_time', label: 'About your time', items: arr(c.about_your_time) },
        { key: 'expanding_your_skills', label: 'Expanding your skills', items: arr(c.expanding_your_skills) },
        { key: 'worth_thinking_about', label: 'Worth thinking about', items: arr(c.worth_thinking_about) },
      ]
        .filter((s) => s.items.length)
        .map((s) => ({
          ...s,
          items: s.items.map((i) => ({ title: i.title ?? '', body: i.body ?? '', skill: i.skill ?? null })),
        })),
    }
  })

  return {
    accountUuid: raw.account_uuid ?? null,
    periods: periods.sort((a, b) => String(b.period).localeCompare(String(a.period))),
    feedback: arr(raw.feedback),
    sourcePath,
  }
}
