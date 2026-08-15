# Claude Export Viewer — Style Guide

The single source of truth for the app's visual system. Extracted from the
existing implementation (`src/index.css`, the shared components, and the page
patterns). **Every new feature must look like it was always part of the product.**
Colours and text styling do not change; new surfaces reuse the tokens, spacing,
and component idioms documented here.

Design metaphor: *"a logbook on drafting film."* Two functional inks — **ochre**
(the human voice) and **drafting blue** (the assistant) — on a cool graphite
ground. Speaker identity is carried by ink and the ruled time-rail, so the UI
avoids avatars and chat bubbles and lets prose run full width.

---

## 1. Colour

All colours are OKLCH and live as CSS custom properties. **Dark is the default**;
`.light` on `<html>` opts out. Never hard-code a hex/oklch value in a component —
reference a token.

### Palette scales (`@theme` in `index.css`)

**Graphite** — cool, blue-cast neutral ground (deliberately not near-black):

| Token | Value |
|---|---|
| `--color-graphite-950` | `oklch(0.155 0.012 245)` |
| `--color-graphite-900` | `oklch(0.191 0.013 245)` |
| `--color-graphite-850` | `oklch(0.225 0.013 245)` |
| `--color-graphite-800` | `oklch(0.263 0.014 245)` |
| `--color-graphite-700` | `oklch(0.35 0.014 245)` |
| `--color-graphite-600` | `oklch(0.46 0.013 245)` |
| `--color-graphite-500` | `oklch(0.58 0.012 245)` |
| `--color-graphite-400` | `oklch(0.69 0.011 245)` |
| `--color-graphite-300` | `oklch(0.79 0.009 245)` |
| `--color-graphite-200` | `oklch(0.88 0.007 245)` |
| `--color-graphite-100` | `oklch(0.94 0.005 245)` |
| `--color-graphite-50`  | `oklch(0.975 0.004 245)` |

**Ochre** — the human voice (pencil annotation on film):

| Token | Value |
|---|---|
| `--color-ochre-600` | `oklch(0.6 0.115 76)` |
| `--color-ochre-500` | `oklch(0.7 0.125 78)` |
| `--color-ochre-400` | `oklch(0.79 0.115 80)` |
| `--color-ochre-300` | `oklch(0.86 0.08 82)` |

**Drafting blue** — the assistant voice:

| Token | Value |
|---|---|
| `--color-draft-600` | `oklch(0.56 0.105 235)` |
| `--color-draft-500` | `oklch(0.66 0.11 233)` |
| `--color-draft-400` | `oklch(0.755 0.095 232)` |
| `--color-draft-300` | `oklch(0.84 0.065 232)` |

### Semantic tokens (use these in components, not the scales above)

| Token | Dark | Light | Role |
|---|---|---|---|
| `--surface` | graphite-950 | `oklch(0.985 0.003 250)` | Page ground |
| `--surface-raised` | graphite-900 | `oklch(1 0 0)` | Cards, rails, panels |
| `--surface-high` | graphite-850 | `oklch(0.965 0.004 250)` | Hover / active row |
| `--surface-sunken` | `oklch(0.125 0.012 245)` | `oklch(0.955 0.005 250)` | Wells, table headers, tooltips |
| `--edge` | `oklch(1 0 0 / 9%)` | `oklch(0.2 0.02 245 / 13%)` | Default border |
| `--edge-strong` | `oklch(1 0 0 / 16%)` | `oklch(0.2 0.02 245 / 22%)` | Emphasised border, scrollbar |
| `--text` | graphite-100 | graphite-900 | Primary text |
| `--text-muted` | graphite-500 | graphite-600 | Secondary text |
| `--text-dim` | graphite-600 | graphite-500 | Tertiary / metadata |
| `--human` | ochre-400 | ochre-600 | Human accent |
| `--assistant` | draft-400 | draft-600 | Assistant accent |
| `--rail` | `oklch(1 0 0 / 11%)` | `oklch(0.2 0.02 245 / 15%)` | Vertical time/nav rails |

**Chart marks** are a separate job from text ink and have their own tokens, each
validated for contrast and CVD separation against its surface — do not reuse text
tokens as chart fills:

| Token | Dark | Light |
|---|---|---|
| `--chart-human` | `oklch(0.66 0.135 78)` | `oklch(0.6 0.115 76)` |
| `--chart-assistant` | `oklch(0.63 0.125 235)` | `oklch(0.56 0.105 235)` |
| `--chart-grid` | `oklch(1 0 0 / 7%)` | `oklch(0.2 0.02 245 / 9%)` |
| `--chart-axis` | graphite-600 | graphite-500 |

### Colour rules
- **Two functional inks only.** Ochre = human, drafting blue = assistant. Do not
  introduce a third accent hue for decoration. Red is reserved for the single
  destructive action ("clear data") via Tailwind `red-*` at low opacity.
- **Identity is never colour alone.** Every colour-coded mark also carries a
  label, a shape difference, or a text value (charts always ship a legend and a
  table view).
- Semantic confidence tones reuse existing ink, not new colours (see §7).

---

## 2. Typography

Three self-hosted IBM Plex families (bundled by Vite, zero network):

| Token | Stack | Used for |
|---|---|---|
| `--font-sans` | `'IBM Plex Sans Variable', ui-sans-serif, system-ui, sans-serif` | Body, UI, most text |
| `--font-serif` | `'IBM Plex Serif', ui-serif, Georgia, serif` | Page titles, stat-tile figures |
| `--font-mono` | `'IBM Plex Mono', ui-monospace, Menlo, monospace` | Metadata, counts, labels, code, tool/lang names |

`body`: `font-family: var(--font-sans)`, `font-synthesis-weight: none`,
`-webkit-font-smoothing: antialiased`, `text-rendering: optimizeLegibility`.

### Type scale (observed, in px unless noted)
- **Page title (h1):** `font-serif text-3xl font-semibold tracking-tight` (detail headers use `text-[1.65rem]`).
- **Stat-tile figure:** `font-serif text-[1.9rem] leading-none font-semibold tabular-nums`.
- **Section heading (h2):** `text-[13px] font-medium`.
- **Body / row text:** `text-[13px]`; relaxed prose `leading-relaxed`.
- **Secondary text:** `text-[12.5px]` / `text-[12px]`.
- **Metadata / captions:** `text-[11.5px]` and `text-[11px]`, usually `text-[var(--text-dim)]`.
- **Micro numbers (counts, msg tallies):** `font-mono text-[10.5px] text-[var(--text-dim)] tabular-nums`.

**`rule-label`** — the signature small-caps mono label (a custom `@utility`):
```
font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.09em;
text-transform: uppercase; color: var(--text-dim);
```
Use for kickers above titles, column headers, and section notes.

### Typography rules
- Always `tabular-nums` for numbers that align in columns or update in place.
- Use `font-mono` for anything machine-ish: counts, dates in metadata, tool
  names, IDs, keyboard hints.
- Titles are serif; running UI is sans; data is mono. Keep those roles.

---

## 3. Spacing, radii, borders, shadows

- **Page frame:** scroll container `h-full overflow-y-auto`, inner
  `mx-auto max-w-4xl` (activity/detail) or `max-w-5xl` (index grids) `px-6 py-10`.
- **Section rhythm:** `mt-10` between major sections; heading block `mb-3`.
- **Spacing scale:** Tailwind defaults; common gaps `gap-2`, `gap-3`, `gap-x-4 gap-y-1`; lists `space-y-1` / `space-y-0.5`; card padding `p-4` or `px-4 py-3.5`.
- **Radii:** `rounded` (rows/hover), `rounded-md` (buttons, selects, small controls), `rounded-lg` (tables, tooltips), `rounded-xl` (cards, tiles, panels). `rounded-[2px]`/`[3px]` for legend swatches and chart bars.
- **Borders:** `border border-[var(--edge)]` default; `border-[var(--edge-strong)]` for emphasis; `border-dashed border-[var(--edge-strong)]` for "uncertain / suggested / empty" affordances.
- **Shadows:** almost none. Only floating layers use one (`shadow-lg` on the chart tooltip). Depth comes from surface tokens and borders, not shadow.

---

## 4. Components & patterns

**Card** (project card, tile):
`rounded-xl border border-[var(--edge)] bg-[var(--surface-raised)] p-4 transition hover:border-[var(--edge-strong)]`.

**Stat tile** (`Tile` in ActivityPage): serif figure + `text-[12.5px]` label +
optional `text-[11.5px] text-[var(--text-dim)]` sub. Grid `grid-cols-2 sm:grid-cols-4 gap-3`.

**Section** (`Section` in ActivityPage): `<section class="mt-10">` → heading row
`mb-3 flex flex-wrap items-baseline gap-2` holding an h2 + a `rule-label` note +
optional right-aligned `aside` controls.

**List row / link row:** `flex items-baseline gap-2 rounded px-1.5 py-1 transition hover:bg-[var(--surface-high)]`,
title `min-w-0 flex-1 truncate text-[13px]`, trailing mono micro-metadata.

**Segmented / toggle control** (granularity buttons): mono `text-[11px]`,
`rounded-md border px-2 py-1`; active = `border-[var(--human)]/50 text-[var(--human)]`,
inactive = `border-[var(--edge)] text-[var(--text-muted)] hover:border-[var(--edge-strong)]`.

**Select:** `rounded-md border border-[var(--edge)] bg-[var(--surface-raised)] px-2 py-1 font-mono text-[11px] text-[var(--text-muted)]`.

**Ghost / utility button:** `rule-label rounded-md border border-[var(--edge)] px-2 py-1.5 text-center transition hover:border-[var(--edge-strong)] hover:text-[var(--text)]`.

**Badge / pill:** `rounded border px-1.5 py-px font-mono text-[10px]` with a tone
class (see §7). "suggested"/"named by export"-style chips follow this.

**Empty state:** `rounded-lg border border-dashed border-[var(--edge-strong)]
px-4 py-6 text-center text-[13px] text-[var(--text-muted)]` with a one-line
prompt toward the resolving action.

**Left nav rail** (`AppShell`): fixed `w-[13.5rem]` column,
`border-r border-[var(--edge)] bg-[var(--surface-raised)]`. Each item is a
`NavLink` with a 1px ochre active tick (`h-3 w-px`), label, and an optional mono
count. Active row = `bg-[var(--surface-high)] text-[var(--text)]`.

**Time rail** (timeline, thread): a two-column grid with a ruled gutter —
`grid grid-cols-[var(--gutter)_1fr] gap-x-3.5` and an absolutely-positioned
`w-px bg-[var(--rail)]` divider; right-aligned mono date label in the gutter.
This ruled-gutter language is the app's structural signature — reuse it for any
new chronological or grouped view.

**Charts** (Recharts): grid `var(--chart-grid)` horizontals only; axes mono 10px
`var(--chart-axis)`, `tickLine={false}`; bars use `--chart-human`/`--chart-assistant`
with a 2px `var(--surface)` stroke to gap stacked segments; custom tooltip on
`--surface-raised` + `--edge-strong` + `shadow-lg`. Always pair a chart with a
legend and offer a table view for the same numbers.

---

## 5. Interactive states

- **Hover:** rows → `hover:bg-[var(--surface-high)]`; cards/controls →
  `hover:border-[var(--edge-strong)]` and/or `hover:text-[var(--text)]`. Always
  via `transition` (colour/border), never a layout shift.
- **Active/selected:** `bg-[var(--surface-high)]`; nav adds the ochre tick.
- **Focus:** global `:focus-visible` → `2px solid var(--color-ochre-400)`,
  `outline-offset: 2px`, `border-radius: 3px`. Never remove it.
- **Disabled:** drop the hover affordance (`disabled:` / `enabled:hover:` guards);
  keep text legible.
- **Selection:** `::selection` is ochre-500 ground with graphite-950 text.
- **Scrollbars:** thin, `--edge-strong` thumb on transparent track.

---

## 6. Motion

- **No animation library is installed.** Motion is CSS/Tailwind `transition` +
  keyframes only. Do **not** add Framer Motion or similar.
- Default to `transition` on colour/border/opacity/transform. Keep durations
  short (~120–200ms) and easing default; motion must aid comprehension
  (expand/reveal, state change, selection), never decorate.
- **Respect `prefers-reduced-motion`:** the base layer already forces
  animation/transition durations to `0.01ms` under that query — never override it,
  and don't rely on motion to convey meaning that isn't also in layout/text.
- Reveal patterns (evidence expanders, group collapse) should animate height/
  opacity subtly and remain fully usable with motion disabled.

---

## 7. Confidence & relationship semantics

Relationship links carry a confidence, rendered by `ConfidenceBadge` using
`CONFIDENCE_LABEL` (`projectLinks.js`) and the `TONE` map (`ProjectsPage.jsx`).
Reuse this vocabulary for all relationship UI — do not invent parallel colours:

| Confidence | Label | Tone classes |
|---|---|---|
| `manual` | *tagged by you* | `text-[var(--human)] border-[var(--human)]/40` |
| `high` | *auto-matched* | `text-[var(--assistant)] border-[var(--assistant)]/35` |
| `medium` | *auto-matched, likely* | `text-[var(--text-muted)] border-[var(--edge-strong)]` |
| `low` | *auto-matched, uncertain* | `text-[var(--text-dim)] border-dashed border-[var(--edge-strong)]` |

Principles carried by the current UI, to be preserved and extended:
- **Honesty about inference.** Inferred links always say they are inferred and
  "not from the export." Ochre = your own decision; drafting blue = a confident
  machine match; muted/dim + dashed = increasing uncertainty.
- **Ambiguity is shown, not hidden** — dashed borders and "also matches other
  projects"-style reasons communicate low confidence rather than forcing a pick.
- **Every relationship carries its reason.** New relationship UI must keep the
  reason/evidence visible or one interaction away.

---

## 8. Dark / light handling

- Dark is default (`:root`), `.light` overrides. Light tokens are **selected for
  the light surface, not flipped** from dark (chart inks especially).
- Theme persists in `localStorage['cev-theme']` and is applied before first paint.
- **Print** overrides all tokens to ink-on-paper, unwraps scroll panes, expands
  collapsibles, and hides interactive chrome (`nav`, `button`, `select`, `input`,
  `aside`). Any new interactive-only component must be hidden in print
  (`print:hidden`) and any new scroll pane must unwrap on paper.

---

## 9. Dates & numbers

- Dates follow the **app's explicit format preference** (`lib/prefs.js`:
  English / Deutsch / ISO / System), **never the raw OS locale**. Always format
  through `lib/format.js` (`fmtDate`, `fmtDateTime`, `fmtDateLong`, `fmtClock`).
- Relative ages must never be ambiguous: pair a relative label with an absolute
  date (tooltip or inline). `fmtDateLong` is the spelled-out unambiguous fallback.
- Numbers: `fmtNum` (locale thousands) and `tabular-nums` everywhere they align
  or update.

---

## 10. Chat reader chrome

Every surface that renders a chat (the thread reader, the same reader reached via
Relationships, and the design-chat reader) shares one set of reader components so
they look and behave identically. Reuse these, never re-implement them per view.

- **Table of contents** (`ChatTableOfContents`) — a permanent right-hand
  `aside` (`hidden xl:flex w-56 border-l border-[var(--edge)]`, `print:hidden`).
  It is the time-rail grammar (§4) turned into an outline: turns grouped under
  small-caps date labels, each entry a speaker-inked tick (`--human` / `--assistant`,
  full opacity when active, `0.55` otherwise) + a mono `9.5px` `roleLabel · clock`
  line + a truncated `12px` preview. The assistant's H1–H3 headings nest beneath
  their turn as dimmer `11px` sub-entries, indented by level. Active row =
  `bg-[var(--surface-high)]` with `--text` (matching §5). Below `xl` the panel
  folds into a drawer opened by a fixed pill button (`shadow-lg` — one of the few
  allowed shadows, §3), never disappearing.
- **Scroll-spy.** "You are here" comes from `useScrollSpy` over `[data-spy]`
  anchors. Every turn container carries `id="turn-<i>"` + `data-spy`; rendered
  headings carry `id="turn-<i>-b<n>-h<k>"` + `data-spy`. Clicking an entry
  smooth-scrolls to the anchor (routing through the owning row under
  virtualisation), never nudging the page.
- **Rendered ⇄ Markdown toggle** (`ChatViewToggle`) — the segmented control from
  §4 bound to a session-wide store (`lib/chatViewMode.js`), default *rendered*.
  Prose renders through the shared `Prose` block, which shows raw source as a
  `markdown` code block when *source* is active.
- **Copy is always raw markdown.** Whole-chat and per-turn copy emit source
  regardless of the view mode; the rendered view is display-only.
