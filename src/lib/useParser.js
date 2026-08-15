import { useCallback, useEffect, useRef, useState } from 'react'
import { categorise } from './fileIntake.js'
import { clearAll, estimateUsage, loadModel } from './db.js'

const PHASE_LABEL = {
  unzip: 'Inflating archive',
  classify: 'Reading files',
  read: 'Reading',
  conversations: 'Parsing conversations',
  projects: 'Parsing projects',
  designChats: 'Parsing design chats',
  rest: 'Parsing reflections, memories & profile',
}

/**
 * Drives the parse worker and the IndexedDB cache.
 * status: booting | idle | working | ready | error
 * cache:  null | { state: 'restored'|'saving'|'saved'|'failed', ... }
 */
export function useParser() {
  const [status, setStatus] = useState('booting')
  const [progress, setProgress] = useState(null)
  const [model, setModel] = useState(null)
  const [error, setError] = useState(null)
  const [cache, setCache] = useState(null)
  const [usage, setUsage] = useState(null)
  const workerRef = useRef(null)
  const bootedRef = useRef(false)

  const refreshUsage = useCallback(async () => setUsage(await estimateUsage()), [])

  // On first mount, try to restore a previous parse.
  useEffect(() => {
    if (bootedRef.current) return // StrictMode runs effects twice in dev
    bootedRef.current = true
    ;(async () => {
      const restored = await loadModel()
      if (restored) {
        setModel(restored)
        setCache({ state: 'restored', savedAt: restored._cache?.savedAt, sourceLabel: restored._cache?.sourceLabel })
        setStatus('ready')
        refreshUsage()
      } else {
        setStatus('idle')
      }
    })()
  }, [refreshUsage])

  const reset = useCallback(async () => {
    workerRef.current?.terminate()
    workerRef.current = null
    setStatus('idle')
    setProgress(null)
    setModel(null)
    setError(null)
    setCache(null)
    await clearAll()
    refreshUsage()
  }, [refreshUsage])

  const parse = useCallback(
    async (entries) => {
      if (!entries.length) {
        setStatus('error')
        setError('Nothing was selected.')
        return
      }

      setStatus('working')
      setError(null)
      setCache(null)
      setProgress({ label: 'Starting', done: null, total: null })

      const worker = new Worker(new URL('../workers/parse.worker.js', import.meta.url), { type: 'module' })
      workerRef.current = worker

      worker.onmessage = (ev) => {
        const msg = ev.data
        if (msg.type === 'progress') {
          setProgress({
            label: PHASE_LABEL[msg.phase] || msg.phase,
            detail: msg.detail ?? null,
            done: msg.done ?? null,
            total: msg.total ?? null,
          })
        } else if (msg.type === 'done') {
          setModel(msg.model)
          setStatus('ready')
          setProgress(null)
          setCache({ state: 'saving' })
        } else if (msg.type === 'cached') {
          setCache(msg.ok ? { state: 'saved' } : { state: 'failed', reason: msg.reason })
          refreshUsage()
          worker.terminate()
          workerRef.current = null
        } else if (msg.type === 'error') {
          setError(msg.message)
          setStatus('error')
          setProgress(null)
          worker.terminate()
          workerRef.current = null
        }
      }
      worker.onerror = (e) => {
        setError(e.message || 'The parse worker crashed.')
        setStatus('error')
      }

      const selection = categorise(entries)
      if (selection.mode === 'zip') {
        const label = selection.zipFile.name
        const buffer = await selection.zipFile.arrayBuffer()
        worker.postMessage({ mode: 'zip', buffer, label }, [buffer])
      } else {
        if (!selection.entries.length) {
          setStatus('error')
          setError('No .json files found in that folder. Pick the folder that contains conversations.json.')
          worker.terminate()
          return
        }
        const label = selection.entries[0].path.split('/')[0] || 'folder'
        worker.postMessage({ mode: 'files', files: selection.entries, label })
      }
    },
    [refreshUsage],
  )

  return { status, progress, model, error, cache, usage, parse, reset }
}
