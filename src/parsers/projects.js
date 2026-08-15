/**
 * Parser for `projects/*.json` — one file per project (30 here).
 *
 * VERIFIED shape (uniform across all 30):
 *   { uuid, name, description, is_private, is_starter_project,
 *     prompt_template, created_at, updated_at,
 *     creator: {...},
 *     docs: [ { uuid, filename, content, created_at } ] }
 *
 * Reality check on this export — the fields are present but almost always empty:
 *   docs: 1 of 30 projects has any (1 doc in total)
 *   prompt_template: 0 of 30
 *   description: 1 of 30
 *   is_private: 30 of 30 · is_starter_project: 1 of 30
 * The substance for a project lives in `memories.json.project_memories`, which
 * is keyed by these same project UUIDs. See parsers/memories.js.
 */

const ts = (s) => (s ? Date.parse(s) || null : null)

export function parseProject(raw, sourcePath) {
  if (!raw || typeof raw !== 'object' || !raw.uuid) {
    throw new Error(`${sourcePath}: not a project object (missing uuid)`)
  }
  return {
    uuid: raw.uuid,
    name: raw.name || '',
    description: raw.description || '',
    promptTemplate: raw.prompt_template || '',
    isPrivate: !!raw.is_private,
    isStarterProject: !!raw.is_starter_project,
    createdAt: raw.created_at ?? null,
    createdAtMs: ts(raw.created_at),
    updatedAt: raw.updated_at ?? null,
    updatedAtMs: ts(raw.updated_at),
    creator: raw.creator ? { uuid: raw.creator.uuid ?? null, fullName: raw.creator.full_name ?? null } : null,
    docs: (raw.docs || []).map((d) => ({
      uuid: d.uuid ?? null,
      filename: d.filename || 'untitled',
      content: d.content ?? '',
      createdAt: d.created_at ?? null,
    })),
    sourcePath,
  }
}
