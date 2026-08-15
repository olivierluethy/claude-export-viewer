/**
 * Parser for `login_history.json`.
 *
 * VERIFIED shape — an OBJECT, not an array (the spec said array):
 *   { login_events: [ { account_uuid, timestamp, method,
 *                       ip_address, user_agent, location_info } ] }
 * 37 events in this export. Both shapes are accepted defensively.
 */

const ts = (s) => (s ? Date.parse(s) || null : null)

export function parseLoginHistory(raw, sourcePath) {
  const events = Array.isArray(raw) ? raw : Array.isArray(raw?.login_events) ? raw.login_events : null
  if (!events) throw new Error(`${sourcePath}: expected { login_events: [] } or an array`)
  return events
    .map((e) => ({
      timestamp: e.timestamp ?? null,
      timestampMs: ts(e.timestamp),
      method: e.method ?? null,
      ipAddress: e.ip_address ?? null,
      userAgent: e.user_agent ?? null,
      location: e.location_info ?? null,
    }))
    .sort((a, b) => (b.timestampMs ?? 0) - (a.timestampMs ?? 0))
}
