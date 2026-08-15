import { useRef, useState } from 'react'
import { entriesFromDataTransfer, entriesFromFileList } from '../lib/fileIntake.js'

function LockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export default function UploadScreen({ onFiles, error }) {
  const [dragging, setDragging] = useState(false)
  const zipInput = useRef(null)
  const dirInput = useRef(null)

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragging(false)
    onFiles(await entriesFromDataTransfer(e.dataTransfer))
  }

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-16">
      <header className="mb-10">
        <h1 className="text-[2.6rem] leading-none font-semibold tracking-tight">Claude Export Viewer</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-muted)]">
          Browse, search and re-read your Claude data export — conversations, projects, design chats,
          reflections and memories.
        </p>
      </header>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
          dragging ? 'border-ochre-500 bg-ochre-500/5' : 'border-[var(--edge-strong)]'
        }`}
      >
        <p className="text-[15px] font-medium">Drop your export here</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          the <code className="font-mono text-[13px] text-[var(--text)]">data-*.zip</code>, or the folder you
          extracted from it
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => zipInput.current.click()}
            className="rounded-lg bg-ochre-500 px-4 py-2 text-sm font-medium text-graphite-950 transition hover:bg-ochre-400"
          >
            Choose .zip
          </button>
          <button
            onClick={() => dirInput.current.click()}
            className="rounded-lg border border-[var(--edge-strong)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-raised)]"
          >
            Choose folder
          </button>
        </div>

        <input
          ref={zipInput}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => e.target.files.length && onFiles(entriesFromFileList(e.target.files))}
        />
        <input
          ref={dirInput}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={(e) => e.target.files.length && onFiles(entriesFromFileList(e.target.files))}
        />
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span className="font-medium">Could not read that export. </span>
          {error}
        </div>
      )}

      <div className="mt-10 flex gap-3 rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)] px-4 py-3.5">
        <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-ochre-400" />
        <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
          <span className="font-medium text-[var(--text)]">Everything stays on this device.</span> Your export is
          unzipped, parsed and indexed entirely inside your browser. There is no server, no API call and no
          telemetry in this app — you can disconnect from the network and it works exactly the same.
        </p>
      </div>
    </div>
  )
}
