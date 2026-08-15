/**
 * Parser for `design_chats/*.json` (3 here, 30 messages total).
 *
 * This shape is DIFFERENT from conversations.json — do not share code with it.
 *
 * VERIFIED shape (uniform across all 3):
 *   { uuid, title,
 *     project: { uuid, name },      <- the only explicit project link anywhere
 *     created_at, updated_at,
 *     messages: [ { uuid, role: "user"|"assistant", content, created_at } ] }
 *
 * `content` is an OBJECT wrapping the message; its inner `.content` is a STRING
 * in every observed case (15 user / 15 assistant):
 *   user      -> { attachments, authorAccountUuid, authorName, content, id, role, timestamp }
 *   assistant -> { id, role, content, contentBlocks, timestamp }
 *
 * `contentBlocks` (assistant only) observed types:
 *   tool_call (115, payload under `toolCall`) · text (76) · thinking (1)
 *
 * All 3 chats are literally titled "Chat", so the UI labels them by project.
 */

const ts = (s) => (s ? Date.parse(s) || null : null)

function normaliseDesignBlocks(blocks) {
  if (!Array.isArray(blocks)) return []
  return blocks.map((b) => {
    if (b?.type === 'text') return { kind: 'text', text: b.text ?? '' }
    if (b?.type === 'thinking') return { kind: 'thinking', text: b.text ?? '' }
    if (b?.type === 'tool_call') {
      const tc = b.toolCall || {}
      return {
        kind: 'tool_use',
        id: tc.id ?? null,
        name: tc.name || tc.toolName || 'tool_call',
        input: tc.input ?? tc.args ?? null,
        raw: tc,
      }
    }
    return { kind: 'unknown', type: b?.type ?? null, raw: b }
  })
}

export function parseDesignChat(raw, sourcePath) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.messages)) {
    throw new Error(`${sourcePath}: not a design chat (missing messages array)`)
  }

  const messages = raw.messages.map((m) => {
    const inner = m.content && typeof m.content === 'object' ? m.content : {}
    const text = typeof inner.content === 'string' ? inner.content : ''
    const blocks = normaliseDesignBlocks(inner.contentBlocks)
    return {
      uuid: m.uuid,
      role: m.role, // "user" | "assistant"
      createdAt: m.created_at ?? inner.timestamp ?? null,
      createdAtMs: ts(m.created_at ?? inner.timestamp),
      authorName: inner.authorName ?? null,
      text,
      blocks,
      attachments: (inner.attachments || []).map((a) => ({
        fileName: a.file_name ?? a.fileName ?? a.name ?? null,
        fileType: a.file_type ?? a.fileType ?? null,
        extractedContent: a.extracted_content ?? a.extractedContent ?? '',
      })),
      plain: [text, ...blocks.filter((b) => b.kind === 'text' || b.kind === 'thinking').map((b) => b.text)]
        .filter(Boolean)
        .join('\n'),
    }
  })

  return {
    uuid: raw.uuid,
    title: raw.title || '',
    projectUuid: raw.project?.uuid ?? null,
    projectName: raw.project?.name ?? null,
    createdAt: raw.created_at ?? null,
    createdAtMs: ts(raw.created_at),
    updatedAt: raw.updated_at ?? null,
    updatedAtMs: ts(raw.updated_at),
    messages,
    sourcePath,
  }
}
