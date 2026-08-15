/**
 * Model → clean markdown, for the copy actions.
 *
 * Tool calls are summarised rather than dumped: the point of copying a chat is
 * to get the readable substance back out, with code intact.
 */

import { titleOf, fmtDateTime } from './format.js'

const fence = (code, lang = '') => {
  // Grow the fence if the content itself contains backtick runs.
  const longest = Math.max(2, ...[...String(code).matchAll(/`+/g)].map((m) => m[0].length))
  const bar = '`'.repeat(longest + 1)
  return `${bar}${lang}\n${String(code).replace(/\n$/, '')}\n${bar}`
}

function blockToMarkdown(b, { includeThinking, includeTools }) {
  switch (b.kind) {
    case 'text':
      return b.text?.trim() || ''
    case 'thinking':
      if (!includeThinking || !b.text?.trim()) return ''
      return `> **Thinking**\n>\n${b.text
        .trim()
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n')}`
    case 'tool_use': {
      if (!includeTools) return ''
      const head = `**⚙ ${b.name}**`
      if (b.display?.kind === 'code') return `${head}\n\n${fence(b.display.code, b.display.language || '')}`
      if (b.display?.kind === 'text' && b.display.text) return `${head} — ${b.display.text}`
      if (b.input && Object.keys(b.input).length) return `${head}\n\n${fence(JSON.stringify(b.input, null, 2), 'json')}`
      return head
    }
    case 'tool_result': {
      if (!includeTools) return ''
      const lines = []
      const label = b.isError ? `**⚠ ${b.name || 'tool'} failed**` : `**↳ ${b.name || 'result'}**`
      lines.push(label)
      for (const it of b.items) {
        if (it.kind === 'text' && it.text?.trim()) lines.push(fence(it.text.trim()))
        else if (it.kind === 'knowledge') lines.push(`- [${it.title || it.url}](${it.url})`)
        else if (it.kind === 'file') lines.push(`- \`${it.filePath || it.name}\``)
        else if (it.kind === 'image') lines.push('- _(image — not included in the export)_')
      }
      return lines.join('\n\n')
    }
    default:
      return ''
  }
}

export function messageToMarkdown(m, opts = { includeThinking: false, includeTools: true }) {
  const who = m.sender === 'human' ? 'You' : 'Claude'
  const body = m.blocks.length
    ? m.blocks
        .map((b) => blockToMarkdown(b, opts))
        .filter(Boolean)
        .join('\n\n')
    : m.fallbackText || ''

  const attach = m.attachments.length
    ? '\n\n' + m.attachments.map((a) => `_Attachment: ${a.fileName}_`).join('\n')
    : ''

  return `### ${who}\n\n${body}${attach}`.trim()
}

export function conversationToMarkdown(conv, opts = { includeThinking: false, includeTools: true }) {
  const header = [
    `# ${titleOf(conv)}`,
    '',
    `_${fmtDateTime(conv.createdAtMs)} — ${fmtDateTime(conv.updatedAtMs)} · ${conv.messages.length} messages_`,
    conv.summary?.trim() ? `\n${conv.summary.trim()}` : '',
    '',
    '---',
  ].join('\n')

  const body = conv.messages.map((m) => messageToMarkdown(m, opts)).join('\n\n---\n\n')
  return `${header}\n\n${body}\n`
}

/** Clipboard write with a fallback for non-secure contexts (e.g. plain http). */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
