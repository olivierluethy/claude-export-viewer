/**
 * Shows how a conversation is linked to a project — and, when it isn't linked to
 * any, the app's best recommendation with the evidence behind it and a one-click
 * accept.
 *
 * Precedence, highest first:
 *   1. an existing link (your tag, or the export / name-match) → show it, as-is;
 *   2. otherwise a scored recommendation, if one is strong enough;
 *   3. otherwise nothing yet — a plain "tag a project" control.
 *
 * A chat that already sits in a folder is never re-suggested for that folder.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useModel } from '../lib/ModelContext.jsx'
import { ConfidenceBadge } from '../pages/ProjectsPage.jsx'
import { ConfidenceMeter, EvidenceList, RecBadge } from './ui/Confidence.jsx'

export default function ProjectTagger({ conversation }) {
  const model = useModel()
  const [open, setOpen] = useState(false)

  const link = model.links.byConversation.get(conversation.uuid)
  const linkedProject = link ? model.projectsById.get(link.projectUuid) : null

  // Recommendations only exist for chats with no link at all.
  const rec = link ? null : model.recommendations.byConversation.get(conversation.uuid)
  const top = rec?.top
  const suggested = top ? model.projectsById.get(top.projectUuid) : null

  return (
    <div className="mt-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rule-label">project</span>

        {linkedProject ? (
          <Link to={`/projects/${linkedProject.uuid}`} className="text-[12.5px] font-medium hover:text-[var(--assistant)]">
            {linkedProject.name}
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

        {link && <ConfidenceBadge confidence={link.confidence} />}
        {suggested && <RecBadge status={rec.status} />}
        {suggested && <ConfidenceMeter score={top.score} status={rec.status} />}

        <select
          value={model.tags[conversation.uuid] || ''}
          onChange={(e) => model.setTag(conversation.uuid, e.target.value || null)}
          title={link?.reason || 'Assign this conversation to a project'}
          className="ml-auto rounded-md border border-[var(--edge)] bg-[var(--surface-raised)] px-2 py-1 font-mono text-[11px] text-[var(--text-muted)]"
        >
          <option value="">{link?.source === 'auto' ? 'keep auto-match' : suggested ? 'pick a project…' : 'tag a project…'}</option>
          {model.projects.map((p) => (
            <option key={p.uuid} value={p.uuid}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Existing link: keep the honest, one-line reason it already carried. */}
      {link?.reason && !suggested && (
        <p className="mt-1.5 text-[11.5px] text-[var(--text-dim)]">
          {link.reason}
          {link.source === 'auto' && ' — inferred, not from the export'}
        </p>
      )}

      {/* Unlinked chat with a recommendation: accept / reject / why. */}
      {suggested && (
        <>
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

          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
          >
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
        </>
      )}
    </div>
  )
}
