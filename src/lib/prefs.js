/**
 * Display preferences.
 *
 * Date formatting used to follow the operating system's locale. On a Spanish
 * system that renders August as "11 ago 2026", which is doubly confusing next
 * to an English interface: "ago" is Spanish for August, but reads as the
 * English word "ago". Dates now follow an explicit, chosen format instead of
 * whatever the OS happens to be set to.
 */

import { useSyncExternalStore } from 'react'

const KEY = 'cev-dateformat'

export const DATE_FORMATS = {
  // Matches the interface language. Unambiguous in every language.
  en: { label: 'English', example: '11 Aug 2026', locale: 'en-GB' },
  de: { label: 'Deutsch', example: '11. Aug. 2026', locale: 'de-CH' },
  // Sorts correctly and cannot be misread anywhere. Formatted explicitly rather
  // than via a locale — passing month:'short' to any locale defeats it.
  iso: { label: 'ISO', example: '2026-08-11', locale: 'en-CA' },
  // Whatever this device is set to — the old behaviour, now opt-in.
  system: { label: 'System', example: 'device setting', locale: undefined },
}

const DEFAULT = 'en'

function read() {
  try {
    const v = localStorage.getItem(KEY)
    return v && DATE_FORMATS[v] ? v : DEFAULT
  } catch {
    return DEFAULT
  }
}

let format = read()
const listeners = new Set()

const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const getSnapshot = () => format

export function useDateFormat() {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT)
}

export function setDateFormat(value) {
  if (!DATE_FORMATS[value] || value === format) return
  format = value
  try {
    localStorage.setItem(KEY, value)
  } catch {
    /* private mode — preference just won't persist */
  }
  listeners.forEach((l) => l())
}

/** Read at call time by the formatters in format.js. */
export const dateLocale = () => DATE_FORMATS[format].locale
export const isIsoFormat = () => format === 'iso'
