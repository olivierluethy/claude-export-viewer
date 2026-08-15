/**
 * Relationships — projects, their chats, and the threads that connect across
 * project boundaries.
 *
 * Deliberately a deterministic radial layout rather than a force simulation:
 * with 280 chats a force graph converges into an unreadable hairball, and the
 * question being asked ("what belongs together, and what leaks between
 * projects?") is answered better by stable clusters you can actually point at.
 * Focus a project to see only its neighbourhood.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useModel } from '../lib/ModelContext.jsx'
import { findRelated } from '../lib/related.js'
import { fmtNum, titleOf } from '../lib/format.js'

const W = 960
const H = 700
const CX = W / 2
const CY = H / 2
const RING = 232

const polar = (cx, cy, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

const ASPECT = H / W
const MIN_W = W * 0.2 // deepest zoom-in (~5×)
const MAX_W = W * 1.25 // slight zoom-out headroom
const clampW = (w) => Math.max(MIN_W, Math.min(MAX_W, w))

export default function GraphPage() {
  const model = useModel()
  const navigate = useNavigate()
  const [focus, setFocus] = useState(null)
  const [hover, setHover] = useState(null)

  // Zoom & pan are expressed as the SVG viewBox, so every mark (and the tooltip,
  // which lives in SVG space) scales and translates together.
  const svgRef = useRef(null)
  const [view, setView] = useState({ x: 0, y: 0, w: W, h: H })
  const viewRef = useRef(view)
  viewRef.current = view
  const draggedRef = useRef(false)
  const [panning, setPanning] = useState(false)
  const atBase = view.w === W && view.x === 0 && view.y === 0

  const zoomAt = useCallback((factor, clientX, clientY) => {
    const svg = svgRef.current
    if (!svg) return
    const v = viewRef.current
    const rect = svg.getBoundingClientRect()
    const newW = clampW(v.w * factor)
    const newH = newW * ASPECT
    // Fraction of the viewport the focal point sits at (centre for buttons).
    const px = clientX == null ? 0.5 : (clientX - rect.left) / rect.width
    const py = clientY == null ? 0.5 : (clientY - rect.top) / rect.height
    const fx = v.x + px * v.w
    const fy = v.y + py * v.h
    setView({ x: fx - px * newW, y: fy - py * newH, w: newW, h: newH })
  }, [])

  const resetView = useCallback(() => setView({ x: 0, y: 0, w: W, h: H }), [])

  // Recentre whenever the focus changes — a focused cluster starts framed.
  useEffect(() => {
    resetView()
  }, [focus, resetView])

  // Wheel zoom, attached natively so it can preventDefault (React's onWheel is
  // passive and cannot stop the page from scrolling underneath).
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e) => {
      e.preventDefault()
      zoomAt(e.deltaY > 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // Pan with window-level listeners rather than SVG pointer capture. Capturing
  // the pointer on the SVG swallows the click that a node needs to navigate/focus
  // — so instead we track the drag on window and only suppress the click if the
  // pointer actually moved (a real drag), leaving plain clicks on nodes intact.
  const onPointerDown = (e) => {
    if (e.button != null && e.button > 0) return // left / touch only
    draggedRef.current = false
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const start = { cx: e.clientX, cy: e.clientY, view: viewRef.current }
    setPanning(true)
    const move = (ev) => {
      if (Math.abs(ev.clientX - start.cx) + Math.abs(ev.clientY - start.cy) > 4) draggedRef.current = true
      const dx = ((ev.clientX - start.cx) / rect.width) * start.view.w
      const dy = ((ev.clientY - start.cy) / rect.height) * start.view.h
      setView({ x: start.view.x - dx, y: start.view.y - dy, w: start.view.w, h: start.view.h })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setPanning(false)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // A pan-drag must not also register as a click on the node under the pointer.
  const clickGuard = (fn) => () => {
    if (!draggedRef.current) fn()
  }

  const clusters = useMemo(() => {
    const out = []
    for (const p of model.projects) {
      const g = model.links.byProject.get(p.uuid)
      if (!g) continue
      const chats = [...g.manual, ...g.auto]
      const design = g.design
      if (!chats.length && !design.length) continue
      out.push({ project: p, chats, design, total: chats.length + design.length })
    }
    return out.sort((a, b) => b.total - a.total)
  }, [model.projects, model.links])

  const overview = useMemo(() => {
    const n = clusters.length || 1
    return clusters.map((c, i) => {
      const angle = (360 / n) * i
      const [x, y] = polar(CX, CY, RING, angle)
      const hubR = 7 + Math.min(9, c.total * 0.6)
      const members = [...c.chats, ...c.design]

      // Large clusters get a second orbit; one ring of 13 dots collides with
      // the neighbouring hub.
      const perRing = Math.ceil(members.length / (members.length > 7 ? 2 : 1))
      const chats = members.map((item, j) => {
        const ring = Math.floor(j / perRing)
        const idxInRing = j % perRing
        const count = Math.min(perRing, members.length - ring * perRing)
        const r = hubR + 15 + ring * 13
        const a = (360 / Math.max(count, 1)) * idxInRing + angle + ring * 18
        const [px, py] = polar(x, y, r, a)
        return { item, x: px, y: py }
      })

      // Labels sit on the outward side of the ring, so they radiate away from
      // the centre instead of colliding with neighbours' dots.
      const [lx, ly] = polar(CX, CY, RING + hubR + 30, angle)
      const rightSide = lx >= CX - 8
      return { ...c, x, y, hubR, angle, chats, lx, ly, anchor: rightSide ? 'start' : 'end' }
    })
  }, [clusters])

  const focused = useMemo(() => {
    if (!focus) return null
    const cluster = clusters.find((c) => c.project.uuid === focus)
    if (!cluster) return null

    const members = [...cluster.chats, ...cluster.design]
    const inner = members.map((item, i, arr) => {
      const [x, y] = polar(CX, CY, 150, (360 / Math.max(arr.length, 1)) * i)
      return { item, x, y, isDesign: !item.facets }
    })

    // Related chats that sit OUTSIDE this project — the interesting leaks.
    const memberIds = new Set(members.map((m) => m.uuid))
    const outerMap = new Map()
    for (const m of cluster.chats.slice(0, 12)) {
      for (const r of findRelated({
        conversation: m,
        conversations: model.conversations,
        byId: model.conversationsById,
        index: model.relatedIndex,
        links: model.links,
        limit: 3,
      })) {
        if (memberIds.has(r.conversation.uuid)) continue
        if (!outerMap.has(r.conversation.uuid)) outerMap.set(r.conversation.uuid, { item: r.conversation, from: [] })
        outerMap.get(r.conversation.uuid).from.push(m.uuid)
      }
    }
    const outerList = [...outerMap.values()].slice(0, 14)
    const outer = outerList.map((o, i, arr) => {
      const [x, y] = polar(CX, CY, 262, (360 / Math.max(arr.length, 1)) * i + 12)
      return { ...o, x, y }
    })

    return { cluster, inner, outer }
  }, [focus, clusters, model])

  const label = (node) => (node.facets ? titleOf(node) : `${node.projectName || 'design'} · design chat`)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="rule-label">Relationships</p>
        <h1 className="mt-1.5 font-serif text-3xl font-semibold tracking-tight">
          {focused ? focused.cluster.project.name : `${clusters.length} clusters`}
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">
          {focused
            ? 'Inner ring: chats in this project. Outer ring: chats in other projects that this heuristic finds related — shared vocabulary, tools or timing.'
            : 'Each hub is a project; the dots around it are its chats. Only projects with at least one linked chat are shown. Click a hub to focus it.'}
        </p>

        {model.recommendations.stats.related > 0 && (
          <Link
            to="/review"
            className="mt-3 inline-flex items-center gap-2 rounded-md border border-[var(--human)]/35 bg-[var(--human)]/5 px-3 py-1.5 text-[12.5px] text-[var(--text-muted)] transition hover:border-[var(--human)]/60"
          >
            <span className="font-mono text-[var(--human)] tabular-nums">{fmtNum(model.recommendations.stats.related)}</span>
            unlinked chats look related to a project — review recommendations →
          </Link>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {focus && (
            <button
              onClick={() => setFocus(null)}
              className="rule-label rounded-md border border-[var(--edge)] px-2.5 py-1 hover:text-[var(--text)]"
            >
              ← all clusters
            </button>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--chart-human)' }} /> project
            </span>
            <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]">
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--chart-assistant)' }} /> chat
            </span>
            <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]">
              <span className="h-2 w-2 rounded-full border border-dashed border-[var(--text-dim)]" /> related,
              other project
            </span>
          </div>
          <span className="rule-label ml-auto hidden sm:block">scroll to zoom · drag to pan</span>
        </div>

        <div className="relative mt-4 overflow-hidden rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)]">
          {/* Zoom controls — scroll to zoom, drag to pan, or use these. */}
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 print:hidden">
            <button
              onClick={() => zoomAt(1 / 1.3)}
              title="Zoom in"
              aria-label="Zoom in"
              className="h-7 w-7 rounded-md border border-[var(--edge)] bg-[var(--surface-raised)]/90 font-mono text-[15px] leading-none text-[var(--text-muted)] transition hover:border-[var(--edge-strong)] hover:text-[var(--text)]"
            >
              +
            </button>
            <button
              onClick={() => zoomAt(1.3)}
              title="Zoom out"
              aria-label="Zoom out"
              className="h-7 w-7 rounded-md border border-[var(--edge)] bg-[var(--surface-raised)]/90 font-mono text-[15px] leading-none text-[var(--text-muted)] transition hover:border-[var(--edge-strong)] hover:text-[var(--text)]"
            >
              −
            </button>
            <button
              onClick={resetView}
              disabled={atBase}
              title="Reset zoom"
              aria-label="Reset zoom"
              className="h-7 w-7 rounded-md border border-[var(--edge)] bg-[var(--surface-raised)]/90 font-mono text-[12px] leading-none text-[var(--text-muted)] transition enabled:hover:border-[var(--edge-strong)] enabled:hover:text-[var(--text)] disabled:opacity-40"
            >
              ⤢
            </button>
          </div>
          <svg
            ref={svgRef}
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            onPointerDown={onPointerDown}
            style={{ cursor: panning ? 'grabbing' : 'grab', touchAction: 'none' }}
            className="h-auto w-full touch-none select-none"
            role="img"
            aria-label="Project relationship map. Scroll to zoom, drag to pan."
          >
            {!focused &&
              overview.map((c) => (
                <g key={c.project.uuid}>
                  {c.chats.map((n, i) => (
                    <line
                      key={i}
                      x1={c.x}
                      y1={c.y}
                      x2={n.x}
                      y2={n.y}
                      stroke="var(--chart-grid)"
                      strokeWidth="1"
                    />
                  ))}
                  {c.chats.map((n, i) => (
                    <circle
                      key={`d${i}`}
                      cx={n.x}
                      cy={n.y}
                      r="3.2"
                      fill="var(--chart-assistant)"
                      stroke="var(--surface-raised)"
                      strokeWidth="2"
                      className="cursor-pointer"
                      onMouseEnter={() => setHover({ x: n.x, y: n.y, text: label(n.item) })}
                      onMouseLeave={() => setHover(null)}
                      onClick={clickGuard(() => navigate(n.item.facets ? `/chats/${n.item.uuid}` : `/design/${n.item.uuid}`))}
                    />
                  ))}
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={c.hubR}
                    fill="var(--chart-human)"
                    stroke="var(--surface-raised)"
                    strokeWidth="2.5"
                    className="cursor-pointer"
                    onClick={clickGuard(() => setFocus(c.project.uuid))}
                  />
                  <text
                    x={c.lx}
                    y={c.ly + 3.5}
                    textAnchor={c.anchor}
                    className="pointer-events-none fill-[var(--text-muted)] font-mono text-[10.5px]"
                  >
                    {c.project.name.length > 18 ? `${c.project.name.slice(0, 17)}…` : c.project.name}
                  </text>
                  <text
                    x={c.lx + (c.anchor === 'start' ? -6 : 6)}
                    y={c.ly + 3.5}
                    textAnchor={c.anchor === 'start' ? 'end' : 'start'}
                    className="pointer-events-none fill-[var(--text-dim)] font-mono text-[9.5px]"
                  >
                    {c.total}
                  </text>
                </g>
              ))}

            {focused && (
              <g>
                {focused.outer.map((o, i) => (
                  <line
                    key={`ol${i}`}
                    x1={CX}
                    y1={CY}
                    x2={o.x}
                    y2={o.y}
                    stroke="var(--chart-grid)"
                    strokeWidth="1"
                    strokeDasharray="3 4"
                  />
                ))}
                {focused.inner.map((n, i) => (
                  <line key={`il${i}`} x1={CX} y1={CY} x2={n.x} y2={n.y} stroke="var(--chart-grid)" strokeWidth="1.2" />
                ))}

                {focused.outer.map((o, i) => (
                  <g key={`o${i}`}>
                    <circle
                      cx={o.x}
                      cy={o.y}
                      r="4"
                      fill="none"
                      stroke="var(--text-dim)"
                      strokeWidth="1.2"
                      strokeDasharray="2 2"
                      className="cursor-pointer"
                      onMouseEnter={() => setHover({ x: o.x, y: o.y, text: titleOf(o.item) })}
                      onMouseLeave={() => setHover(null)}
                      onClick={clickGuard(() => navigate(`/chats/${o.item.uuid}`))}
                    />
                  </g>
                ))}

                {focused.inner.map((n, i) => (
                  <g key={`i${i}`}>
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r="5"
                      fill="var(--chart-assistant)"
                      stroke="var(--surface-raised)"
                      strokeWidth="2"
                      className="cursor-pointer"
                      onMouseEnter={() => setHover({ x: n.x, y: n.y, text: label(n.item) })}
                      onMouseLeave={() => setHover(null)}
                      onClick={clickGuard(() => navigate(n.item.facets ? `/chats/${n.item.uuid}` : `/design/${n.item.uuid}`))}
                    />
                  </g>
                ))}

                <circle cx={CX} cy={CY} r="16" fill="var(--chart-human)" stroke="var(--surface-raised)" strokeWidth="3" />
                <text
                  x={CX}
                  y={CY + 34}
                  textAnchor="middle"
                  className="pointer-events-none fill-[var(--text)] font-mono text-[11px]"
                >
                  {focused.cluster.project.name}
                </text>
              </g>
            )}

            {hover && (
              <g className="pointer-events-none">
                <rect
                  x={Math.min(Math.max(hover.x - 110, 4), W - 224)}
                  y={hover.y - 30}
                  width="220"
                  height="22"
                  rx="4"
                  fill="var(--surface-sunken)"
                  stroke="var(--edge-strong)"
                />
                <text
                  x={Math.min(Math.max(hover.x - 110, 4), W - 224) + 8}
                  y={hover.y - 15}
                  className="fill-[var(--text)] text-[11px]"
                >
                  {hover.text.length > 34 ? `${hover.text.slice(0, 33)}…` : hover.text}
                </text>
              </g>
            )}
          </svg>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="text-[13px] font-medium">Clusters by size</h2>
            <span className="rule-label">+n = recommended, unconfirmed</span>
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {clusters.map((c) => {
              const b = model.recommendations.byProject.get(c.project.uuid)
              const recs = b ? b.high.length + b.medium.length + b.ambiguous.length : 0
              return (
                <li key={c.project.uuid}>
                  <button
                    onClick={() => setFocus(c.project.uuid)}
                    className={`flex w-full items-baseline gap-2 rounded px-2 py-1 text-left transition hover:bg-[var(--surface-high)] ${
                      focus === c.project.uuid ? 'bg-[var(--surface-high)]' : ''
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-[12.5px]">{c.project.name}</span>
                    {recs > 0 && (
                      <span
                        className="shrink-0 rounded border border-[var(--assistant)]/35 px-1.5 font-mono text-[9.5px] text-[var(--assistant)]"
                        title={`${recs} unlinked chat${recs === 1 ? '' : 's'} recommended for this project`}
                      >
                        +{recs}
                      </span>
                    )}
                    <span className="font-mono text-[10.5px] text-[var(--text-dim)] tabular-nums">
                      {fmtNum(c.total)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
