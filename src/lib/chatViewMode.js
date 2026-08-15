/**
 * Whether chats render as formatted markdown ('rendered', the default) or as
 * their raw markdown source ('source'). One choice, shared by every chat view
 * and remembered for the session — flip it in a thread, open a design chat, and
 * it is still where you left it. Copy actions ignore this entirely and always
 * emit the raw source (see lib/toMarkdown.js).
 */

import { useSyncExternalStore } from 'react'

const KEY = 'cev-chatview'
const DEFAULT = 'rendered'

function read() {
  try {
    const v = sessionStorage.getItem(KEY)
    return v === 'source' || v === 'rendered' ? v : DEFAULT
  } catch {
    return DEFAULT
  }
}

let mode = read()
const listeners = new Set()

const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useChatViewMode() {
  return useSyncExternalStore(subscribe, () => mode, () => DEFAULT)
}

export function setChatViewMode(value) {
  if ((value !== 'source' && value !== 'rendered') || value === mode) return
  mode = value
  try {
    sessionStorage.setItem(KEY, value)
  } catch {
    /* private mode — the choice just won't outlive this view */
  }
  listeners.forEach((l) => l())
}
