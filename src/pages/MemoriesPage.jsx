/**
 * Memory: the conversations memory blob, the per-project memories (joined back
 * to real projects by UUID), and the 43 memory files grouped by their folder.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useModel } from '../lib/ModelContext.jsx'
import Markdown from '../components/ui/Markdown.jsx'
import CopyButton from '../components/ui/CopyButton.jsx'
import { fmtDate } from '../lib/format.js'

const GROUP_LABEL = { areas: 'Areas', topics: 'Topics', root: 'Profile & preferences' }

export default function MemoriesPage() {
  const model = useModel()
  const mem = model.memories
  const [openFile, setOpenFile] = useState(null)

  const groups = useMemo(() => {
    const g = new Map()
    for (const f of mem?.files ?? []) {
      if (!g.has(f.group)) g.set(f.group, [])
      g.get(f.group).push(f)
    }
    return [...g.entries()].sort((a, b) => (a[0] === 'root' ? -1 : b[0] === 'root' ? 1 : a[0].localeCompare(b[0])))
  }, [mem])

  const projectMemories = useMemo(() => {
    const entries = Object.entries(mem?.projectMemories ?? {})
    return entries
      .map(([uuid, text]) => ({ uuid, text, project: model.projectsById.get(uuid) }))
      .sort((a, b) => (a.project?.name || '').localeCompare(b.project?.name || ''))
  }, [mem, model.projectsById])

  if (!mem) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-[13px] text-[var(--text-muted)]">This export contains no memory file.</p>
      </div>
    )
  }

  const active = openFile ?? mem.files[0]

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Stacks above the reader on narrow screens rather than squeezing it. */}
      <aside className="max-h-56 w-full shrink-0 overflow-y-auto border-b border-[var(--edge)] md:max-h-none md:w-[16rem] md:border-r md:border-b-0">
        <div className="border-b border-[var(--edge)] px-4 py-3">
          <h2 className="text-[13px] font-medium">Memory files</h2>
          <p className="rule-label mt-0.5">{mem.files.length} files</p>
        </div>
        {groups.map(([group, files]) => (
          <div key={group} className="py-2">
            <p className="rule-label px-4 py-1">{GROUP_LABEL[group] || group}</p>
            <ul>
              {files.map((f) => (
                <li key={f.path}>
                  <button
                    onClick={() => setOpenFile(f)}
                    className={`block w-full truncate px-4 py-1.5 text-left text-[12.5px] transition ${
                      active?.path === f.path
                        ? 'bg-[var(--surface-high)] text-[var(--text)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {f.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-10">
          {active && (
            <section className="mb-10">
              <div className="mb-2 flex flex-wrap items-baseline gap-2">
                <h1 className="font-serif text-[1.5rem] font-semibold tracking-tight">{active.name}</h1>
                <span className="rule-label">{active.path}</span>
                {active.updatedAtMs && (
                  <span className="rule-label before:mr-2 before:content-['·']">{fmtDate(active.updatedAtMs)}</span>
                )}
                <CopyButton getText={() => active.content} label="Copy" className="ml-auto" />
              </div>
              <div className="rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)] px-4 py-3">
                <Markdown>{active.content}</Markdown>
              </div>
            </section>
          )}

          {mem.conversationsMemory && (
            <section className="mb-10">
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-[13px] font-medium">Conversations memory</h2>
                <CopyButton getText={() => mem.conversationsMemory} label="Copy" className="ml-auto" />
              </div>
              <div className="rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)] px-4 py-3">
                <Markdown>{mem.conversationsMemory}</Markdown>
              </div>
            </section>
          )}

          {projectMemories.length > 0 && (
            <section>
              <h2 className="mb-1 text-[13px] font-medium">Project memories</h2>
              <p className="mb-3 text-[12px] text-[var(--text-dim)]">
                {projectMemories.length} entries, joined to projects by UUID.
              </p>
              <div className="space-y-3">
                {projectMemories.map((pm) => (
                  <article
                    key={pm.uuid}
                    className="rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)] px-4 py-3"
                  >
                    <div className="mb-1.5 flex items-baseline gap-2">
                      {pm.project ? (
                        <Link
                          to={`/projects/${pm.uuid}`}
                          className="text-[13.5px] font-medium hover:text-[var(--assistant)]"
                        >
                          {pm.project.name}
                        </Link>
                      ) : (
                        <span className="text-[13.5px] font-medium text-[var(--text-muted)]">
                          Project no longer in export
                        </span>
                      )}
                      <CopyButton getText={() => pm.text} label="Copy" className="ml-auto" />
                    </div>
                    <Markdown>{pm.text}</Markdown>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
