/**
 * "Related chats" — marked "suggested" and labelled honestly, because it is
 * keyword and metadata overlap, not embeddings. See lib/related.js.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useModel } from '../lib/ModelContext.jsx'
import { findRelated } from '../lib/related.js'
import { fmtDate, fmtDateLong, fmtNum, titleOf } from '../lib/format.js'

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

  const maxScore = related[0]?.score || 1

  if (!related.length) return null

  return (
    <section className="mt-10 border-t border-[var(--edge)] pt-6 print:hidden">
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="text-[13px] font-medium">Related chats</h2>
        <span className="rounded border border-[var(--edge-strong)] px-1.5 py-px font-mono text-[10px] text-[var(--text-dim)]">
          suggested
        </span>
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-[var(--text-dim)]">
        Suggested by this app, not part of your export — found by comparing distinctive words, shared projects,
        tools and closeness in time. The reason for each is shown below it.
      </p>

      <ul className="space-y-1">
        {related.map((r) => (
          <li key={r.conversation.uuid}>
            <Link
              to={`/chats/${r.conversation.uuid}`}
              className="group block rounded-md px-2 py-1.5 transition hover:bg-[var(--surface-high)]"
            >
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px]">{titleOf(r.conversation)}</span>
                {/* Relatedness strength, relative to the closest match. Identity
                    isn't colour alone — the reasons below name what it shares. */}
                <span
                  className="hidden h-1 w-14 shrink-0 overflow-hidden rounded-full bg-[var(--surface-sunken)] sm:block"
                  title="How strongly this chat overlaps, relative to the closest match"
                >
                  <span
                    className="block h-full rounded-full bg-[var(--assistant)]/60 transition-[width] duration-300 ease-out"
                    style={{ width: `${Math.max(8, (r.score / maxScore) * 100)}%` }}
                  />
                </span>
                {/* Message count disambiguates the 7 titles this export reuses —
                    "Converting task descriptions…" alone names 7 distinct chats. */}
                <span className="shrink-0 font-mono text-[10.5px] text-[var(--text-dim)] tabular-nums">
                  {fmtNum(r.conversation.facets.messageCount)} msg
                </span>
                <span
                  className="shrink-0 font-mono text-[10.5px] text-[var(--text-dim)]"
                  title={`Last message in this chat: ${fmtDateLong(r.conversation.updatedAtMs)}`}
                >
                  last active {fmtDate(r.conversation.updatedAtMs)}
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
