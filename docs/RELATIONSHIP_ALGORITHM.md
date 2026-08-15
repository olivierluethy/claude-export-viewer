# Project ↔ Chat Relationship Algorithm

Developer reference for the recommendation engine in
`src/lib/projectRecommend.js`. It documents the *intended* behaviour and the
reasoning behind the design decisions, not merely what the code happens to do.

> **Honesty constraint.** There is no embedding model available offline. Every
> signal here is lexical (TF-IDF over the same vectors `lib/related.js` builds)
> or plain metadata overlap. Nothing in this system is semantic embedding, and
> the UI must never imply that it is.

---

## 1. Purpose

Regular conversations in a Claude export carry **no project field** (verified
0/280 in the reference export). Many unlinked chats nonetheless *belong* to an
existing project. The engine's job is to **discover those relationships, score
them by confidence, explain each one, and — crucially — decline to guess** when
the evidence doesn't support a link. It never mutates data; it produces
recommendations that a human confirms, rejects, or reassigns.

The design goal is a *recommendation problem*, not binary classification: one
chat is evaluated against **many** candidate projects and may end up clearly in
one, ambiguous between several, or in none.

## 2. Inputs

Per chat: `name`, `summary`, `searchText` (title + summary + capped message
text, built in `ModelContext`), `facets.tools`, `facets.languages`,
`createdAtMs`/`updatedAtMs`, and its TF-IDF vector from `relatedIndex.vectors`.

Per project: `name`, `description`, `promptTemplate`, remembered facts
(`memories.projectMemories[uuid]`), and its **already-known chats** — your
manual tags, the export's design chats, and current name-inferred links
(`links.byProject`).

## 3. Signals (features)

Six signals, each normalised to `0..1`, then weighted (`WEIGHTS`) and summed ×100
into a 0–100 score:

| Signal | Weight | What it measures |
|---|---|---|
| `name` | 0.32 | The project's name appears in the chat — **fuzzily**. Exact phrase is strongest; a multi-token name also matches when its tokens appear *in order with a word or two between them* ("WhatsApp **Web** Customizer" ⇒ the project "WhatsApp Customizer"); title hits are decisive. Generic/ambiguous names ("Google Search", "CV", ≤3 chars) stay title-only. Shared with `inferProject` via `nameEvidence`. |
| `content` | 0.26 | TF-IDF cosine between the chat's vector and the project's **centroid** (mean of its member chats' vectors). Scaled `min(1, cos×2.2)` because in-corpus cosines rarely exceed ~0.45. |
| `entity` | 0.18 | A **distinctive identifier** shared with the project's chats — a product domain, a Chrome-extension id, a GitHub repo. Filtered two ways so only real fingerprints count: a curated blocklist of generic platforms (`linkedin.com`, `github.io`, `draw.io`, …, matched on the registrable domain so `www.`/`web.` subdomains collapse) **and** a corpus-frequency (IDF) cut — an identifier appearing in more than ~5% of chats is treated as generic and ignored. Saturates at ~2 shared. |
| `terminology` | 0.10 | How many of the project's own distinctive terms (from its name/description/prompt/memory) appear among the chat's top terms. Saturates at 5 hits. |
| `toolsLangs` | 0.08 | Count of tools & programming languages shared with the project's chats. Saturates at 4. |
| `temporal` | 0.06 | Whether the chat was written during the project's active window (1.0 inside; linear decay to 0 at 8 weeks outside). Deliberately low-weighted: most chats overlap some project's date span, so timing alone is not evidence. |

Each signal that fires contributes an **evidence entry** — `{key, value, points,
label, detail}` — so the score is fully decomposable in the UI and in devtools.

> **Why fuzzy names matter.** In the reference export the project is named
> "WhatsApp Customizer" but every chat says "WhatsApp *Web* Customizer", so exact
> matching scored zero and missed ~36 chats that plainly belong to it (including
> one titled "Blog Post Generator", which shares no words with the project name at
> all). Token-in-order matching recovers them; entity fingerprints
> (`wwebcustomizer.com`, the extension id) catch the rest that never name it.

## 4. How scores are calculated

`score = Σ over signals ( normalisedValue × weight ) × 100`, rounded to 0.1.
Because weights sum to 1.0, the theoretical maximum is 100 (every signal
saturated). A pure title-name match alone yields ~25 points but is flagged
`titleHit`, which makes it **decisive** in classification regardless of the raw
number — the export naming a project in the title is far stronger evidence than
its point value suggests.

## 5. Candidate selection (why it scales)

Naïve scoring is O(chats × projects). Instead, for each chat we generate a
*candidate set* first:

- projects whose **name** matches the chat (via the fuzzy name matchers),
- projects sharing at least one of the chat's **top terms**, and
- projects sharing a **distinctive entity** (domain / extension id / repo),

all looked up in a prebuilt `term|@entity → Set(projectUuid)` inverted index.

Only these candidates are fully scored, then pre-ranked and capped at
`MAX_CANDIDATES` (8). A chat that shares nothing with any project is scored
against nothing and correctly yields "none". Cost is therefore
O(chats × *candidates* × terms), and candidates is small and roughly constant as
the project count grows — the inverted index, not a full sweep, does the
narrowing. Profiles, matchers, and the term index are each built **once** per
model and memoised.

## 6. How confidence is determined

`classify()` maps a sorted candidate list to a status using `THRESHOLDS`:

- `FLOOR = 20` — best below this → **`none`** (no meaningful relationship). Tuned
  so a content- or entity-driven match survives, but a lone weak signal (e.g. a
  rare-but-generic shared domain plus mere date overlap) does not.
- `HIGH = 60` — best at/above this → **`high`**.
- `DECISIVE = 74` **or** a `titleHit` → treated as decisive (→ `high`).
- `MARGIN = 10` — if best is *not* decisive and `best − runnerUp < 10` →
  **`ambiguous`**.
- otherwise (≥ FLOOR, clear enough) → **`medium`**.

Rationale: a weak best is not a relationship (FLOOR); a near-tie between two
projects is not trustworthy for either (MARGIN → ambiguous); an explicit title
naming or a very strong aggregate is trustworthy even against a close runner-up
(DECISIVE).

## 7. Competing projects

All candidates are retained on the recommendation (`candidates[]`), sorted by
score, so the UI can show "also considered: Project Y (46), Project Z (31)". The
margin rule uses the runner-up explicitly. A chat that plausibly touches several
projects surfaces as `ambiguous` **with all of them visible**, rather than being
silently assigned to the top one.

## 8. When a relationship is automatically *recommended*

When `status ∈ {high, medium}`: enough evidence, and a clear enough winner.
`high` is safe for bulk confirmation; `medium` is surfaced for individual review.
A recommendation is **never** written to data automatically — it is a suggestion
until a human confirms it (which persists as a manual tag).

## 9. When *no* relationship is created

- `none` — best candidate under FLOOR, or no candidate shared any signal.
- `ambiguous` — evidence exists but no single project is defensible; left for the
  human, never auto-linked.
- Chats **already associated with a project** — by your tag, by the export's
  design chats, or by the existing name-match inference — are skipped entirely.
  They already appear inside that folder; re-recommending them there is noise
  (see §10). Only chats with *no* association at all are scored.

## 10. Avoiding false positives / not overwriting confirmed links

- **Only unlinked chats are scored.** A chat that already has any link in
  `links.byConversation` (manual tag, export design chat, or name-match
  inference) is treated as "already in a project" and excluded from
  recommendations, so the review queue never re-suggests a chat for the folder
  it is already in, and a recommendation can never overwrite an existing link.
- **Profiles are read-only during scoring.** They are seeded from known links
  once; a new recommendation never feeds back into a profile, so the engine
  can't bootstrap its own guesses into "evidence".
- **Generic names are excluded** from body-only matching (`AMBIGUOUS_NAMES`).
- **Rejections stick.** A `${chatUuid}::${projectUuid}` pair the user rejects is
  passed in `dismissed` and removed before classification, so a declined
  candidate can't re-win on the next pass.
- The FLOOR and MARGIN rules exist specifically to convert weak or contested
  evidence into `none`/`ambiguous` rather than a confident-looking wrong link.

## 11. Performance at scale

- One pass builds profiles, the name matchers, and the term inverted index.
- Per chat: gather candidates via the inverted index (small set), score ≤ 8,
  classify. No all-pairs comparison.
- Vectors are already built and memoised by `ModelContext`; the whole
  recommendation index is memoised on `[model, dismissed]`.
- For the reference corpus (~280 chats / 30 projects) this is effectively
  instant. The candidate-generation strategy is what keeps it linear-ish as the
  archive grows; if profiles ever dominate, they can move into the parse worker
  the same way the search index does.

## 12. Debugging & extending

- `buildRecommendations(model, {dismissed})` returns
  `{ byConversation, byProject, queue, stats }`. Inspect
  `byConversation.get(uuid)` for a chat's full verdict: `status`, `top`,
  every `candidate` with its `score` and `evidence[]`, and `rejected` (the
  human-readable reason a chat is `none`/`ambiguous`).
- `classify()` and `WEIGHTS`/`THRESHOLDS` are exported and pure — tune weights or
  thresholds in one place and the whole system follows.
- To add a signal: compute a `0..1` value in `scoreCandidate`, push an evidence
  entry, and give it weight in `WEIGHTS` (keep the sum at 1.0). The dashboard,
  review queue, and explainability UI pick it up automatically because they read
  `evidence[]` generically.
- The Relationship Review page (`/review`) is the human-facing window onto all of
  the above; the per-chat `ProjectTagger` and `RelatedPanel` surface the same
  evidence in context.

> This documents the observable algorithmic logic — signals, scores, thresholds,
> and decision criteria. It intentionally exposes no hidden chain-of-thought.
