/**
 * Design chats — a different shape from conversations, so a separate view.
 * All three are titled "Chat" in this export, so they're labelled by project.
 */

import { Link, useParams } from 'react-router-dom'
import { useModel } from '../lib/ModelContext.jsx'
import Markdown from '../components/ui/Markdown.jsx'
import CodeBlock from '../components/ui/CodeBlock.jsx'
import Collapsible from '../components/ui/Collapsible.jsx'
import CopyButton from '../components/ui/CopyButton.jsx'
import { fmtClock, fmtDate } from '../lib/format.js'

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

function DesignMessage({ message }) {
  const isUser = message.role === 'user'
  const ink = isUser ? 'var(--human)' : 'var(--assistant)'
  const toolCalls = message.blocks.filter((b) => b.kind === 'tool_use')
  const extraText = message.blocks.filter((b) => b.kind === 'text' && b.text?.trim())

  return (
    <article className="group grid grid-cols-[var(--gutter)_1fr] gap-x-3.5 [--gutter:4.25rem]">
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
        </header>

        <div className="space-y-2">
          {message.text && <Markdown>{message.text}</Markdown>}
          {extraText.map((b, i) => (
            <Markdown key={i}>{b.text}</Markdown>
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

export function DesignChatRoute() {
  const model = useModel()
  const { uuid } = useParams()
  const chat = model.designChatsById.get(uuid)

  if (!chat) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-[13px] text-[var(--text-muted)]">That design chat isn’t in this export.</p>
      </div>
    )
  }

  const asMarkdown = () =>
    [
      `# ${label(chat)}`,
      '',
      `_${fmtDate(chat.createdAtMs)} · ${chat.messages.length} messages_`,
      '',
      '---',
      '',
      chat.messages
        .map((m) => `### ${m.role === 'user' ? m.authorName || 'You' : 'Claude'}\n\n${m.plain}`)
        .join('\n\n---\n\n'),
    ].join('\n')

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/design" className="rule-label hover:text-[var(--text-muted)]">
          ← all design chats
        </Link>

        <header className="mt-3 mb-7 border-b border-[var(--edge)] pb-5">
          <h1 className="font-serif text-[1.65rem] font-semibold tracking-tight">{label(chat)}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5">
            <span className="rule-label">{fmtDate(chat.createdAtMs)}</span>
            <span className="rule-label before:mr-2.5 before:content-['·']">{chat.messages.length} messages</span>
            {chat.resolvedProjectUuid && (
              <Link
                to={`/projects/${chat.resolvedProjectUuid}`}
                className="rule-label before:mr-2.5 before:content-['·'] hover:text-[var(--assistant)]"
              >
                open project
              </Link>
            )}
          </div>
          <div className="mt-4 print:hidden">
            <CopyButton getText={asMarkdown} label="Copy chat as markdown" copiedLabel="Chat copied" />
          </div>
        </header>

        {chat.messages.map((m) => (
          <DesignMessage key={m.uuid} message={m} />
        ))}
      </div>
    </div>
  )
}
