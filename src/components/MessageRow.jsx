/**
 * One turn in a thread, hung off the time rail.
 *
 * The rail is the app's structural device: a continuous ruled gutter carrying
 * monospace clock times, with a tick per turn coloured by speaker. Where a real
 * pause occurred between turns, the rail breaks and prints the elapsed time —
 * so the rhythm of a long session (the burst of work, the overnight gap, the
 * thread picked up months later) is legible at a glance.
 */

import { memo } from 'react'
import BlockRenderer, { Attachment } from './blocks/BlockRenderer.jsx'
import CopyButton from './ui/CopyButton.jsx'
import { fmtClock, fmtDate, fmtGap } from '../lib/format.js'
import { messageToMarkdown } from '../lib/toMarkdown.js'

/** The rail break that marks a genuine pause between two turns. */
export function GapMarker({ ms, crossesDay, atMs }) {
  return (
    <div className="grid grid-cols-[var(--gutter)_1fr] gap-x-3.5 [--gutter:4.25rem]">
      <div className="relative">
        <span className="absolute top-0 right-0 bottom-0 w-px border-l border-dashed border-[var(--rail)]" />
      </div>
      <div className="flex items-center gap-2.5 py-2.5">
        <span className="rule-label shrink-0">
          {fmtGap(ms)} later{crossesDay ? ` · ${fmtDate(atMs)}` : ''}
        </span>
        <span className="h-px flex-1 bg-[var(--edge)]" />
      </div>
    </div>
  )
}

function MessageRow({ message, index }) {
  const isHuman = message.sender === 'human'
  const ink = isHuman ? 'var(--human)' : 'var(--assistant)'
  const empty = !message.blocks.length && !message.fallbackText?.trim() && !message.attachments.length

  return (
    <article className="group grid grid-cols-[var(--gutter)_1fr] gap-x-3.5 break-inside-avoid [--gutter:4.25rem]">
      {/* rail gutter: rule on the right edge, tick centred on it, clock clear of both */}
      <div className="relative select-none">
        <span className="absolute top-0 right-0 bottom-0 w-px" style={{ background: 'var(--rail)' }} aria-hidden />
        <span
          className="absolute top-[0.6rem] -right-[2.5px] h-[6px] w-[6px] rounded-full ring-[3px] ring-[var(--surface)]"
          style={{ background: ink }}
          aria-hidden
        />
        <time
          className="block pt-[0.28rem] pr-3 text-right font-mono text-[11px] text-[var(--text-dim)] tabular-nums"
          dateTime={message.createdAt || undefined}
          title={message.createdAt || ''}
        >
          {fmtClock(message.createdAtMs)}
        </time>
      </div>

      {/* turn */}
      <div className="min-w-0 pb-7">
        <header className="mb-1.5 flex items-center gap-2">
          <h3 className="font-mono text-[11px] font-medium tracking-[0.09em] uppercase" style={{ color: ink }}>
            {isHuman ? 'You' : 'Claude'}
          </h3>
          <span className="rule-label opacity-0 transition-opacity group-hover:opacity-100 print:hidden">
            #{index + 1}
          </span>
          <CopyButton
            getText={() => messageToMarkdown(message, { includeThinking: true, includeTools: true })}
            label="Copy turn"
            copiedLabel="Copied"
            title="Copy this turn as markdown"
            className="ml-auto border-transparent opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 print:hidden"
          />
        </header>

        <div className="space-y-2">
          {message.blocks.map((block, i) => (
            <BlockRenderer key={i} block={block} anchorBase={`turn-${index}-b${i}`} />
          ))}

          {/* the 16 messages that carry no content array at all */}
          {!message.blocks.length && message.fallbackText?.trim() && (
            <p className="text-[14.5px] leading-[1.72] whitespace-pre-wrap">{message.fallbackText}</p>
          )}

          {empty && <p className="rule-label italic">empty message</p>}

          {message.attachments.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="rule-label">
                {message.attachments.length} attachment{message.attachments.length > 1 ? 's' : ''}
              </div>
              {message.attachments.map((a, i) => (
                <Attachment key={i} attachment={a} />
              ))}
            </div>
          )}

          {message.files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {message.files.map((f, i) => (
                <span
                  key={i}
                  className="rounded border border-[var(--edge)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)]"
                >
                  {f.fileName || f.fileUuid}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default memo(MessageRow)
