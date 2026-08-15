/**
 * A prose block: formatted markdown, or its raw source when the chat's view
 * mode is 'source'. Shared by the thread reader and the design-chat reader so
 * the rendered/markdown toggle behaves identically in both.
 *
 * `anchorBase`, when given, lets the rendered headings carry stable anchor ids
 * (see ui/Markdown.jsx) so the outline can nest and jump to them.
 */

import CodeBlock from '../ui/CodeBlock.jsx'
import Markdown from '../ui/Markdown.jsx'
import { useMarkdownView } from './markdownView.js'

export default function Prose({ text, className, anchorBase }) {
  const view = useMarkdownView()
  if (view === 'source') return <CodeBlock code={text} language="markdown" />
  return (
    <div className={className}>
      <Markdown anchorBase={anchorBase}>{text}</Markdown>
    </div>
  )
}
