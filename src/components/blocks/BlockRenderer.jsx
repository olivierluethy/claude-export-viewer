/**
 * Renders one normalised content block. Every block kind the parser can emit is
 * handled here, including the ones the export docs don't mention (thinking,
 * token_budget, flag) and the richer tool_result item kinds (knowledge,
 * local_resource, image).
 */

import CodeBlock from '../ui/CodeBlock.jsx'
import Collapsible from '../ui/Collapsible.jsx'
import Prose from './Prose.jsx'
import { fmtBytes } from '../../lib/format.js'
import { usePrinting, usePrintOptions } from '../../lib/printing.js'

/* ---------------------------------------------------------------- thinking */

function ThinkingBlock({ block }) {
  if (!block.text?.trim()) return null
  return (
    <Collapsible
      tone="thinking"
      dense
      summary={
        <span className="flex items-center gap-2">
          <span className="rule-label">Extended thinking</span>
          <span className="text-[11px] text-[var(--text-dim)]">
            {block.text.trim().split(/\s+/).length.toLocaleString()} words
            {block.cutOff ? ' · cut off' : ''}
          </span>
        </span>
      }
    >
      <div className="px-3 py-2.5 text-[var(--text-muted)] italic">
        <Prose text={block.text} />
      </div>
    </Collapsible>
  )
}

/* ---------------------------------------------------------------- tool use */

function ToolIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M14.5 5.5a4 4 0 0 0 5 5L21 9v6a2 2 0 0 1-2 2H8" strokeLinecap="round" />
      <path d="M3 12V7a2 2 0 0 1 2-2h6" strokeLinecap="round" />
      <path d="m3 21 6-6" strokeLinecap="round" />
    </svg>
  )
}

function ToolUseBlock({ block }) {
  const d = block.display
  const preview =
    d?.kind === 'text' ? d.text : d?.kind === 'code' ? d.filename || d.language : block.message || null

  return (
    <Collapsible
      dense
      summary={
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <ToolIcon className="inline-block h-3.5 w-3.5 shrink-0 translate-y-0.5 text-[var(--text-dim)]" />
          <span className="font-mono text-[12px] font-medium text-[var(--assistant)]">{block.name}</span>
          {block.integrationName && (
            <span className="rule-label">{block.integrationName}</span>
          )}
          {preview && (
            <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-muted)]">{preview}</span>
          )}
        </span>
      }
    >
      <div className="px-3 py-2.5">
        {d?.kind === 'code' ? (
          <CodeBlock code={d.code} language={d.language} filename={d.filename} />
        ) : d?.kind === 'table' ? (
          <KeyValueTable rows={d.rows} />
        ) : d?.kind === 'text' ? (
          <p className="font-mono text-[12.5px] whitespace-pre-wrap text-[var(--text-muted)]">{d.text}</p>
        ) : d?.kind === 'links' ? (
          <LinkList links={d.links} />
        ) : null}

        {block.input && Object.keys(block.input).length > 0 && (
          <details className="mt-2" open={!d}>
            <summary className="rule-label cursor-pointer select-none hover:text-[var(--text-muted)]">
              input
            </summary>
            <CodeBlock code={JSON.stringify(block.input, null, 2)} language="json" />
          </details>
        )}
      </div>
    </Collapsible>
  )
}

/** tool_use display_content of kind `table`: array of [key, value] rows. */
function KeyValueTable({ rows }) {
  if (!rows?.length) return null
  return (
    <div className="scroll-x rounded-lg border border-[var(--edge)]">
      <table className="w-full border-collapse font-mono text-[12px]">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--edge)] last:border-0">
              {(Array.isArray(row) ? row : [row]).map((cell, j) => (
                <td
                  key={j}
                  className={`px-2.5 py-1.5 align-top ${j === 0 ? 'w-32 text-[var(--text-dim)]' : 'break-all'}`}
                >
                  {String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------- tool result */

function LinkList({ links }) {
  if (!links?.length) return null
  return (
    <ul className="space-y-1.5">
      {links.map((l, i) => (
        <li key={i}>
          <a
            href={l.url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-baseline gap-2"
          >
            <span className="truncate text-[13px] text-[var(--assistant)] group-hover:underline">
              {l.title || l.url}
            </span>
            {l.source && <span className="rule-label shrink-0">{l.source}</span>}
          </a>
        </li>
      ))}
    </ul>
  )
}

function KnowledgeCard({ item }) {
  return (
    <li className="rounded-md border border-[var(--edge)] bg-[var(--surface-sunken)] px-3 py-2">
      <a
        href={item.url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[13px] font-medium text-[var(--assistant)] hover:underline"
      >
        {item.title || item.url || 'Untitled source'}
      </a>
      <div className="rule-label mt-0.5 truncate">
        {item.siteName || item.url}
        {item.isMissing && ' · not retrieved'}
      </div>
      {item.text?.trim() && (
        <p className="mt-1.5 line-clamp-4 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{item.text}</p>
      )}
    </li>
  )
}

function ToolResultBlock({ block }) {
  const knowledge = block.items.filter((i) => i.kind === 'knowledge')
  const texts = block.items.filter((i) => i.kind === 'text')
  const files = block.items.filter((i) => i.kind === 'file')
  const images = block.items.filter((i) => i.kind === 'image' || i.kind === 'image_gallery')

  const bits = []
  if (texts.length) bits.push(`${texts.length} output`)
  if (knowledge.length) bits.push(`${knowledge.length} source${knowledge.length > 1 ? 's' : ''}`)
  if (files.length) bits.push(`${files.length} file${files.length > 1 ? 's' : ''}`)
  if (images.length) bits.push(`${images.length} image${images.length > 1 ? 's' : ''}`)

  return (
    <Collapsible
      dense
      tone={block.isError ? 'error' : 'neutral'}
      summary={
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span
            className={`font-mono text-[12px] ${block.isError ? 'font-medium text-red-300' : 'text-[var(--text-muted)]'}`}
          >
            {block.isError ? '⚠ failed' : '↳ result'}
            {block.name ? ` · ${block.name}` : ''}
          </span>
          <span className="rule-label">{bits.join(' · ') || 'empty'}</span>
        </span>
      }
    >
      <div className="space-y-2.5 px-3 py-2.5">
        {texts.map((t, i) => (
          <CodeBlock key={`t${i}`} code={t.text} language="text" />
        ))}

        {knowledge.length > 0 && (
          <div>
            <div className="rule-label mb-1.5">sources</div>
            <ul className="space-y-1.5">
              {knowledge.map((k, i) => (
                <KnowledgeCard key={`k${i}`} item={k} />
              ))}
            </ul>
          </div>
        )}

        {files.length > 0 && (
          <div>
            <div className="rule-label mb-1.5">files produced</div>
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li key={`f${i}`} className="flex items-baseline gap-2 font-mono text-[12px]">
                  <span className="text-[var(--human)]">{f.name || '—'}</span>
                  <span className="truncate text-[var(--text-dim)]">{f.filePath}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {images.length > 0 && (
          <p className="rule-label">
            {images.length} image{images.length > 1 ? 's' : ''} — image data is not included in Claude exports
          </p>
        )}
      </div>
    </Collapsible>
  )
}

/* --------------------------------------------------------------- dispatch */

export default function BlockRenderer({ block, anchorBase }) {
  const printing = usePrinting()
  const printOptions = usePrintOptions()

  // On paper, tool output and reasoning are opt-out — see lib/printing.js.
  if (printing && !printOptions.tools && (block.kind === 'tool_use' || block.kind === 'tool_result')) return null
  if (printing && !printOptions.thinking && block.kind === 'thinking') return null

  switch (block.kind) {
    case 'text':
      return block.text?.trim() ? <Prose text={block.text} anchorBase={anchorBase} /> : null
    case 'thinking':
      return <ThinkingBlock block={block} />
    case 'tool_use':
      return <ToolUseBlock block={block} />
    case 'tool_result':
      return <ToolResultBlock block={block} />
    case 'flag':
      return (
        <p className="rule-label rounded border border-[var(--edge)] px-2 py-1">
          conversation flagged{block.flag ? ` · ${block.flag}` : ''}
        </p>
      )
    case 'token_budget':
      return null // bookkeeping, not content
    default:
      return (
        <Collapsible
          dense
          summary={<span className="rule-label">unrecognised block · {block.type ?? 'unknown'}</span>}
        >
          <CodeBlock code={JSON.stringify(block.raw ?? block, null, 2)} language="json" />
        </Collapsible>
      )
  }
}

/* ------------------------------------------------------------ attachments */

export function Attachment({ attachment }) {
  const hasContent = !!attachment.extractedContent?.trim()
  const head = (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-mono text-[12px] text-[var(--human)]">{attachment.fileName || 'attachment'}</span>
      <span className="rule-label">
        {[attachment.fileType, fmtBytes(attachment.fileSize)].filter(Boolean).join(' · ')}
      </span>
    </span>
  )

  if (!hasContent) {
    return <div className="rounded-lg border border-[var(--edge)] bg-[var(--surface-raised)] px-2.5 py-1.5">{head}</div>
  }

  return (
    <Collapsible dense summary={head}>
      <div className="px-3 py-2.5">
        <CodeBlock code={attachment.extractedContent} language="text" filename={attachment.fileName} />
      </div>
    </Collapsible>
  )
}
