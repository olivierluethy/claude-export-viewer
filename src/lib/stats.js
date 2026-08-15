/**
 * Aggregations for the activity views.
 *
 * Empty buckets are filled in rather than skipped: a time axis that silently
 * omits quiet weeks misrepresents the shape of the archive.
 */

const DAY = 86_400_000

const pad = (n) => String(n).padStart(2, '0')

export function bucketKey(ms, granularity) {
  const d = new Date(ms)
  if (granularity === 'month') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  if (granularity === 'week') {
    // Monday-based week start.
    const start = new Date(d)
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function nextBucket(key, granularity) {
  if (granularity === 'month') {
    const [y, m] = key.split('-').map(Number)
    return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`
  }
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + (granularity === 'week' ? 7 : 1))
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function labelFor(key, granularity) {
  if (granularity === 'month') {
    const [y, m] = key.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
  }
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return granularity === 'week'
    ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * @returns {Array<{key,label,chats,human,assistant,messages,fromMs,toMs}>}
 */
export function buildActivitySeries(conversations, granularity = 'month') {
  const buckets = new Map()
  const touch = (key) => {
    if (!buckets.has(key)) buckets.set(key, { key, chats: 0, human: 0, assistant: 0, messages: 0 })
    return buckets.get(key)
  }

  for (const c of conversations) {
    if (c.createdAtMs) touch(bucketKey(c.createdAtMs, granularity)).chats++
    for (const m of c.messages) {
      if (!m.createdAtMs) continue
      const b = touch(bucketKey(m.createdAtMs, granularity))
      b.messages++
      if (m.sender === 'human') b.human++
      else if (m.sender === 'assistant') b.assistant++
    }
  }

  if (!buckets.size) return []

  const keys = [...buckets.keys()].sort()
  const out = []
  let key = keys[0]
  const last = keys[keys.length - 1]
  let guard = 0
  while (guard++ < 5000) {
    const b = buckets.get(key) ?? { key, chats: 0, human: 0, assistant: 0, messages: 0 }
    const [y, m, d] = key.split('-').map(Number)
    const fromMs = granularity === 'month' ? new Date(y, m - 1, 1).getTime() : new Date(y, m - 1, d).getTime()
    const span = granularity === 'month' ? new Date(y, m, 1).getTime() - fromMs : granularity === 'week' ? 7 * DAY : DAY
    out.push({ ...b, label: labelFor(key, granularity), fromMs, toMs: fromMs + span - 1 })
    if (key === last) break
    key = nextBucket(key, granularity)
  }
  return out
}

/** Conversation and message counts per project, using the link map. */
export function breakdownByProject(conversations, projects, links) {
  const rows = new Map(projects.map((p) => [p.uuid, { key: p.uuid, name: p.name, chats: 0, messages: 0 }]))
  let untracked = { key: '', name: 'No project matched', chats: 0, messages: 0 }

  for (const c of conversations) {
    const link = links?.byConversation.get(c.uuid)
    const row = link ? rows.get(link.projectUuid) : null
    const target = row ?? untracked
    target.chats++
    target.messages += c.facets.messageCount
  }

  return [...rows.values(), untracked].filter((r) => r.chats > 0).sort((a, b) => b.chats - a.chats)
}

/** Tool usage — counts actual calls, not just conversations that used the tool. */
export function breakdownByTool(conversations) {
  const calls = new Map()
  const chats = new Map()
  for (const c of conversations) {
    for (const t of c.facets.tools) chats.set(t, (chats.get(t) || 0) + 1)
    for (const m of c.messages) {
      for (const b of m.blocks) {
        if (b.kind === 'tool_use') calls.set(b.name, (calls.get(b.name) || 0) + 1)
      }
    }
  }
  return [...calls.entries()]
    .map(([name, n]) => ({ key: name, name, calls: n, chats: chats.get(name) || 0 }))
    .sort((a, b) => b.calls - a.calls)
}

export function breakdownByLanguage(conversations) {
  const chats = new Map()
  for (const c of conversations) for (const l of c.facets.languages) chats.set(l, (chats.get(l) || 0) + 1)
  return [...chats.entries()]
    .map(([name, n]) => ({ key: name, name, chats: n }))
    .sort((a, b) => b.chats - a.chats)
}

/**
 * Calendar of activity for the timeline: months (newest first), each with its
 * days (newest first), each day carrying its chat count and the chats started
 * that day. Lets the UI show *where information is* — counts and dates — before
 * anyone scrolls into the list.
 *
 * @returns {Array<{key, ms, total, days: Array<{key, ms, count, conversations}>}>}
 */
export function buildActivityCalendar(conversations) {
  const months = new Map()
  for (const c of conversations) {
    if (!c.createdAtMs) continue
    const d = new Date(c.createdAtMs)
    const mKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
    const dKey = `${mKey}-${pad(d.getDate())}`
    if (!months.has(mKey)) months.set(mKey, { key: mKey, ms: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), total: 0, days: new Map() })
    const month = months.get(mKey)
    month.total++
    if (!month.days.has(dKey)) month.days.set(dKey, { key: dKey, ms: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), count: 0, conversations: [] })
    const day = month.days.get(dKey)
    day.count++
    day.conversations.push(c)
  }

  return [...months.values()]
    .sort((a, b) => b.ms - a.ms)
    .map((m) => ({
      ...m,
      days: [...m.days.values()]
        .sort((a, b) => b.ms - a.ms)
        .map((day) => ({
          ...day,
          conversations: day.conversations.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0)),
        })),
    }))
}

/** Date-sorted timeline, grouped by month. */
export function buildTimeline(conversations) {
  const groups = new Map()
  for (const c of [...conversations].sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))) {
    if (!c.createdAtMs) continue
    const key = bucketKey(c.createdAtMs, 'month')
    if (!groups.has(key)) groups.set(key, { key, label: labelFor(key, 'month'), conversations: [] })
    groups.get(key).conversations.push(c)
  }
  return [...groups.values()]
}

export const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10)
