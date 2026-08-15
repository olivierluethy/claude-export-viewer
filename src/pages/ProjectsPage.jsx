/**
 * Projects.
 *
 * Project files in this export are near-empty shells (1 of 30 has a doc, none
 * has a prompt template). The substance lives in `memories.json.project_memories`,
 * keyed by the same project UUIDs — so the detail view leads with the memory and
 * treats docs as a bonus when present.
 */

import { Link, useParams } from 'react-router-dom'
import { useModel } from '../lib/ModelContext.jsx'
import { CONFIDENCE_LABEL } from '../lib/projectLinks.js'
import Markdown from '../components/ui/Markdown.jsx'
import CopyButton from '../components/ui/CopyButton.jsx'
import Collapsible from '../components/ui/Collapsible.jsx'
import { fmtDate, fmtNum, titleOf } from '../lib/format.js'

const TONE = {
  manual: 'text-[var(--human)] border-[var(--human)]/40',
  high: 'text-[var(--assistant)] border-[var(--assistant)]/35',
  medium: 'text-[var(--text-muted)] border-[var(--edge-strong)]',
  low: 'text-[var(--text-dim)] border-dashed border-[var(--edge-strong)]',
}

export function ConfidenceBadge({ confidence }) {
  const c = CONFIDENCE_LABEL[confidence]
  if (!c) return null
  return (
    <span className={`shrink-0 rounded border px-1.5 py-px font-mono text-[10px] ${TONE[c.tone]}`}>{c.text}</span>
  )
}

export default function ProjectsPage() {
  const model = useModel()

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <p className="rule-label">Projects</p>
          <h1 className="mt-1.5 font-serif text-3xl font-semibold tracking-tight">
            {fmtNum(model.projects.length)} projects
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">
            Design chats link to a project directly. Regular conversations don’t carry a project in the export at
            all, so those links are inferred — every one is labelled with how it was matched.
          </p>
        </header>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {model.projects.map((p) => {
            const g = model.links.byProject.get(p.uuid) ?? { auto: [], manual: [], design: [] }
            const linked = g.auto.length + g.manual.length + g.design.length
            const hasMemory = !!model.memories?.projectMemories[p.uuid]
            return (
              <li key={p.uuid}>
                <Link
                  to={`/projects/${p.uuid}`}
                  className="flex h-full flex-col rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)] p-4 transition hover:border-[var(--edge-strong)]"
                >
                  <h2 className="text-[14px] leading-snug font-medium">{p.name || 'Untitled project'}</h2>
                  <p className="rule-label mt-1">{fmtDate(p.updatedAtMs)}</p>
                  {p.description && (
                    <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3">
                    <span className="font-mono text-[10.5px] text-[var(--text-dim)]">
                      {linked} chat{linked === 1 ? '' : 's'}
                    </span>
                    {hasMemory && <span className="font-mono text-[10.5px] text-[var(--assistant)]">memory</span>}
                    {p.docs.length > 0 && (
                      <span className="font-mono text-[10.5px] text-[var(--human)]">
                        {p.docs.length} doc{p.docs.length === 1 ? '' : 's'}
                      </span>
                    )}
                    {p.isStarterProject && <span className="rule-label">starter</span>}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function ChatLink({ conversation, link }) {
  return (
    <li>
      <Link
        to={`/chats/${conversation.uuid}`}
        className="flex items-baseline gap-2 rounded-md px-2 py-1.5 transition hover:bg-[var(--surface-high)]"
      >
        <span className="min-w-0 flex-1 truncate text-[13px]">{titleOf(conversation)}</span>
        <span className="shrink-0 font-mono text-[10.5px] text-[var(--text-dim)]">
          {fmtNum(conversation.facets.messageCount)} msg
        </span>
        {link && <ConfidenceBadge confidence={link.confidence} />}
      </Link>
    </li>
  )
}

export function ProjectRoute() {
  const model = useModel()
  const { uuid } = useParams()
  const project = model.projectsById.get(uuid)

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-[13px] text-[var(--text-muted)]">That project isn’t in this export.</p>
      </div>
    )
  }

  const g = model.links.byProject.get(project.uuid) ?? { auto: [], manual: [], design: [] }
  const memory = model.memories?.projectMemories[project.uuid] || ''

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/projects" className="rule-label hover:text-[var(--text-muted)]">
          ← all projects
        </Link>

        <header className="mt-3 border-b border-[var(--edge)] pb-5">
          <h1 className="font-serif text-[1.65rem] leading-tight font-semibold tracking-tight">{project.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-2.5">
            <span className="rule-label">{fmtDate(project.createdAtMs)}</span>
            <span className="rule-label before:mr-2.5 before:content-['·']">
              {project.isPrivate ? 'private' : 'shared'}
            </span>
            {project.isStarterProject && (
              <span className="rule-label before:mr-2.5 before:content-['·']">starter project</span>
            )}
          </div>
          {project.description && (
            <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--text-muted)]">{project.description}</p>
          )}
        </header>

        {memory && (
          <section className="mt-7">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-[13px] font-medium">What Claude remembers about this project</h2>
              <CopyButton getText={() => memory} label="Copy" className="ml-auto" />
            </div>
            <div className="rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)] px-4 py-3">
              <Markdown>{memory}</Markdown>
            </div>
          </section>
        )}

        {project.promptTemplate && (
          <section className="mt-7">
            <h2 className="mb-2 text-[13px] font-medium">Prompt template</h2>
            <div className="rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)] px-4 py-3">
              <Markdown>{project.promptTemplate}</Markdown>
            </div>
          </section>
        )}

        {project.docs.length > 0 && (
          <section className="mt-7">
            <h2 className="mb-2 text-[13px] font-medium">
              {project.docs.length} document{project.docs.length === 1 ? '' : 's'}
            </h2>
            <div className="space-y-2">
              {project.docs.map((d) => (
                <Collapsible
                  key={d.uuid}
                  defaultOpen={project.docs.length === 1}
                  summary={
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-[12px] text-[var(--human)]">{d.filename}</span>
                      <span className="rule-label">{fmtDate(Date.parse(d.createdAt))}</span>
                    </span>
                  }
                >
                  <div className="px-4 py-3">
                    <div className="mb-2 flex justify-end">
                      <CopyButton getText={() => d.content} label="Copy document" />
                    </div>
                    <Markdown>{d.content}</Markdown>
                  </div>
                </Collapsible>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="mb-1 text-[13px] font-medium">Chats in this project</h2>
          <p className="mb-3 text-[12px] text-[var(--text-dim)]">
            Design chats are linked by the export itself. Everything else is inferred or tagged by you.
          </p>

          {g.design.length > 0 && (
            <div className="mb-4">
              <p className="rule-label mb-1">from the export · design chats</p>
              <ul>
                {g.design.map((d) => (
                  <li key={d.uuid}>
                    <Link
                      to={`/design/${d.uuid}`}
                      className="flex items-baseline gap-2 rounded-md px-2 py-1.5 transition hover:bg-[var(--surface-high)]"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px]">{d.title || 'Design chat'}</span>
                      <span className="shrink-0 font-mono text-[10.5px] text-[var(--text-dim)]">
                        {d.messages.length} msg
                      </span>
                      <span
                        className="shrink-0 rounded border border-[var(--assistant)]/35 px-1.5 py-px font-mono text-[10px] text-[var(--assistant)]"
                        title="The export names this project on the design chat; matched to this project by name."
                      >
                        named by export
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {g.manual.length > 0 && (
            <div className="mb-4">
              <p className="rule-label mb-1">tagged by you</p>
              <ul>
                {g.manual.map((c) => (
                  <ChatLink key={c.uuid} conversation={c} link={model.links.byConversation.get(c.uuid)} />
                ))}
              </ul>
            </div>
          )}

          {g.auto.length > 0 && (
            <div>
              <p className="rule-label mb-1">inferred · {g.auto.length}</p>
              <ul>
                {g.auto.map((c) => (
                  <ChatLink key={c.uuid} conversation={c} link={model.links.byConversation.get(c.uuid)} />
                ))}
              </ul>
            </div>
          )}

          {!g.design.length && !g.manual.length && !g.auto.length && (
            <p className="rounded-lg border border-dashed border-[var(--edge-strong)] px-4 py-6 text-center text-[13px] text-[var(--text-muted)]">
              No chats matched this project. Open a conversation and tag it to link it here.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
