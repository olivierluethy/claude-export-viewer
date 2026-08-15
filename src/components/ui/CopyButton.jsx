import { useState } from 'react'
import { copyText } from '../../lib/toMarkdown.js'

/**
 * The label states what will happen, and the confirmation uses the same verb.
 * `getText` is a function so large strings are only built on click.
 */
export default function CopyButton({ getText, label = 'Copy', copiedLabel = 'Copied', className = '', title }) {
  const [state, setState] = useState('idle') // idle | copied | failed

  const onClick = async (e) => {
    e.stopPropagation()
    const ok = await copyText(typeof getText === 'function' ? getText() : getText)
    setState(ok ? 'copied' : 'failed')
    setTimeout(() => setState('idle'), 1600)
  }

  return (
    <button
      onClick={onClick}
      title={title || label}
      className={`inline-flex items-center gap-1.5 rounded-md border border-[var(--edge)] px-2 py-1 font-mono text-[11px] tracking-wide text-[var(--text-muted)] transition hover:border-[var(--edge-strong)] hover:text-[var(--text)] ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
        {state === 'copied' ? (
          <path d="M4 12.5 9 17.5 20 6.5" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </>
        )}
      </svg>
      {state === 'copied' ? copiedLabel : state === 'failed' ? 'Copy failed' : label}
    </button>
  )
}
