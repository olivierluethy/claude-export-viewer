/**
 * Parser for `users.json`.
 *
 * VERIFIED shape: array with one entry:
 *   [ { uuid, full_name, email_address, verified_phone_number } ]
 *
 * This is the most directly identifying file in the export. It is parsed and
 * held in memory like everything else, but the UI keeps email and phone masked
 * behind an explicit reveal.
 */

export function parseUsers(raw, sourcePath) {
  const u = Array.isArray(raw) ? raw[0] : raw
  if (!u || typeof u !== 'object') throw new Error(`${sourcePath}: expected an array with one user object`)
  return {
    uuid: u.uuid ?? null,
    fullName: u.full_name ?? '',
    email: u.email_address ?? '',
    phone: u.verified_phone_number ?? '',
  }
}
