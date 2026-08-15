import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import dart from 'react-syntax-highlighter/dist/esm/languages/prism/dart'
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx'
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown'
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup'
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift'
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml'
import CopyButton from './CopyButton.jsx'

// Only the languages this corpus actually contains, so the bundle stays small.
for (const [name, lang] of Object.entries({
  bash,
  css,
  dart,
  java,
  javascript,
  json,
  jsx,
  markdown,
  markup,
  php,
  python,
  sql,
  swift,
  tsx,
  typescript,
  yaml,
})) {
  SyntaxHighlighter.registerLanguage(name, lang)
}

const ALIASES = {
  js: 'javascript',
  ts: 'typescript',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  svelte: 'markup',
  vue: 'markup',
  sh: 'bash',
  shell: 'bash',
  shellscript: 'bash',
  zsh: 'bash',
  console: 'bash',
  dotenv: 'bash',
  yml: 'yaml',
  py: 'python',
  md: 'markdown',
  postgresql: 'sql',
  mysql: 'sql',
}

const SUPPORTED = new Set([
  'bash',
  'css',
  'dart',
  'java',
  'javascript',
  'json',
  'jsx',
  'markdown',
  'markup',
  'php',
  'python',
  'sql',
  'swift',
  'tsx',
  'typescript',
  'yaml',
])

export const resolveLanguage = (raw) => {
  const key = String(raw || '').toLowerCase().trim()
  const mapped = ALIASES[key] || key
  return SUPPORTED.has(mapped) ? mapped : null
}

/** Palette-matched Prism theme — built from the app's inks, not a canned one. */
const theme = {
  'code[class*="language-"]': { color: 'var(--text)', background: 'none' },
  'pre[class*="language-"]': { color: 'var(--text)', background: 'none' },
  comment: { color: 'var(--text-dim)', fontStyle: 'italic' },
  prolog: { color: 'var(--text-dim)' },
  doctype: { color: 'var(--text-dim)' },
  cdata: { color: 'var(--text-dim)' },
  punctuation: { color: 'var(--color-graphite-500)' },
  property: { color: 'var(--color-draft-300)' },
  tag: { color: 'var(--color-draft-300)' },
  boolean: { color: 'var(--color-ochre-300)' },
  number: { color: 'var(--color-ochre-300)' },
  constant: { color: 'var(--color-ochre-300)' },
  symbol: { color: 'var(--color-ochre-300)' },
  deleted: { color: 'oklch(0.7 0.15 25)' },
  selector: { color: 'var(--color-ochre-400)' },
  'attr-name': { color: 'var(--color-ochre-400)' },
  string: { color: 'var(--color-ochre-400)' },
  char: { color: 'var(--color-ochre-400)' },
  builtin: { color: 'var(--color-draft-300)' },
  inserted: { color: 'oklch(0.75 0.13 155)' },
  operator: { color: 'var(--color-graphite-400)' },
  entity: { color: 'var(--color-graphite-400)' },
  url: { color: 'var(--color-draft-400)' },
  atrule: { color: 'var(--color-draft-400)' },
  'attr-value': { color: 'var(--color-ochre-400)' },
  keyword: { color: 'var(--color-draft-400)', fontWeight: '500' },
  function: { color: 'var(--color-draft-300)' },
  'class-name': { color: 'var(--color-draft-300)' },
  regex: { color: 'var(--color-ochre-400)' },
  important: { color: 'var(--color-ochre-400)', fontWeight: '600' },
  variable: { color: 'var(--text)' },
}

/**
 * A fenced code block: language label, per-block copy, horizontal scroll
 * contained so the page itself never scrolls sideways.
 */
export default function CodeBlock({ code, language, filename }) {
  const text = String(code ?? '').replace(/\n$/, '')
  const resolved = resolveLanguage(language)
  const shown = filename || (language ? String(language).toLowerCase() : 'text')

  return (
    <figure className="my-3 overflow-hidden rounded-lg border border-[var(--edge)] bg-[var(--surface-sunken)]">
      <figcaption className="flex items-center gap-2 border-b border-[var(--edge)] px-3 py-1.5">
        <span className="rule-label truncate">{shown}</span>
        <CopyButton
          getText={() => text}
          label="Copy"
          copiedLabel="Copied"
          title="Copy this snippet"
          className="ml-auto shrink-0 border-transparent print:hidden"
        />
      </figcaption>
      <div className="scroll-x">
        {resolved ? (
          <SyntaxHighlighter
            language={resolved}
            style={theme}
            customStyle={{
              margin: 0,
              padding: '0.85rem 0.9rem',
              background: 'transparent',
              fontSize: '12.5px',
              lineHeight: 1.65,
            }}
            codeTagProps={{ style: { fontFamily: 'var(--font-mono)' } }}
          >
            {text}
          </SyntaxHighlighter>
        ) : (
          <pre className="m-0 px-[0.9rem] py-[0.85rem] font-mono text-[12.5px] leading-[1.65] whitespace-pre">
            {text}
          </pre>
        )}
      </div>
    </figure>
  )
}
