/**
 * Whether prose blocks in the current thread render as formatted markdown
 * ('rendered', the default) or as their raw markdown source ('source').
 * Lets the reader see the syntax behind a turn without leaving the view.
 */

import { createContext, useContext } from 'react'

export const MarkdownViewContext = createContext('rendered')
export const useMarkdownView = () => useContext(MarkdownViewContext)
