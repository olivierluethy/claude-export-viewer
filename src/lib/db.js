/**
 * IndexedDB persistence for the parsed export.
 *
 * Why IndexedDB and not localStorage: the corpus is ~64 MB of JSON and the
 * normalised model is larger still — orders of magnitude past the ~5 MB
 * localStorage ceiling.
 *
 * The model is stored split by record rather than as one giant blob, so no
 * single structured-clone has to carry the whole corpus, and a partial failure
 * can't corrupt everything.
 *
 * This module is imported by BOTH the parse worker (which does the writing, to
 * keep the cost off the UI thread) and the main thread (which reads).
 */

import { openDB, deleteDB } from 'idb'

export const DB_NAME = 'claude-export-viewer'
const DB_VERSION = 1

/**
 * Bumped whenever the parsers change shape. A cached model written by an older
 * schema is ignored rather than rendered wrongly.
 */
export const SCHEMA_VERSION = 1

const STORES = {
  meta: 'meta', // singleton record under key 'current'
  conversations: 'conversations', // keyPath uuid
  projects: 'projects', // keyPath uuid
  designChats: 'designChats', // keyPath uuid
  misc: 'misc', // reflections | memories | owner | loginEvents
  tags: 'tags', // manual conversation→project tags (step 5)
  search: 'search', // persisted search index (step 5)
}

function open() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // All stores are created up front so later features don't force a
      // version bump that would invalidate a user's cached parse.
      if (!db.objectStoreNames.contains(STORES.meta)) db.createObjectStore(STORES.meta)
      if (!db.objectStoreNames.contains(STORES.conversations))
        db.createObjectStore(STORES.conversations, { keyPath: 'uuid' })
      if (!db.objectStoreNames.contains(STORES.projects)) db.createObjectStore(STORES.projects, { keyPath: 'uuid' })
      if (!db.objectStoreNames.contains(STORES.designChats))
        db.createObjectStore(STORES.designChats, { keyPath: 'uuid' })
      if (!db.objectStoreNames.contains(STORES.misc)) db.createObjectStore(STORES.misc)
      if (!db.objectStoreNames.contains(STORES.tags)) db.createObjectStore(STORES.tags)
      if (!db.objectStoreNames.contains(STORES.search)) db.createObjectStore(STORES.search)
    },
  })
}

/** Ask the browser not to evict this origin's data. Never prompts in Chrome. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist()
  } catch {
    /* not fatal */
  }
  return false
}

export async function estimateUsage() {
  try {
    const { usage, quota } = (await navigator.storage?.estimate?.()) ?? {}
    return { usage: usage ?? null, quota: quota ?? null }
  } catch {
    return { usage: null, quota: null }
  }
}

/**
 * Writes the model in chunked transactions.
 * @returns {Promise<{ok: true} | {ok: false, reason: string}>} never throws —
 *   a cache failure must not lose a successful parse.
 */
export async function saveModel(model, { sourceLabel = '' } = {}) {
  let db
  try {
    db = await open()

    // Clear previous contents first; a stale mix of two exports would be worse
    // than no cache at all.
    await clearStores(db)

    await putAll(db, STORES.conversations, model.conversations)
    await putAll(db, STORES.projects, model.projects)
    await putAll(db, STORES.designChats, model.designChats)

    const misc = db.transaction(STORES.misc, 'readwrite')
    await Promise.all([
      misc.store.put(model.reflections, 'reflections'),
      misc.store.put(model.memories, 'memories'),
      misc.store.put(model.owner, 'owner'),
      misc.store.put(model.loginEvents, 'loginEvents'),
      misc.done,
    ])

    const meta = db.transaction(STORES.meta, 'readwrite')
    await Promise.all([
      meta.store.put(
        {
          schemaVersion: SCHEMA_VERSION,
          summary: model.summary,
          sourceLabel,
          savedAt: new Date().toISOString(),
        },
        'current',
      ),
      meta.done,
    ])

    return { ok: true }
  } catch (err) {
    // Most likely QuotaExceededError. The in-memory model is still fine.
    try {
      if (db) await clearStores(db)
    } catch {
      /* best effort */
    }
    return { ok: false, reason: err?.name === 'QuotaExceededError' ? 'quota' : err?.message || String(err) }
  } finally {
    db?.close?.()
  }
}

/** Writes records in batches so one transaction never holds the whole corpus. */
async function putAll(db, storeName, records, batchSize = 40) {
  for (let i = 0; i < records.length; i += batchSize) {
    const tx = db.transaction(storeName, 'readwrite')
    const slice = records.slice(i, i + batchSize)
    await Promise.all([...slice.map((r) => tx.store.put(r)), tx.done])
  }
}

async function clearStores(db) {
  const names = [STORES.meta, STORES.conversations, STORES.projects, STORES.designChats, STORES.misc]
  const tx = db.transaction(names, 'readwrite')
  await Promise.all([...names.map((n) => tx.objectStore(n).clear()), tx.done])
}

/** @returns {Promise<null | {schemaVersion, summary, sourceLabel, savedAt}>} */
export async function readMeta() {
  let db
  try {
    db = await open()
    return (await db.get(STORES.meta, 'current')) ?? null
  } catch {
    return null
  } finally {
    db?.close?.()
  }
}

/**
 * @returns {Promise<null | model>} null when there is no usable cache
 *   (absent, or written by an incompatible schema version).
 */
export async function loadModel() {
  let db
  try {
    db = await open()
    const meta = await db.get(STORES.meta, 'current')
    if (!meta) return null
    if (meta.schemaVersion !== SCHEMA_VERSION) return null

    const [conversations, projects, designChats, reflections, memories, owner, loginEvents] = await Promise.all([
      db.getAll(STORES.conversations),
      db.getAll(STORES.projects),
      db.getAll(STORES.designChats),
      db.get(STORES.misc, 'reflections'),
      db.get(STORES.misc, 'memories'),
      db.get(STORES.misc, 'owner'),
      db.get(STORES.misc, 'loginEvents'),
    ])
    if (!conversations.length) return null

    // getAll returns key order, not the sort the parser applied.
    conversations.sort((a, b) => (b.updatedAtMs ?? b.createdAtMs ?? 0) - (a.updatedAtMs ?? a.createdAtMs ?? 0))
    projects.sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0))

    return {
      conversations,
      projects,
      designChats,
      reflections: reflections ?? null,
      memories: memories ?? null,
      owner: owner ?? null,
      loginEvents: loginEvents ?? [],
      summary: meta.summary,
      _cache: { savedAt: meta.savedAt, sourceLabel: meta.sourceLabel },
    }
  } catch {
    return null
  } finally {
    db?.close?.()
  }
}

/* ---------------------------------------------------------- manual tags --
 * Conversation → project assignments you make by hand. Kept in their own store
 * and never cleared by a re-parse, so re-uploading a fresh export does not
 * throw away tagging work.
 */

export async function loadTags() {
  let db
  try {
    db = await open()
    const out = {}
    for (const key of await db.getAllKeys(STORES.tags)) out[key] = await db.get(STORES.tags, key)
    return out
  } catch {
    return {}
  } finally {
    db?.close?.()
  }
}

export async function setTag(conversationUuid, projectUuid) {
  let db
  try {
    db = await open()
    if (projectUuid) await db.put(STORES.tags, projectUuid, conversationUuid)
    else await db.delete(STORES.tags, conversationUuid)
    return true
  } catch {
    return false
  } finally {
    db?.close?.()
  }
}

/** Full wipe — the "clear data" action. */
export async function clearAll() {
  try {
    await deleteDB(DB_NAME)
    return true
  } catch {
    return false
  }
}
