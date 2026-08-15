/**
 * "You are here" for a scrollable region.
 *
 * Given a scroll container and a set of marked section elements (anything with a
 * `data-spy` attribute), it reports which section the reader is currently in —
 * the last one whose top has passed a threshold below the container's top edge.
 *
 * Works by reading live DOM positions on scroll, so it's agnostic to how the
 * content is rendered: a virtualised thread (only the visible rows exist in the
 * DOM, but the current one always does) and a plain month list both work.
 */

import { useEffect, useState } from 'react'

/**
 * @param {() => (Element|null)} getScrollEl  returns the scroll container
 * @param {string} selector                   marks the sections, e.g. '[data-spy]'
 * @param {{ threshold?: number, deps?: any[] }} opts
 * @returns {string|null} the `data-spy` value of the active section
 */
export function useScrollSpy(getScrollEl, selector, { threshold = 88, deps = [] } = {}) {
  const [active, setActive] = useState(null)

  useEffect(() => {
    const el = getScrollEl()
    if (!el) return

    let raf = 0
    const compute = () => {
      raf = 0
      const top = el.getBoundingClientRect().top
      let current = null
      for (const node of el.querySelectorAll(selector)) {
        const offset = node.getBoundingClientRect().top - top
        if (offset - threshold <= 1) current = node.getAttribute('data-spy')
        else break // nodes are in document order; the first one below the line ends it
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute)
    }

    compute()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getScrollEl, selector, threshold, ...deps])

  return active
}

/**
 * Bring `el` into view by scrolling ONLY `container` — never its ancestors, so a
 * jump-index that lives inside the page can't nudge the page itself. Handles
 * both axes (the index is horizontal on mobile, vertical on desktop).
 */
export function scrollWithin(container, el) {
  if (!container || !el) return
  const c = container.getBoundingClientRect()
  const e = el.getBoundingClientRect()
  const pad = 8
  if (e.top < c.top) container.scrollTop -= c.top - e.top + pad
  else if (e.bottom > c.bottom) container.scrollTop += e.bottom - c.bottom + pad
  if (e.left < c.left) container.scrollLeft -= c.left - e.left + pad
  else if (e.right > c.right) container.scrollLeft += e.right - c.right + pad
}

/** Walk up from `el` to the nearest actually-scrollable ancestor. */
export function findScrollParent(el) {
  let node = el?.parentElement
  while (node) {
    const oy = getComputedStyle(node).overflowY
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return node
    node = node.parentElement
  }
  return null
}
