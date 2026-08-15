import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { buildProjectLinks, resolveDesignChatProject } from './projectLinks.js'
import { loadTags, setTag as persistTag, loadDismissals, setDismissal as persistDismissal } from './db.js'
import { createIndex, collectFacets } from './search.js'
import { buildRelatednessIndex } from './related.js'
import { buildRecommendations } from './projectRecommend.js'

/** Stable key for a rejected chat→project recommendation. */
export const dismissKey = (chatUuid, projectUuid) => `${chatUuid}::${projectUuid}`

const ModelContext = createContext(null)

/** Per-conversation searchable text, capped so one huge thread can't dominate. */
const SEARCH_TEXT_CAP = 24000

function buildSearchText(conv) {
  const parts = [conv.name, conv.summary]
  let len = parts.join(' ').length
  for (const m of conv.messages) {
    if (len >= SEARCH_TEXT_CAP) break
    const t = m.plain || m.fallbackText || ''
    if (!t) continue
    parts.push(t)
    len += t.length
  }
  return parts.join('\n').slice(0, SEARCH_TEXT_CAP)
}

export function ModelProvider({ model, children }) {
  const [tags, setTags] = useState({})
  const [tagsLoaded, setTagsLoaded] = useState(false)
  const [dismissed, setDismissed] = useState(() => new Set())

  useEffect(() => {
    loadTags().then((t) => {
      setTags(t)
      setTagsLoaded(true)
    })
    loadDismissals().then(setDismissed)
  }, [])

  // Derived once per model: indexes and the searchable projection.
  const base = useMemo(() => {
    const conversations = model.conversations.map((c) => ({ ...c, searchText: buildSearchText(c) }))
    // A design chat's own project.uuid does not match any project file — see
    // resolveDesignChatProject. Resolve once, here, so every view agrees.
    const designChats = model.designChats.map((d) => ({
      ...d,
      resolvedProjectUuid: resolveDesignChatProject(d, model.projects),
    }))
    return {
      ...model,
      conversations,
      designChats,
      projectsById: new Map(model.projects.map((p) => [p.uuid, p])),
      conversationsById: new Map(conversations.map((c) => [c.uuid, c])),
      designChatsById: new Map(designChats.map((d) => [d.uuid, d])),
    }
  }, [model])

  // Built once per model (~200 ms for this corpus), not per render.
  const searchIndex = useMemo(() => createIndex(base.conversations), [base])
  const relatedIndex = useMemo(() => buildRelatednessIndex(base.conversations), [base])
  const facets = useMemo(() => collectFacets(base.conversations), [base])

  const links = useMemo(
    () =>
      buildProjectLinks({
        conversations: base.conversations,
        projects: base.projects,
        designChats: base.designChats,
        tags,
      }),
    [base, tags],
  )

  // Scored chat→project recommendations for every unlinked chat. Rebuilt when
  // the model, the confirmed links, or the set of rejected suggestions change.
  const recommendations = useMemo(
    () =>
      buildRecommendations(
        { conversations: base.conversations, projects: base.projects, links, relatedIndex, memories: base.memories },
        { dismissed },
      ),
    [base, links, relatedIndex, dismissed],
  )

  const setTag = useCallback(async (conversationUuid, projectUuid) => {
    setTags((prev) => {
      const next = { ...prev }
      if (projectUuid) next[conversationUuid] = projectUuid
      else delete next[conversationUuid]
      return next
    })
    await persistTag(conversationUuid, projectUuid)
  }, [])

  // Confirm a recommendation = tag the chat (persisted, survives re-parse).
  const confirmRecommendation = setTag

  const dismissRecommendation = useCallback(async (conversationUuid, projectUuid) => {
    const key = dismissKey(conversationUuid, projectUuid)
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
    await persistDismissal(key, true)
  }, [])

  const restoreRecommendation = useCallback(async (conversationUuid, projectUuid) => {
    const key = dismissKey(conversationUuid, projectUuid)
    setDismissed((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
    await persistDismissal(key, false)
  }, [])

  const value = useMemo(
    () => ({
      ...base,
      links,
      tags,
      tagsLoaded,
      setTag,
      searchIndex,
      relatedIndex,
      facets,
      recommendations,
      dismissed,
      confirmRecommendation,
      dismissRecommendation,
      restoreRecommendation,
    }),
    [
      base,
      links,
      tags,
      tagsLoaded,
      setTag,
      searchIndex,
      relatedIndex,
      facets,
      recommendations,
      dismissed,
      confirmRecommendation,
      dismissRecommendation,
      restoreRecommendation,
    ],
  )

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
}

export function useModel() {
  const ctx = useContext(ModelContext)
  if (!ctx) throw new Error('useModel must be used inside <ModelProvider>')
  return ctx
}
