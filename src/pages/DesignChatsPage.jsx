/**
 * Design chats — a different shape from conversations, so a separate view.
 * All three are titled "Chat" in this export, so they're labelled by project.
 */

import { useCallback, useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useModel } from '../lib/ModelContext.jsx'
import CodeBlock from '../components/ui/CodeBlock.jsx'
import Collapsible from '../components/ui/Collapsible.jsx'
import CopyButton from '../components/ui/CopyButton.jsx'
import Prose from '../components/blocks/Prose.jsx'
import ChatTableOfContents from '../components/chat/ChatTableOfContents.jsx'
import ChatViewToggle from '../components/chat/ChatViewToggle.jsx'
import { MarkdownViewContext } from '../components/blocks/markdownView.js'
import { useChatViewMode } from '../lib/chatViewMode.js'
import { buildChatOutline } from '../lib/chatOutline.js'
import { useScrollSpy } from '../lib/useScrollSpy.js'
import { fmtClock, fmtDate, fmtNum, stripMarkdown } from '../lib/format.js'

const label = (d) => (d.projectName ? `${d.projectName} · design chat` : d.title || 'Design chat')

export default function DesignChatsPage() {
  const model = useModel()
  const byProject = new Map()
  for (const d of model.designChats) {
    const key = d.projectName || 'Unassigned'
    if (!byProject.has(key)) byProject.set(key, [])
    byProject.get(key).push(d)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-7">
          <p className="rule-label">Design chats</p>
          <h1 className="mt-1.5 font-serif text-3xl font-semibold tracking-tight">
            {model.designChats.length} design chats
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
            These are the only chats where the export names a project itself, so the grouping below is the
            export’s own, not inferred from text. The project is matched by name — a design chat’s
            <code className="mx-1 font-mono text-[11.5px]">project.uuid</code> belongs to a different namespace
            and matches no project file.
          </p>
        </header>

        {[...byProject.entries()].map(([project, chats]) => (
          <section key={project} className="mb-6">
            <h2 className="rule-label mb-2">{project}</h2>
            <ul className="space-y-2">
              {chats.map((d) => (
                <li key={d.uuid}>
                  <Link
                    to={`/design/${d.uuid}`}
                    className="flex items-baseline gap-3 rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)] px-4 py-3 transition hover:border-[var(--edge-strong)]"
                  >
                    <span className="flex-1 text-[13.5px] font-medium">{label(d)}</span>
                    <span className="font-mono text-[10.5px] text-[var(--text-dim)]">
                      {d.messages.length} messages
                    </span>
                    <span className="rule-label">{fmtDate(d.createdAtMs)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

/** Raw markdown for a single design-chat turn — copy is always the source. */
const designMessageToMarkdown = (m) => `### ${m.role === 'user' ? m.authorName || 'You' : 'Claude'}\n\n${m.plain}`.trim()

function DesignMessage({ message, index }) {
  const isUser = message.role === 'user'
  const ink = isUser ? 'var(--human)' : 'var(--assistant)'
  const toolCalls = message.blocks.filter((b) => b.kind === 'tool_use')
  const extraText = message.blocks.filter((b) => b.kind === 'text' && b.text?.trim())
  const base = `turn-${index}`

  return (
    <article
      id={base}
      data-spy={base}
      className="group grid scroll-mt-4 grid-cols-[var(--gutter)_1fr] gap-x-3.5 [--gutter:4.25rem]"
    >
      <div className="relative select-none">
        <span className="absolute top-0 right-0 bottom-0 w-px" style={{ background: 'var(--rail)' }} aria-hidden />
        <span
          className="absolute top-[0.6rem] -right-[2.5px] h-[6px] w-[6px] rounded-full ring-[3px] ring-[var(--surface)]"
          style={{ background: ink }}
          aria-hidden
        />
        <time className="block pt-[0.28rem] pr-3 text-right font-mono text-[11px] text-[var(--text-dim)] tabular-nums">
          {fmtClock(message.createdAtMs)}
        </time>
      </div>

      <div className="min-w-0 pb-7">
        <header className="mb-1.5 flex items-center gap-2">
          <h3 className="font-mono text-[11px] font-medium tracking-[0.09em] uppercase" style={{ color: ink }}>
            {isUser ? message.authorName || 'You' : 'Claude'}
          </h3>
          <CopyButton
            getText={() => designMessageToMarkdown(message)}
            label="Copy turn"
            copiedLabel="Copied"
            title="Copy this turn as markdown"
            className="ml-auto border-transparent opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 print:hidden"
          />
        </header>

        <div className="space-y-2">
          {message.text?.trim() && <Prose text={message.text} anchorBase={`${base}-t`} />}
          {extraText.map((b, i) => (
            <Prose key={i} text={b.text} anchorBase={`${base}-e${i}`} />
          ))}

          {toolCalls.length > 0 && (
            <Collapsible
              dense
              summary={
                <span className="rule-label">
                  {toolCalls.length} tool call{toolCalls.length === 1 ? '' : 's'}
                </span>
              }
            >
              <div className="space-y-2 px-3 py-2.5">
                {toolCalls.map((t, i) => (
                  <div key={i}>
                    <p className="font-mono text-[12px] text-[var(--assistant)]">{t.name}</p>
                    {t.input && <CodeBlock code={JSON.stringify(t.input, null, 2)} language="json" />}
                  </div>
                ))}
              </div>
            </Collapsible>
          )}

          {message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {message.attachments.map((a, i) => (
                <span
                  key={i}
                  className="rounded border border-[var(--edge)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)]"
                >
                  {a.fileName || 'attachment'}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

/** A turn's one-line label for the outline. */
const turnPreview = (m) => stripMarkdown(m.plain || m.text || '').slice(0, 70) || 'empty turn'

/** Metadata the export actually carries for a design chat — no invented fields. */
function DesignMeta({ chat, project }) {
  const users = chat.messages.filter((m) => m.role === 'user').length
  const assistants = chat.messages.filter((m) => m.role === 'assistant').length
  const toolCalls = chat.messages.reduce((n, m) => n + m.blocks.filter((b) => b.kind === 'tool_use').length, 0)
  const attachments = chat.messages.reduce((n, m) => n + m.attachments.length, 0)
  const spansDays = chat.updatedAtMs && chat.updatedAtMs - chat.createdAtMs > 864e5

  const items = [
    `${fmtNum(chat.messages.length)} messages`,
    `${fmtNum(users)} you · ${fmtNum(assistants)} Claude`,
    toolCalls ? `${fmtNum(toolCalls)} tool call${toolCalls === 1 ? '' : 's'}` : null,
    attachments ? `${fmtNum(attachments)} attachment${attachments === 1 ? '' : 's'}` : null,
    chat.title && chat.title !== 'Chat' ? `titled “${chat.title}”` : null,
  ].filter(Boolean)

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="rule-label">
        {fmtDate(chat.createdAtMs)}
        {spansDays ? ` → ${fmtDate(chat.updatedAtMs)}` : ''}
      </span>
      {items.map((t) => (
        <span key={t} className="rule-label before:mr-2.5 before:content-['·']">
          {t}
        </span>
      ))}
      {project && (
        <Link
          to={`/projects/${chat.resolvedProjectUuid}`}
          className="rule-label before:mr-2.5 before:content-['·'] hover:text-[var(--assistant)]"
        >
          project · {project.name}
        </Link>
      )}
    </div>
  )
}

export function DesignChatRoute() {
  const model = useModel()
  const { uuid } = useParams()
  const chat = model.designChatsById.get(uuid)
  const mdView = useChatViewMode()
  const scrollRef = useRef(null)

  const getScrollEl = useCallback(() => scrollRef.current, [])
  const activeId = useScrollSpy(getScrollEl, '[data-spy]', { threshold: 96, deps: [uuid] })

  const outline = useMemo(() => {
    if (!chat) return []
    return buildChatOutline(
      chat.messages.map((m, index) => {
        const segs = []
        if (m.text?.trim()) segs.push({ base: `turn-${index}-t`, text: m.text })
        m.blocks
          .filter((b) => b.kind === 'text' && b.text?.trim())
          .forEach((b, i) => segs.push({ base: `turn-${index}-e${i}`, text: b.text }))
        return {
          anchorId: `turn-${index}`,
          role: m.role === 'user' ? 'human' : 'assistant',
          roleLabel: m.role === 'user' ? 'You' : 'Claude',
          ms: m.createdAtMs,
          preview: turnPreview(m),
          proseSegments: segs,
        }
      }),
    )
  }, [chat])

  const jumpTo = useCallback((anchorId, fallbackId) => {
    ;(document.getElementById(anchorId) || document.getElementById(fallbackId))?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [])

  if (!chat) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-[13px] text-[var(--text-muted)]">That design chat isn’t in this export.</p>
      </div>
    )
  }

  const project = chat.resolvedProjectUuid ? model.projectsById.get(chat.resolvedProjectUuid) : null

  const asMarkdown = () =>
    [
      `# ${label(chat)}`,
      '',
      `_${fmtDate(chat.createdAtMs)} · ${chat.messages.length} messages_`,
      '',
      '---',
      '',
      chat.messages.map(designMessageToMarkdown).join('\n\n---\n\n'),
    ].join('\n')

  return (
    <MarkdownViewContext.Provider value={mdView}>
      <div className="flex h-full">
        <div ref={scrollRef} className="h-full min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-6 pt-8 pb-24">
            <Link to="/design" className="rule-label hover:text-[var(--text-muted)]">
              ← all design chats
            </Link>

            <header className="mt-3 mb-7 border-b border-[var(--edge)] pb-5">
              <h1 className="font-serif text-[1.65rem] font-semibold tracking-tight">{label(chat)}</h1>
              <DesignMeta chat={chat} project={project} />
              <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
                <CopyButton getText={asMarkdown} label="Copy chat as markdown" copiedLabel="Chat copied" />
                <ChatViewToggle />
              </div>
            </header>

            {chat.messages.map((m, i) => (
              <DesignMessage key={m.uuid} message={m} index={i} />
            ))}
          </div>
        </div>
        <ChatTableOfContents
          groups={outline}
          activeId={activeId}
          onJump={jumpTo}
          turnCount={chat.messages.length}
        />
      </div>
    </MarkdownViewContext.Provider>
  )
}
