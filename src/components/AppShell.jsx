/**
 * Shell: a narrow fixed rail of sections on the left, content to the right.
 * The rail mirrors the thread's time rail — same ruled gutter language — so the
 * app reads as one system.
 */

import { NavLink, Outlet } from 'react-router-dom'
import { useModel } from '../lib/ModelContext.jsx'
import { fmtNum } from '../lib/format.js'
import CommandPalette from './CommandPalette.jsx'
import { DATE_FORMATS, setDateFormat, useDateFormat } from '../lib/prefs.js'

const NAV = [
  { to: '/', label: 'Overview', end: true, count: null },
  { to: '/search', label: 'Search', count: null },
  { to: '/chats', label: 'Conversations', count: (m) => m.conversations.length },
  { to: '/projects', label: 'Projects', count: (m) => m.projects.length },
  { to: '/design', label: 'Design chats', count: (m) => m.designChats.length },
  { to: '/reflections', label: 'Reflections', count: (m) => m.reflections?.periods.length ?? 0 },
  { to: '/memories', label: 'Memory', count: (m) => m.memories?.files.length ?? 0 },
  { to: '/activity', label: 'Activity', count: null },
  { to: '/graph', label: 'Relationships', count: null },
]

function ThemeToggle() {
  const toggle = () => {
    const el = document.documentElement
    const toLight = !el.classList.contains('light')
    el.classList.toggle('light', toLight)
    el.classList.toggle('dark', !toLight)
    try {
      localStorage.setItem('cev-theme', toLight ? 'light' : 'dark')
    } catch {
      /* private mode — theme just won't persist */
    }
  }

  return (
    <button
      onClick={toggle}
      title="Switch between dark and light"
      aria-label="Switch between dark and light"
      className="rule-label w-full rounded-md border border-[var(--edge)] px-2 py-1.5 text-center transition hover:border-[var(--edge-strong)] hover:text-[var(--text)]"
    >
      theme
    </button>
  )
}

/** Dates follow this, not the operating system — see lib/prefs.js. */
function DateFormatPicker() {
  const format = useDateFormat()
  return (
    <label className="block">
      <span className="rule-label">date format</span>
      <select
        value={format}
        onChange={(e) => setDateFormat(e.target.value)}
        title="How dates are written throughout the app"
        className="mt-1 w-full rounded-md border border-[var(--edge)] bg-[var(--surface-raised)] px-2 py-1.5 font-mono text-[11px] text-[var(--text-muted)]"
      >
        {Object.entries(DATE_FORMATS).map(([key, f]) => (
          <option key={key} value={key}>
            {f.label} — {f.example}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function AppShell({ onReset }) {
  const model = useModel()

  return (
    <div className="flex h-full">
      <CommandPalette />
      <nav className="flex w-[13.5rem] shrink-0 flex-col border-r border-[var(--edge)] bg-[var(--surface-raised)] print:hidden">
        <div className="px-4 pt-5 pb-4">
          <p className="rule-label">Claude export</p>
          <p className="mt-1 font-serif text-[15px] leading-tight font-semibold">
            {model.owner?.fullName?.split(' ')[0] ? `${model.owner.fullName.split(' ')[0]}’s archive` : 'Your archive'}
          </p>
        </div>

        <ul className="flex-1 px-2">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-baseline gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                    isActive
                      ? 'bg-[var(--surface-high)] text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className="h-3 w-px shrink-0 translate-y-0.5"
                      style={{ background: isActive ? 'var(--human)' : 'transparent' }}
                      aria-hidden
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.count && (
                      <span className="font-mono text-[10.5px] text-[var(--text-dim)] tabular-nums">
                        {fmtNum(item.count(model))}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="space-y-2 border-t border-[var(--edge)] p-3">
          <p className="rule-label">
            press <kbd className="text-[var(--text-muted)]">⌘K</kbd> to jump
          </p>
          <p className="text-[10.5px] leading-relaxed text-[var(--text-dim)]">
            Everything is stored and searched on this device. Nothing is sent anywhere.
          </p>
          <DateFormatPicker />
          <ThemeToggle />
          <button
            onClick={onReset}
            className="rule-label w-full rounded-md border border-[var(--edge)] px-2 py-1.5 text-center transition hover:border-red-500/40 hover:text-red-300"
          >
            clear data
          </button>
        </div>
      </nav>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
