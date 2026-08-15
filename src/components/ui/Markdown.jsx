import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CodeBlock from './CodeBlock.jsx'

/**
 * Markdown for message text. Links are inert-by-default targets (`noreferrer`)
 * and nothing is fetched — no remote images are loaded, since the export ships
 * no image bytes anyway and a remote request would break the offline promise.
 */

const components = {
  code({ inline, className, children, ...props }) {
    const text = String(children ?? '')
    const lang = /language-(\w[\w+-]*)/.exec(className || '')?.[1]
    // react-markdown marks inline code via `inline`; fall back to a newline test.
    if (inline || (!lang && !text.includes('\n'))) {
      return (
        <code
          className="rounded border border-[var(--edge)] bg-[var(--surface-sunken)] px-[0.32em] py-[0.1em] font-mono text-[0.87em]"
          {...props}
        >
          {children}
        </code>
      )
    }
    return <CodeBlock code={text} language={lang} />
  },
  pre: ({ children }) => <>{children}</>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--assistant)] underline decoration-[var(--assistant)]/35 underline-offset-2 hover:decoration-[var(--assistant)]"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => <h1 className="mt-5 mb-2 text-[1.35em] font-semibold tracking-tight">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-5 mb-2 text-[1.18em] font-semibold tracking-tight">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-4 mb-1.5 text-[1.05em] font-semibold">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-4 mb-1.5 font-semibold">{children}</h4>,
  p: ({ children }) => <p className="my-2.5 leading-[1.72]">{children}</p>,
  ul: ({ children }) => <ul className="my-2.5 list-disc space-y-1 pl-5 marker:text-[var(--text-dim)]">{children}</ul>,
  ol: ({ children }) => <ol className="my-2.5 list-decimal space-y-1 pl-5 marker:text-[var(--text-dim)]">{children}</ol>,
  li: ({ children }) => <li className="leading-[1.65]">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-[var(--edge-strong)] pl-3.5 text-[var(--text-muted)] italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-[var(--edge)]" />,
  table: ({ children }) => (
    <div className="scroll-x my-3 rounded-lg border border-[var(--edge)]">
      <table className="w-full border-collapse text-[0.9em]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[var(--surface-sunken)]">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-[var(--edge)] px-3 py-2 text-left font-mono text-[11px] font-medium tracking-wide uppercase">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-b border-[var(--edge)] px-3 py-2 align-top">{children}</td>,
  img: ({ alt }) => (
    <span className="rule-label my-2 inline-block rounded border border-dashed border-[var(--edge-strong)] px-2 py-1">
      image not included in export{alt ? ` — ${alt}` : ''}
    </span>
  ),
}

function Markdown({ children }) {
  return (
    <div className="text-[14.5px] break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

export default memo(Markdown)
