/**
 * Shows how a conversation got its project, and lets you override it.
 *
 * Regular conversations carry no project in the export, so whatever is shown
 * here is either your own tag or this app's guess — and it always says which.
 */

import { useModel } from '../lib/ModelContext.jsx'
import { Link } from 'react-router-dom'
import { ConfidenceBadge } from '../pages/ProjectsPage.jsx'

export default function ProjectTagger({ conversation }) {
  const model = useModel()
  const link = model.links.byConversation.get(conversation.uuid)
  const project = link ? model.projectsById.get(link.projectUuid) : null

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
      <span className="rule-label">project</span>

      {project ? (
        <Link to={`/projects/${project.uuid}`} className="text-[12.5px] font-medium hover:text-[var(--assistant)]">
          {project.name}
        </Link>
      ) : (
        <span className="text-[12.5px] text-[var(--text-dim)]">none</span>
      )}

      {link && <ConfidenceBadge confidence={link.confidence} />}

      <select
        value={model.tags[conversation.uuid] || ''}
        onChange={(e) => model.setTag(conversation.uuid, e.target.value || null)}
        title={link?.reason || 'Assign this conversation to a project'}
        className="ml-auto rounded-md border border-[var(--edge)] bg-[var(--surface-raised)] px-2 py-1 font-mono text-[11px] text-[var(--text-muted)]"
      >
        <option value="">{link?.source === 'auto' ? 'keep auto-match' : 'tag a project…'}</option>
        {model.projects.map((p) => (
          <option key={p.uuid} value={p.uuid}>
            {p.name}
          </option>
        ))}
      </select>

      {link?.reason && (
        <p className="basis-full text-[11.5px] text-[var(--text-dim)]">
          {link.reason}
          {link.source === 'auto' && ' — inferred, not from the export'}
        </p>
      )}
    </div>
  )
}
