/**
 * Content-block normaliser for `conversations.json` messages.
 *
 * VERIFIED against the real export (280 convs / 3,631 msgs). Block `type` values
 * observed, with counts:
 *   text (4848) · tool_use (2549) · tool_result (2542) · thinking (810) ·
 *   token_budget (119) · flag (1)
 *
 * Notes that cost real debugging time — do not "simplify" these away:
 *  - `tool_use.input` is ALREADY an object. Never JSON.parse it.
 *  - `display_content.json_block` IS a JSON *string*, and must be parsed. It
 *    decodes to `{ language, code }`.
 *  - `tool_result.content` was an array in 2542/2542 cases, but the string form
 *    is documented upstream so we still accept it.
 *  - `tool_result.content[]` items are NOT all text. Observed:
 *    knowledge (2510) · text (1847) · local_resource (455) · image (66) ·
 *    image_gallery (1)
 *  - `display_content` and `structured_content` are frequently null.
 */

/** display_content shapes: json_block|text|table|code_block|rich_content|rich_link */
function normaliseDisplay(dc) {
  if (!dc || typeof dc !== 'object') return null
  switch (dc.type) {
    case 'json_block': {
      // A JSON string holding { language, code }.
      let parsed = null
      try {
        parsed = JSON.parse(dc.json_block)
      } catch {
        parsed = null
      }
      return parsed && typeof parsed === 'object'
        ? { kind: 'code', language: parsed.language || 'text', code: String(parsed.code ?? '') }
        : { kind: 'text', text: String(dc.json_block ?? '') }
    }
    case 'code_block':
      return { kind: 'code', language: dc.language || 'text', code: dc.code ?? '', filename: dc.filename || null }
    case 'text':
      return { kind: 'text', text: dc.text ?? '' }
    case 'table':
      // Array of rows, each row an array of cells.
      return { kind: 'table', rows: Array.isArray(dc.table) ? dc.table : [] }
    case 'rich_content':
      return { kind: 'links', links: (Array.isArray(dc.content) ? dc.content : []).map(normaliseLink) }
    case 'rich_link':
      return { kind: 'links', links: dc.link ? [normaliseLink(dc.link)] : [] }
    default:
      return { kind: 'unknown', type: dc.type ?? null, raw: dc }
  }
}

/** { title, subtitles, url, resource_type, icon_url, source } */
function normaliseLink(l) {
  return {
    title: l?.title ?? null,
    url: l?.url ?? null,
    source: l?.source ?? null,
    iconUrl: l?.icon_url ?? null,
    subtitles: l?.subtitles ?? null,
  }
}

/** tool_result.content[] item → normalised item */
function normaliseResultItem(item) {
  if (typeof item === 'string') return { kind: 'text', text: item }
  if (!item || typeof item !== 'object') return null
  switch (item.type) {
    case 'text':
      return { kind: 'text', text: item.text ?? '' }
    case 'knowledge':
      // Web-search / fetch result. `text` is the extracted page snippet.
      return {
        kind: 'knowledge',
        title: item.title ?? null,
        url: item.url ?? null,
        text: item.text ?? '',
        isMissing: !!item.is_missing,
        isCitable: !!item.is_citable,
        siteName: item.metadata?.site_name ?? item.metadata?.site_domain ?? null,
        faviconUrl: item.metadata?.favicon_url ?? null,
      }
    case 'local_resource':
      // A file the sandbox produced. Bytes are NOT in the export — path only.
      return {
        kind: 'file',
        name: item.name ?? null,
        filePath: item.file_path ?? null,
        mimeType: item.mime_type ?? null,
        uuid: item.uuid ?? null,
      }
    case 'image':
      // Only a file_uuid; no image bytes ship in the export.
      return { kind: 'image', fileUuid: item.file_uuid ?? null }
    case 'image_gallery':
      return { kind: 'image_gallery', raw: item }
    default:
      return { kind: 'unknown', type: item.type ?? null, raw: item }
  }
}

function toResultItems(content) {
  if (typeof content === 'string') return content ? [{ kind: 'text', text: content }] : []
  if (!Array.isArray(content)) return []
  return content.map(normaliseResultItem).filter(Boolean)
}

/**
 * @param {Array} content raw message.content
 * @returns {Array} normalised blocks, each with a `kind`
 */
export function normaliseBlocks(content) {
  if (!Array.isArray(content)) return []
  const out = []
  for (const b of content) {
    if (!b || typeof b !== 'object') continue
    switch (b.type) {
      case 'text':
        out.push({
          kind: 'text',
          text: b.text ?? '',
          citations: Array.isArray(b.citations) ? b.citations : [],
        })
        break
      case 'thinking':
        out.push({
          kind: 'thinking',
          text: b.thinking ?? '',
          summaries: Array.isArray(b.summaries) ? b.summaries : [],
          cutOff: !!b.cut_off,
          truncated: !!b.truncated,
        })
        break
      case 'tool_use':
        out.push({
          kind: 'tool_use',
          id: b.id ?? null,
          name: b.name ?? 'unknown_tool',
          input: b.input ?? null, // already an object — do not parse
          message: b.message ?? null,
          iconName: b.icon_name ?? null,
          integrationName: b.integration_name ?? null,
          display: normaliseDisplay(b.display_content),
        })
        break
      case 'tool_result':
        out.push({
          kind: 'tool_result',
          toolUseId: b.tool_use_id ?? null,
          name: b.name ?? null,
          isError: !!b.is_error,
          message: b.message ?? null,
          iconName: b.icon_name ?? null,
          items: toResultItems(b.content),
          display: normaliseDisplay(b.display_content),
        })
        break
      case 'token_budget':
        out.push({ kind: 'token_budget', remaining: b.remaining ?? null })
        break
      case 'flag':
        out.push({ kind: 'flag', flag: b.flag ?? null, helpline: b.helpline ?? null })
        break
      default:
        out.push({ kind: 'unknown', type: b.type ?? null, raw: b })
    }
  }
  return out
}

/** Plain-text projection of a message, used for search indexing and facets. */
export function blocksToPlainText(blocks, { includeThinking = true } = {}) {
  const parts = []
  for (const b of blocks) {
    if (b.kind === 'text') parts.push(b.text)
    else if (b.kind === 'thinking' && includeThinking) parts.push(b.text)
    else if (b.kind === 'tool_use') {
      if (b.display?.kind === 'code') parts.push(b.display.code)
      else if (b.display?.kind === 'text') parts.push(b.display.text)
      else if (b.input) parts.push(safeStringify(b.input))
    } else if (b.kind === 'tool_result') {
      for (const it of b.items) {
        if (it.kind === 'text') parts.push(it.text)
        else if (it.kind === 'knowledge') parts.push(`${it.title ?? ''} ${it.text ?? ''}`)
        else if (it.kind === 'file') parts.push(it.name ?? '')
      }
    }
  }
  return parts.join('\n')
}

function safeStringify(v) {
  try {
    return JSON.stringify(v)
  } catch {
    return ''
  }
}

const FENCE_RE = /```([A-Za-z0-9_+#.-]+)/g

/** Languages named on fenced code blocks, plus languages of code display blocks. */
export function collectLanguages(blocks, sink) {
  for (const b of blocks) {
    if (b.kind === 'text' || b.kind === 'thinking') {
      for (const m of String(b.text).matchAll(FENCE_RE)) sink.add(m[1].toLowerCase())
    } else if ((b.kind === 'tool_use' || b.kind === 'tool_result') && b.display?.kind === 'code') {
      if (b.display.language) sink.add(String(b.display.language).toLowerCase())
    }
  }
}
