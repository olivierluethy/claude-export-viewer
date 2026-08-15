/**
 * Shows how a conversation is linked to a project — and, when it isn't, the
 * app's best recommendation with the evidence behind it and a one-click accept.
 *
 * Regular conversations carry no project in the export, so whatever is shown
 * here is either your own tag (confirmed) or this app's scored guess — and it
 * always says which, and why.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useModel } from '../lib/ModelContext.jsx'
import { ConfidenceMeter, EvidenceList, RecBadge } from './ui/Confidence.jsx'

export default function ProjectTagger({ conversation }) {
  const model = useModel()
  const [open, setOpen] = useState(false)
  const rec = model.recommendations.byConversation.get(conversation.uuid)
  const isConfirmed = rec?.status === 'confirmed'
  const confirmedProject = isConfirmed ? model.projectsById.get(rec.confirmedProjectUuid) : null
  const top = rec?.top
  const suggested = !isConfirmed && top ? model.projectsById.get(top.projectUuid) : null

  return (
    <div className="mt-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rule-label">project</span>

        {confirmedProject ? (
          <Link to={`/projects/${confirmedProject.uuid}`} className="text-[12.5px] font-medium hover:text-[var(--assistant)]">
            {confirmedProject.name}
          </Link>
        ) : suggested ? (
          <>
            <span className="text-[12px] text-[var(--text-dim)]">suggested</span>
            <Link to={`/projects/${suggested.uuid}`} className="text-[12.5px] font-medium hover:text-[var(--assistant)]">
              {suggested.name}
            </Link>
          </>
        ) : (
          <span className="text-[12.5px] text-[var(--text-dim)]">none</span>
        )}

        <RecBadge status={rec?.status ?? 'none'} />
        {suggested && <ConfidenceMeter score={top.score} status={rec.status} />}

        <select
          value={isConfirmed ? rec.confirmedProjectUuid : ''}
          onChange={(e) => model.setTag(conversation.uuid, e.target.value || null)}
          title="Assign this conversation to a project"
          className="ml-auto rounded-md border border-[var(--edge)] bg-[var(--surface-raised)] px-2 py-1 font-mono text-[11px] text-[var(--text-muted)]"
        >
          <option value="">{suggested ? 'pick a project…' : 'tag a project…'}</option>
          {model.projects.map((p) => (
            <option key={p.uuid} value={p.uuid}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {suggested && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => model.confirmRecommendation(conversation.uuid, top.projectUuid)}
            className="rounded-md border border-[var(--human)]/45 px-2.5 py-1 font-mono text-[11px] text-[var(--human)] transition hover:bg-[var(--human)]/10"
          >
            confirm this link
          </button>
          <button
            onClick={() => model.dismissRecommendation(conversation.uuid, top.projectUuid)}
            className="rule-label rounded-md border border-[var(--edge)] px-2 py-1 transition hover:border-[var(--edge-strong)] hover:text-[var(--text)]"
          >
            not this project
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            className="rule-label ml-auto rounded border border-[var(--edge)] px-1.5 py-0.5 hover:text-[var(--text)]"
            aria-expanded={open}
          >
            {open ? 'hide why' : 'why'}
          </button>
        </div>
      )}

      {suggested && (
        <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
          <div className="overflow-hidden">
            <div className="mt-2 rounded-lg border border-[var(--edge)] bg-[var(--surface-sunken)]/40 p-3">
              {rec.status === 'ambiguous' && rec.rejected && (
                <p className="mb-2 text-[11.5px] text-[var(--text-dim)]">{rec.rejected}.</p>
              )}
              <EvidenceList evidence={top.evidence} />
              <p className="mt-2 text-[11px] text-[var(--text-dim)]">Inferred by this app — not part of your export.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
