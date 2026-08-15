# Relationship Intelligence — how it works, and why it has to

This is the *explainer*: what the chat↔project relationship feature does, the hard
limitation in Claude's export that forces its whole design, and the reasoning
behind each decision we made. For the precise signals, weights, thresholds and
function-level behaviour, see the companion reference
[`RELATIONSHIP_ALGORITHM.md`](RELATIONSHIP_ALGORITHM.md). This document is the
"why"; that one is the "what".

---

## 1. The problem in one sentence

**A Claude export does not record which project a normal conversation belongs
to**, so if you want to see your chats grouped by project, the app has to
*reconstruct* those groupings by inference — it can never simply read them.

Everything else in this feature follows from that single fact.

---

## 2. What the export actually contains (verified)

This isn't an assumption — it was checked directly against a real export
(`data-…batch-0000`, 280 conversations, 30 projects, 3 design chats):

| Where a link could live | What's actually there |
|---|---|
| Each conversation in `conversations.json` | Only `account, chat_messages, created_at, name, summary, updated_at, uuid`. **No project field** — and no path anywhere in the file, even nested, contains the string "project". |
| Each project file in `projects/` | Only metadata (`name, description, docs, prompt_template, …`). **No list of member conversations.** |
| Cross-references between the two | **None.** A conversation's UUID appears only in `conversations.json`; nothing points a project at its chats or a chat at its project. |
| `memories.json`, `reflections/`, other batches | No membership data. There is only one batch; the `.csv` files in the export folder are unrelated product analytics. |
| **Design chats** (`design_chats/`, 3 of them) | The **only** explicit project link anywhere: a `project: {uuid, name}` field. Even so, the `project.uuid` matches no project file, so we join by name. |

So the linkage is missing on **both** sides at once. This is a property of
Claude's export format, not a parsing gap: the membership exists on Anthropic's
servers (you can see the folders in claude.ai), it is simply **not written into
the download**.

### Why this matters

Because there is nothing to read, the app has exactly two honest options:

1. **Don't group anything** — only design chats would ever show a project. Useless.
2. **Infer the groupings** from evidence in the text and metadata, and be honest
   that every inferred link is a *guess*, labelled with its confidence and its
   reasons.

We chose (2). The rest of this document is about doing (2) responsibly.

---

## 3. Why inference has to be careful, not eager

Inference is guessing, and a confident-looking wrong guess is worse than no
guess. So the system is built around four rules that all exist to prevent
false positives:

1. **Never force a chat into a project.** A chat may clearly belong to one,
   probably belong to one, plausibly belong to several (ambiguous), or belong to
   none. The engine preserves all of these outcomes instead of always picking a
   winner. A near-tie between two projects is reported as **ambiguous**; a weak
   best match is reported as **no meaningful relationship** and the chat stays
   unlinked.
2. **Never overwrite a real decision.** A chat you've tagged by hand is
   *confirmed* and is never re-scored. Recommendations are suggestions until you
   confirm them.
3. **Only reconstruct what isn't already known.** A chat that already has a link
   (your tag, a design-chat link, or a name-match) is left alone — see §5.
4. **Always show the evidence.** Every recommendation carries the exact signals
   that produced it and their point contributions, so you can judge it. It is
   never a black box.

---

## 4. How the reconstruction works (the short version)

For every chat with no project yet, the engine:

```
generate candidate projects   (name match, shared terms, or shared entity —
        │                       via an inverted index, never all-pairs)
        ▼
score each candidate           (six weighted signals → 0–100, each keeping
        │                       its evidence)
        ▼
classify by confidence         (floor / margin / decisive-title thresholds)
        ▼
high · medium · ambiguous · none
```

The six signals, strongest first: **name mention** (fuzzy — see §6),
**vocabulary overlap** (TF‑IDF similarity to the project's existing chats),
**shared distinctive identifier** (a product domain, extension id or repo),
project **terminology**, shared **tools/languages**, and **timing**. Exact
weights and thresholds live in the [reference](RELATIONSHIP_ALGORITHM.md).

Project "profiles" (the vocabulary/entity/time fingerprint each chat is scored
against) are built **once** from the chats already known to belong to each
project, and are never modified during scoring — so a guess can never feed itself
back in as evidence.

---

## 5. Why we exclude chats that are already linked

The first version recommended chats for the exact folder they were **already
in** — almost pure noise. The cause: a chat gets auto-linked to a project by
name-match, and the strongest recommendation signal is that *same* name-match, so
it kept "recommending" the project the chat already belonged to.

**Decision:** only chats with *no* association at all (no manual tag, no design
link, no name-match) enter the review queue. Anything already shown inside a
folder is treated as done. This is why the dashboard reports "*N of M unlinked
chats look related*" and how many are "already linked" — the review is
explicitly about the orphans, not the whole archive.

---

## 6. Why exact name-matching wasn't enough — a real case

The motivating failure, straight from the data:

- The project is named **"WhatsApp Customizer"**.
- Every chat about it writes **"WhatsApp *Web* Customizer"** (the product's real
  name), or refers to it by domain (`wwebcustomizer.com`) or its Chrome-extension
  id — but almost never the exact phrase "WhatsApp Customizer".
- One such chat is titled **"Blog Post Generator"** — a name that shares **zero
  words** with the project.

Exact phrase matching therefore scored that chat **0** against the project and
missed roughly **36 chats** that plainly belong to it. That single infixed word,
"Web", was silently breaking the whole cluster.

Two changes fixed it, and each is there for a specific reason:

### 6a. Fuzzy token name-matching — *because product names drift*

A multi-word project name now also matches when its words appear **in order with
a word or two between them**: `whatsapp … customizer` matches "WhatsApp **Web**
Customizer". This recovers the near-misses.

To keep precision, we deliberately **did not** go further and match the words
scattered anywhere in the text — that would link any chat containing "share" and
"contact" to a "ShareMyContact" project. And single-word or ambiguous names
("CV", "Google Search") stay **title-only**, because a lone common word in a
message body is not evidence. Result: WhatsApp Customizer's auto-linked chats
went from ~14 to **36** (matching the independent fingerprint count), and "Blog
Post Generator" now links correctly.

### 6b. Entity fingerprints — *because some chats never name the project*

Some chats discuss the product only by its **domain**, **extension id**, or
**GitHub repo**, never by name. So the engine also scores a shared *distinctive
identifier*. The hard part is telling a real fingerprint (`wwebcustomizer.com`)
from a generic platform (`linkedin.com`, `github.io`, `draw.io`) that everyone
cites and that identifies nothing.

We filter generic identifiers **two ways**, and both were necessary:

- a **curated blocklist** of common platforms, matched on the *registrable*
  domain so `www.linkedin.com` and `web.whatsapp.com` collapse to the base —
  because the first pass leaked exactly these subdomain variants;
- a **corpus-frequency (IDF) cut** — an identifier appearing in more than ~5% of
  chats is treated as generic and dropped — because personal or rare-but-generic
  domains (a portfolio site, `x.com`) slip past any hand-written list.

### 6c. Down-weighting time — *because everything overlaps in time*

Early tuning let "written during the project's active period" contribute ~10
points to nearly every chat, because projects span months and almost any chat
falls inside some project's date range. That inflated weak matches over the line.
Timing is now a low-weight tiebreaker, so a recommendation needs real substance
(name, vocabulary, or a genuine shared identifier), not mere date overlap.

The net effect on the real export: **94** confident auto-links, "Blog Post
Generator" correctly filed and out of the review queue, and only **~4** genuinely
orphaned chats surfaced for review — the small number is the *correct* answer,
because most remaining chats are true one-offs that belong to no project.

---

## 7. What it can and cannot do

**It can:**
- Reconstruct project membership far better than exact matching, tolerating name
  drift and catching chats that only reference a product by domain/id.
- Score each guess by confidence, explain it, and preserve ambiguity instead of
  forcing a choice.
- Let you confirm, reject, or reassign each suggestion, and bulk-confirm the
  high-confidence ones — turning a large archive into something reviewable.
- Do all of this offline, on your machine, with no model or network call.

**It cannot:**
- Recover your **true** Claude folders. They are not in the export. Everything
  outside the 3 design chats is a reconstruction — a strong, explainable guess,
  never ground truth.
- Detect a relationship the text doesn't support. A chat that belongs to a
  project but never names it, shares its vocabulary, or cites a distinctive
  identifier of it is genuinely unrecoverable from this data, and will correctly
  read as "no meaningful relationship".
- Use semantic embeddings — there is no model offline. "Similarity" here is
  lexical (shared distinctive words) plus honest metadata, and the UI never
  implies otherwise.

---

## 8. If Claude's export ever includes membership

If a future export writes a project field onto conversations (or lists a
project's chats), that becomes an **explicit, confirmed** link — exactly like the
design chats today — and should be read directly, with inference used only for
whatever the export still leaves unlinked. The architecture already separates
"confirmed" links from "recommended" ones precisely so that this drop-in is
trivial: real data always wins, guesses fill the gaps.
