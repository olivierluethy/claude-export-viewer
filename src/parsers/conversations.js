/**
 * Parser for `conversations.json` — the bulk of the export (~64 MB here).
 *
 * VERIFIED shape (uniform across all 280 conversations — a single key set):
 *   { uuid, name, summary, created_at, updated_at,
 *     account: { uuid },
 *     chat_messages: [ message ] }
 *
 * message (uniform across all 3,631 messages):
 *   { uuid, text, sender: "human"|"assistant", created_at, updated_at,
 *     parent_message_uuid,
 *     attachments: [{ file_name, file_size, file_type, extracted_content }],
 *     files:       [{ file_uuid, file_name }],
 *     content:     [ block ] }
 *
 * Confirmed gotchas:
 *  - There is NO project field of any kind. 0/280. Project association must be
 *    inferred or set manually (see lib/projectLinks).
 *  - 7 conversations have `name: null`; 24 have an empty/absent summary.
 *  - 16 messages have neither content blocks nor text.
 */

import { normaliseBlocks, blocksToPlainText, collectLanguages } from './blocks.js'

const ts = (s) => (s ? Date.parse(s) || null : null)

export function parseConversations(raw, onProgress) {
  if (!Array.isArray(raw)) {
    throw new Error(`conversations.json: expected an array, got ${typeof raw}`)
  }

  const conversations = []
  const total = raw.length

  for (let i = 0; i < total; i++) {
    const c = raw[i]
    const tools = new Set()
    const languages = new Set()
    let hasCode = false
    let hasAttachments = false
    let humanCount = 0
    let assistantCount = 0
    let charCount = 0

    const messages = (c.chat_messages || []).map((m) => {
      const blocks = normaliseBlocks(m.content)
      const plain = blocksToPlainText(blocks)

      for (const b of blocks) {
        if (b.kind === 'tool_use') tools.add(b.name)
      }
      collectLanguages(blocks, languages)
      if (!hasCode) hasCode = plain.includes('```') || languages.size > 0

      const attachments = (m.attachments || []).map((a) => ({
        fileName: a.file_name ?? null,
        fileSize: a.file_size ?? null,
        fileType: a.file_type ?? null,
        extractedContent: a.extracted_content ?? '',
      }))
      if (attachments.length) hasAttachments = true

      if (m.sender === 'human') humanCount++
      else if (m.sender === 'assistant') assistantCount++
      charCount += plain.length

      return {
        uuid: m.uuid,
        sender: m.sender,
        createdAt: m.created_at ?? null,
        createdAtMs: ts(m.created_at),
        updatedAt: m.updated_at ?? null,
        parentUuid: m.parent_message_uuid ?? null,
        blocks,
        // `text` duplicates the text blocks; kept only as a fallback for the
        // 16 messages that carry no content array.
        fallbackText: blocks.length ? '' : (m.text ?? ''),
        attachments,
        files: (m.files || []).map((f) => ({ fileUuid: f.file_uuid ?? null, fileName: f.file_name ?? null })),
        plain,
      }
    })

    conversations.push({
      uuid: c.uuid,
      name: c.name || '', // 7 are null — the UI falls back to a dated label
      summary: c.summary || '',
      createdAt: c.created_at ?? null,
      createdAtMs: ts(c.created_at),
      updatedAt: c.updated_at ?? null,
      updatedAtMs: ts(c.updated_at),
      accountUuid: c.account?.uuid ?? null,
      messages,
      facets: {
        messageCount: messages.length,
        humanCount,
        assistantCount,
        charCount,
        tools: [...tools].sort(),
        languages: [...languages].sort(),
        hasCode,
        hasAttachments,
      },
    })

    if (onProgress && (i % 25 === 0 || i === total - 1)) onProgress(i + 1, total)
  }

  return conversations
}
