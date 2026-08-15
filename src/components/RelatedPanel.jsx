/**
 * "Related chats (heuristic)" — labelled honestly, because it is keyword and
 * metadata overlap, not embeddings. See lib/related.js for the signals.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useModel } from '../lib/ModelContext.jsx'
import { findRelated } from '../lib/related.js'
import { fmtDate, titleOf } from '../lib/format.js'

export default function RelatedPanel({ conversation }) {
  const model = useModel()

  const related = useMemo(
    () =>
      findRelated({
        conversation,
        conversations: model.conversations,
        byId: model.conversationsById,
        index: model.relatedIndex,
        links: model.links,
      }),
    [conversation, model.conversations, model.conversationsById, model.relatedIndex, model.links],
  )

  if (!related.length) return null

  return (
    <section className="mt-10 border-t border-[var(--edge)] pt-6 print:hidden">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[13px] font-medium">Related chats</h2>
        <span
          className="rule-label"
          title="Keyword overlap, shared project, shared tools and closeness in time — not semantic similarity."
        >
          heuristic
        </span>
      </div>

      <ul className="space-y-1">
        {related.map((r) => (
          <li key={r.conversation.uuid}>
            <Link
              to={`/chats/${r.conversation.uuid}`}
              className="block rounded-md px-2 py-1.5 transition hover:bg-[var(--surface-high)]"
            >
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px]">{titleOf(r.conversation)}</span>
                <span className="shrink-0 font-mono text-[10.5px] text-[var(--text-dim)]">
                  {fmtDate(r.conversation.updatedAtMs)}
                </span>
              </div>
              {r.reasons.length > 0 && (
                <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-dim)]">{r.reasons.join(' · ')}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
