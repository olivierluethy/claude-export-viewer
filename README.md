# Claude Export Viewer

A local, offline browser app for reading and searching your Claude data export —
conversations, projects, design chats, reflections and memories.

**Nothing leaves your browser.** There is no backend, no API call, no analytics
and no telemetry. The export is unzipped, parsed, indexed, searched and rendered
entirely on your machine. You can pull the network cable out and it behaves
identically. The only reason it needs a web server at all is that browsers refuse
to load ES modules and web workers from `file://` (see *Running the built app*).

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

Build a static copy:

```bash
npm run build      # → dist/
npx serve dist     # or any static file server
```

### Running the built app

`dist/` is fully self-contained — fonts are bundled, and there are no external
requests of any kind. It does need to be *served* rather than opened directly:
double-clicking `dist/index.html` will not work, because browsers block ES
modules and module workers over the `file://` protocol. Any static server does
the job, offline:

```bash
npx serve dist          # or: python3 -m http.server -d dist
```

Paths are relative, so it can be hosted from a subfolder, a USB stick or an
internal share without configuration.

---

## Loading your export

Two ways in, both producing the same in-memory model:

- **Zip** — drop the raw `data-*.zip` straight in. It is inflated in a worker
  with `fflate`; only the `.json` entries are decompressed.
- **Folder** — drop an extracted folder, or pick one with the folder button.
  Drag-and-drop recurses through subdirectories.

Files are recognised by filename and parent directory, so it does not matter how
deeply the export is nested.

After a successful load the parsed model is cached in **IndexedDB** (~37 MB for a
64 MB export) and restored on your next visit in about a second — no re-upload.
**Clear data** in the sidebar wipes it. Manual project tags live in a separate
store and survive re-parsing.

`localStorage` is deliberately not used: the corpus is orders of magnitude past
its ~5 MB ceiling.

---

## What it does

**Read** — threads render markdown, syntax-highlighted code with per-block copy,
collapsible tool calls and results, extended thinking, and attachments with their
extracted content. Each thread hangs off a *time rail*: a ruled gutter of
timestamps that breaks where a real pause occurred and prints how long it lasted,
so the rhythm of a long session is visible at a glance.

**Search** — two layers. Fuse.js gives typo tolerance over titles and summaries
(`tunevoat` still finds TuneVote); an exact scan over message bodies finds
phrases inside threads and produces the highlighted snippets. Filters for date
range, project, tool, language, sender, has-code and has-attachments combine
freely and live in the URL, so a filtered view is linkable and the back button
works. `⌘K` / `Ctrl-K` (or `/`) opens a jump-to palette over everything.

**Relate** — each thread gets a *Related chats (heuristic)* panel. This is
keyword and metadata overlap, **not** embeddings: TF-IDF term overlap (0.6),
same project (0.15), shared tools and languages (0.15) and closeness in time
(0.1). Every suggestion shows the reasons that fired.

**Analyse** — activity over time as vertical bars at day/week/month granularity,
breakdowns by project, tool and language, a date-sorted timeline, and a
relationship map of projects and their chats. Clicking a bar filters the search.

**Export** — copy a single turn, a whole thread as clean markdown, or any code
block. *Save as PDF* uses a print stylesheet and `window.print()`.

### About the PDF

Print mode switches virtualisation off and expands every collapsed block, so the
PDF is the complete record rather than what happened to be on screen. For the
217-message thread in the reference export that is **939 A4 pages** with all tool
output included, or **295 pages** with the *tool output* checkbox cleared — in
both cases real selectable, searchable text, not page images.

A canvas rasteriser (`html2pdf`/`jsPDF`) was considered and rejected: on threads
this size it produces an enormous image-per-page file and truncates.

---

## Data shapes

Every parser in `src/parsers/` carries a header block documenting the shape it
expects. These were verified against a real export (280 conversations, 3,631
messages, 30 projects) rather than assumed — and several things did not match the
documented shape:

| Expectation | What the export actually contains |
|---|---|
| Blocks are `text` / `tool_use` / `tool_result` | Also **`thinking`** (810), `token_budget` (119), `flag` (1) |
| `tool_result.content` is a string or array of text | Always an array here, and its items are `knowledge` (2,510 — web results with title/url/text), `text` (1,847), `local_resource` (455), `image` (66), `image_gallery` (1) |
| `tool_use.input` may need parsing | Already an object — **never** `JSON.parse` it. But `display_content.json_block` *is* a JSON string and must be parsed |
| Design chats link to projects by `project.uuid` | That UUID matches **no** project file — different namespace. Joined by `project.name` instead; one design chat ("Watch") has no project file at all |
| `login_history.json` is an array | An object: `{ login_events: [...] }` |
| Projects carry docs and prompt templates | 1 of 30 has a doc, 0 have a prompt template, 1 has a description. The real content is `memories.json.project_memories`, keyed by project UUID (25 entries, all matching) |

The parser reports anything it does not recognise as a warning on the Overview
page instead of dropping it silently.

### Conversations are not linked to projects

Regular conversations carry **no project field at all** — 0 of 280. Only design
chats name a project. So project association for ordinary chats is *inferred*,
and the app never presents it as fact:

- **tagged by you** — a manual assignment, stored in IndexedDB
- **auto-matched** — the project name appears in the conversation title
- **auto-matched, likely** — the name recurs in the message text
- **auto-matched, uncertain** — more than one project matches comparably

Names too generic to match on body text alone (`CV`, `Watch`, `Collage`, …) only
match via the title. On the reference export this links 65 of 280 conversations
(21 high confidence, 43 likely, 1 uncertain); the rest are left unassigned rather
than guessed at.

---

## Layout

```
src/
  parsers/        one per file type, each documenting its verified shape
    index.js        path classification → model assembly → summary
    blocks.js       content-block normaliser (the subtle one)
    conversations.js  projects.js  designChats.js
    reflections.js    memories.js  users.js  loginHistory.js
  workers/
    parse.worker.js unzip + parse + IndexedDB write, all off the main thread
  lib/
    db.js           IndexedDB cache, schema-versioned
    search.js       Fuse + exact scan + filters
    related.js      TF-IDF relatedness heuristic
    projectLinks.js conversation → project inference
    stats.js        activity aggregation
    printing.js     print mode store
  components/     shell, reader, blocks, UI primitives
  pages/          conversations, projects, design, reflections, memory,
                  search, activity, graph
```

**Performance.** The 64 MB `conversations.json` is parsed in a web worker, so the
UI never blocks — about 1.3 s from dropped zip to rendered summary. The
conversation list and the message thread are both virtualised: a 217-message
thread mounts 5–14 turns at a time against a 26,000 px canvas. Collapsed tool
blocks are not in the DOM until opened.

**Accessibility and theming.** Dark by default with a light toggle; both palettes
are defined independently rather than flipped. The two chart inks are validated
for colour-vision separation and contrast against both surfaces, chart identity
is never carried by colour alone (legend plus a table view), and
`prefers-reduced-motion` is respected.

---

## Privacy notes

`users.json` contains your name, email address and phone number, and the archive
contains private project content. All of it stays local. The owner's name appears
in the sidebar; contact details are parsed but not displayed.

Two things worth knowing before you show this to anyone:

- The IndexedDB cache persists on whatever machine and browser profile you load
  it in. Use **Clear data** on a shared machine.
- Links inside messages point at the real web. Following one is a network
  request you initiated — the app itself never makes any.
