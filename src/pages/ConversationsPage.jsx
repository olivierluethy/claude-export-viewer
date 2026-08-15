/**
 * Two-pane reader: index on the left, thread on the right — the shape that
 * suits an archive you dig through rather than a chat you continue.
 */

import { Outlet, useParams } from 'react-router-dom'
import ConversationList from '../components/ConversationList.jsx'
import ConversationDetail from '../components/ConversationDetail.jsx'
import { useModel } from '../lib/ModelContext.jsx'
import { fmtNum } from '../lib/format.js'

export default function ConversationsPage() {
  const model = useModel()
  const { uuid } = useParams()
  const hasSelection = !!uuid

  return (
    <div className="flex h-full">
      <aside
        className={`w-full shrink-0 border-r border-[var(--edge)] md:w-[21rem] print:hidden ${
          hasSelection ? 'hidden md:block' : 'block'
        }`}
      >
        <ConversationList
          conversations={model.conversations}
          header={
            <div className="border-b border-[var(--edge)] px-4 py-3">
              <h2 className="text-[13px] font-medium">Conversations</h2>
              <p className="rule-label mt-0.5">{fmtNum(model.conversations.length)} threads · newest first</p>
            </div>
          }
        />
      </aside>

      <div className={`min-w-0 flex-1 ${hasSelection ? 'block' : 'hidden md:block'}`}>
        <Outlet />
      </div>
    </div>
  )
}

export function ConversationRoute() {
  const model = useModel()
  const { uuid } = useParams()
  const conversation = model.conversationsById.get(uuid)

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-[13px] text-[var(--text-muted)]">
          That conversation isn’t in this export. Pick another from the list.
        </p>
      </div>
    )
  }

  // ConversationDetail owns its own scroll container — see the note there.
  return <ConversationDetail key={conversation.uuid} conversation={conversation} />
}

export function ConversationEmpty() {
  return (
    <div className="flex h-full items-center justify-center px-8">
      <div className="max-w-sm text-center">
        <p className="font-serif text-[15px] text-[var(--text-muted)]">Pick a thread to start reading.</p>
        <p className="mt-1.5 text-[12.5px] text-[var(--text-dim)]">
          The rail down the left of each thread marks the time between turns, so you can see where the work
          happened.
        </p>
      </div>
    </div>
  )
}
