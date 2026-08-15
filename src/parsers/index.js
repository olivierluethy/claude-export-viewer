/**
 * Orchestrator: raw export entries -> normalised in-memory model.
 *
 * Files are classified by basename and immediate parent directory, so it does
 * not matter how deeply the export is nested (`data-xxx/conversations.json`,
 * `./conversations.json`, or a zip with a wrapper folder all work).
 */

import { parseConversations } from './conversations.js'
import { parseProject } from './projects.js'
import { parseDesignChat } from './designChats.js'
import { parseReflections } from './reflections.js'
import { parseMemories } from './memories.js'
import { parseUsers } from './users.js'
import { parseLoginHistory } from './loginHistory.js'

export const EXPECTED_FILES = {
  conversations: 'conversations.json',
  memories: 'memories.json',
  users: 'users.json',
  loginHistory: 'login_history.json',
  projectsDir: 'projects',
  designChatsDir: 'design_chats',
  reflectionsDir: 'reflections',
}

/** @returns {{kind: string}|null} null = ignore this path */
export function classifyPath(path) {
  const clean = path.replace(/\\/g, '/')
  const segments = clean.split('/').filter(Boolean)
  const base = segments[segments.length - 1] || ''
  const parent = segments.length > 1 ? segments[segments.length - 2] : ''

  if (base.startsWith('.') || clean.includes('__MACOSX')) return null
  if (!base.toLowerCase().endsWith('.json')) return null

  if (base === EXPECTED_FILES.conversations) return { kind: 'conversations' }
  if (base === EXPECTED_FILES.memories) return { kind: 'memories' }
  if (base === EXPECTED_FILES.users) return { kind: 'users' }
  if (base === EXPECTED_FILES.loginHistory) return { kind: 'loginHistory' }
  if (parent === EXPECTED_FILES.projectsDir) return { kind: 'project' }
  if (parent === EXPECTED_FILES.designChatsDir) return { kind: 'designChat' }
  if (parent === EXPECTED_FILES.reflectionsDir) return { kind: 'reflections' }
  return null
}

const parseJson = (text, path) => {
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new Error(`${path}: invalid JSON — ${err.message}`)
  }
}

/**
 * @param {Array<{path: string, text: () => Promise<string>}>} entries
 * @param {(p: {phase: string, detail?: string, done?: number, total?: number}) => void} report
 */
export async function buildModel(entries, report = () => {}) {
  const buckets = { conversations: [], project: [], designChat: [], reflections: [], memories: [], users: [], loginHistory: [] }
  const skipped = []

  for (const entry of entries) {
    const cls = classifyPath(entry.path)
    if (!cls) {
      skipped.push(entry.path)
      continue
    }
    buckets[cls.kind].push(entry)
  }

  if (!buckets.conversations.length) {
    throw new Error(
      'No `conversations.json` found. Select the folder that directly contains conversations.json, projects/ and design_chats/ — or the original data-*.zip.',
    )
  }

  const warnings = []
  const model = {
    conversations: [],
    projects: [],
    designChats: [],
    reflections: null,
    memories: null,
    owner: null,
    loginEvents: [],
  }

  // --- conversations (the expensive one) ---
  report({ phase: 'read', detail: 'conversations.json' })
  const convRaw = parseJson(await buckets.conversations[0].text(), buckets.conversations[0].path)
  report({ phase: 'conversations', done: 0, total: convRaw.length })
  model.conversations = parseConversations(convRaw, (done, total) => report({ phase: 'conversations', done, total }))

  // --- projects ---
  report({ phase: 'projects', done: 0, total: buckets.project.length })
  for (let i = 0; i < buckets.project.length; i++) {
    const e = buckets.project[i]
    try {
      model.projects.push(parseProject(parseJson(await e.text(), e.path), e.path))
    } catch (err) {
      warnings.push(err.message)
    }
    report({ phase: 'projects', done: i + 1, total: buckets.project.length })
  }

  // --- design chats ---
  report({ phase: 'designChats', done: 0, total: buckets.designChat.length })
  for (let i = 0; i < buckets.designChat.length; i++) {
    const e = buckets.designChat[i]
    try {
      model.designChats.push(parseDesignChat(parseJson(await e.text(), e.path), e.path))
    } catch (err) {
      warnings.push(err.message)
    }
    report({ phase: 'designChats', done: i + 1, total: buckets.designChat.length })
  }

  // --- the small singletons ---
  report({ phase: 'rest' })
  for (const [key, list, fn] of [
    ['reflections', buckets.reflections, parseReflections],
    ['memories', buckets.memories, parseMemories],
    ['owner', buckets.users, parseUsers],
  ]) {
    if (!list.length) {
      warnings.push(`No ${key} file found in the export.`)
      continue
    }
    try {
      model[key] = fn(parseJson(await list[0].text(), list[0].path), list[0].path)
    } catch (err) {
      warnings.push(err.message)
    }
  }
  if (buckets.loginHistory.length) {
    try {
      model.loginEvents = parseLoginHistory(parseJson(await buckets.loginHistory[0].text(), buckets.loginHistory[0].path), buckets.loginHistory[0].path)
    } catch (err) {
      warnings.push(err.message)
    }
  }

  model.conversations.sort((a, b) => (b.updatedAtMs ?? b.createdAtMs ?? 0) - (a.updatedAtMs ?? a.createdAtMs ?? 0))
  model.projects.sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0))

  model.summary = summarise(model, skipped, warnings)
  return model
}

function summarise(model, skipped, warnings) {
  let messages = 0
  let human = 0
  let assistant = 0
  let attachments = 0
  let files = 0
  let toolCalls = 0
  let errorResults = 0
  let thinkingBlocks = 0
  let emptyMessages = 0
  let minMs = null
  let maxMs = null
  const tools = new Map()
  const languages = new Map()
  const blockKinds = new Map()
  const unknownBlockTypes = new Map()
  const bump = (m, k) => k != null && m.set(k, (m.get(k) || 0) + 1)

  for (const c of model.conversations) {
    messages += c.messages.length
    human += c.facets.humanCount
    assistant += c.facets.assistantCount
    for (const t of c.facets.tools) bump(tools, t)
    for (const l of c.facets.languages) bump(languages, l)
    for (const ms of [c.createdAtMs, c.updatedAtMs]) {
      if (ms == null) continue
      if (minMs == null || ms < minMs) minMs = ms
      if (maxMs == null || ms > maxMs) maxMs = ms
    }
    for (const m of c.messages) {
      attachments += m.attachments.length
      files += m.files.length
      if (!m.blocks.length && !m.fallbackText) emptyMessages++
      for (const b of m.blocks) {
        bump(blockKinds, b.kind)
        if (b.kind === 'tool_use') toolCalls++
        if (b.kind === 'thinking') thinkingBlocks++
        if (b.kind === 'tool_result' && b.isError) errorResults++
        if (b.kind === 'unknown') bump(unknownBlockTypes, b.type ?? 'null')
      }
    }
  }

  const sortDesc = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])
  const linkedMemories = model.memories
    ? Object.keys(model.memories.projectMemories).filter((id) => model.projects.some((p) => p.uuid === id)).length
    : 0

  // Surface anything the parsers did not recognise — better a loud warning
  // than silently dropped content.
  for (const [type, n] of unknownBlockTypes) {
    warnings.push(`Unrecognised content block type "${type}" x${n} — rendered as raw JSON.`)
  }

  return {
    counts: {
      conversations: model.conversations.length,
      messages,
      humanMessages: human,
      assistantMessages: assistant,
      projects: model.projects.length,
      projectDocs: model.projects.reduce((n, p) => n + p.docs.length, 0),
      designChats: model.designChats.length,
      designChatMessages: model.designChats.reduce((n, d) => n + d.messages.length, 0),
      reflectionPeriods: model.reflections?.periods.length ?? 0,
      memoryFiles: model.memories?.files.length ?? 0,
      projectMemories: model.memories ? Object.keys(model.memories.projectMemories).length : 0,
      projectMemoriesLinked: linkedMemories,
      loginEvents: model.loginEvents.length,
      attachments,
      fileRefs: files,
      toolCalls,
      errorResults,
      thinkingBlocks,
      emptyMessages,
      unnamedConversations: model.conversations.filter((c) => !c.name).length,
      conversationsWithoutSummary: model.conversations.filter((c) => !c.summary).length,
    },
    dateRange: { fromMs: minMs, toMs: maxMs },
    blockKinds: sortDesc(blockKinds),
    tools: sortDesc(tools),
    languages: sortDesc(languages),
    skippedFiles: skipped,
    warnings,
    parsedAt: new Date().toISOString(),
  }
}
