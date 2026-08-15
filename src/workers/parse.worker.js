/**
 * Parse worker. Everything expensive happens here so the UI thread never
 * blocks: zip inflation (fflate), JSON.parse of the ~64 MB conversations file,
 * normalisation of ~3.6k messages, and the IndexedDB write.
 *
 * The model is posted to the UI *before* caching starts, so the app becomes
 * usable immediately and the cache write finishes in the background.
 *
 * Messages in:  { mode: 'zip', buffer, label } | { mode: 'files', files, label }
 * Messages out: progress | done | cached | error
 */

import { unzipSync, strFromU8 } from 'fflate'
import { buildModel } from '../parsers/index.js'
import { saveModel, requestPersistence } from '../lib/db.js'

self.onmessage = async (ev) => {
  const post = (msg) => self.postMessage(msg)
  try {
    const { mode, label } = ev.data
    let entries

    if (mode === 'zip') {
      post({ type: 'progress', phase: 'unzip' })
      const bytes = new Uint8Array(ev.data.buffer)
      // Only inflate the JSON we actually consume — the export can carry other assets.
      const unzipped = unzipSync(bytes, { filter: (f) => /\.json$/i.test(f.name) && !f.name.includes('__MACOSX') })
      entries = Object.entries(unzipped).map(([path, u8]) => ({
        path,
        text: async () => strFromU8(u8),
      }))
    } else if (mode === 'files') {
      entries = ev.data.files.map(({ path, file }) => ({
        path,
        text: () => file.text(),
      }))
    } else {
      throw new Error(`Unknown parse mode: ${mode}`)
    }

    post({ type: 'progress', phase: 'classify', detail: `${entries.length} JSON files` })

    const model = await buildModel(entries, (p) => post({ type: 'progress', ...p }))

    // UI can render now; caching continues below.
    post({ type: 'done', model })

    await requestPersistence()
    const result = await saveModel(model, { sourceLabel: label || '' })
    post({ type: 'cached', ...result })
  } catch (err) {
    post({ type: 'error', message: err?.message || String(err), stack: err?.stack || null })
  }
}
