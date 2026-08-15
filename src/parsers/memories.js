/**
 * Parser for `memories.json`.
 *
 * VERIFIED shape: an ARRAY containing exactly one object:
 *   [ { account_uuid,
 *       conversations_memory: string,          (8.6 KB here)
 *       project_memories:     { [projectUuid]: string },   (25 entries)
 *       memory_files:         [ { path, content, updated_at } ] } ]   (43 files)
 *
 * Confirmed join: all 25 `project_memories` keys are real project UUIDs from
 * `projects/*.json`. 5 of the 30 projects have no memory entry. This is what
 * gives the Projects view real content, since project docs are near-empty.
 *
 * `memory_files` paths are grouped by top-level folder:
 *   /areas/*.md · /topics/*.md · /profile.md · /preferences.md
 */

const ts = (s) => (s ? Date.parse(s) || null : null)

export function parseMemories(raw, sourcePath) {
  const obj = Array.isArray(raw) ? raw[0] : raw
  if (!obj || typeof obj !== 'object') throw new Error(`${sourcePath}: expected an object (or array of one)`)

  const files = (obj.memory_files || []).map((f) => {
    const path = f.path || ''
    const segments = path.split('/').filter(Boolean)
    return {
      path,
      // Top-level folder, or "root" for /profile.md and /preferences.md
      group: segments.length > 1 ? segments[0] : 'root',
      name: (segments[segments.length - 1] || path).replace(/\.md$/i, ''),
      content: f.content ?? '',
      updatedAt: f.updated_at ?? null,
      updatedAtMs: ts(f.updated_at),
    }
  })

  const projectMemories = obj.project_memories && typeof obj.project_memories === 'object' ? obj.project_memories : {}

  return {
    accountUuid: obj.account_uuid ?? null,
    conversationsMemory: obj.conversations_memory ?? '',
    projectMemories, // keyed by project uuid
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    sourcePath,
  }
}
