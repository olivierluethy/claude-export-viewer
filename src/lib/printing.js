/**
 * Print mode.
 *
 * Printing a thread has to defeat two optimisations that are right on screen and
 * wrong on paper: virtualisation (only ~7 of 217 turns are mounted) and lazy
 * collapsibles (collapsed content is not in the DOM at all). Both consult this
 * store, so entering print mode renders the complete record, and leaving it
 * hands the optimisations straight back.
 *
 * A tiny external store rather than context: `Collapsible` is used deep inside
 * virtualised rows, and this avoids re-rendering the whole tree through
 * provider plumbing.
 */

import { useSyncExternalStore } from 'react'

let printing = false

/**
 * Expanding everything is faithful but enormous: the 217-turn thread in this
 * corpus prints to 939 A4 pages with all tool output included. These let you
 * choose the faithful record or the readable one.
 */
let options = { tools: true, thinking: true }

const listeners = new Set()

const emit = () => listeners.forEach((l) => l())

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => printing
const getOptions = () => options

export function usePrinting() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export function usePrintOptions() {
  return useSyncExternalStore(subscribe, getOptions, getOptions)
}

export function setPrintOption(key, value) {
  if (options[key] === value) return
  options = { ...options, [key]: value }
  emit()
}

export function setPrinting(value) {
  if (printing === value) return
  printing = value
  emit()
}

/**
 * Expands everything, lets the browser lay it out, then opens the print dialog.
 * `window.print()` blocks, so the reset runs after it returns as well as on the
 * afterprint event — some browsers fire only one of the two.
 */
export async function printDocument() {
  setPrinting(true)
  // Two frames: one for React to commit the expanded tree, one for layout.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  // Fonts must be settled or the pagination is computed against fallbacks.
  try {
    await document.fonts?.ready
  } catch {
    /* not fatal */
  }

  const done = () => setPrinting(false)
  window.addEventListener('afterprint', done, { once: true })
  try {
    window.print()
  } finally {
    setTimeout(done, 500)
  }
}
