/**
 * View a chat as formatted markdown or as its raw source. The choice is shared
 * across every chat view and held for the session (see lib/chatViewMode.js);
 * copy actions ignore it and always emit raw markdown.
 */

import { useChatViewMode, setChatViewMode } from '../../lib/chatViewMode.js'

const MODES = [
  ['rendered', 'rendered', 'Show formatted markdown'],
  ['source', 'markdown', 'Show the raw markdown source'],
]

export default function ChatViewToggle() {
  const mode = useChatViewMode()
  return (
    <span className="inline-flex overflow-hidden rounded-md border border-[var(--edge)] print:hidden">
      {MODES.map(([value, label, title]) => (
        <button
          key={value}
          onClick={() => setChatViewMode(value)}
          title={title}
          className={`px-2 py-1 font-mono text-[11px] transition ${
            mode === value
              ? 'bg-[var(--surface-high)] text-[var(--human)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          {label}
        </button>
      ))}
    </span>
  )
}
