# Librarian — Product Direction

> Status: living draft. Captured from a brainstorming session on 2026-06-14.
> Scope: the two of us (Tim + partner). No scale, no growth, no public access.
> **Hard constraint — strict data isolation:** each user's profile, shelf, reactions,
> and taste model are fully private. **Never share data between users.** "Private" here
> means *not public on the internet* — it does **not** mean the two users share anything.
> Two isolated single-player experiences that happen to live behind the same login wall.

## The one-line vision

Not a recommender system — **a personal librarian**: someone who knows everything
you've read and how you felt about it, understands what you're in the mood for *now*,
and hands you a small set of books with a reason.

## Why this isn't a recommender system

Recommender systems (Netflix, Goodreads, Amazon) are built for **scale** — they work
because "people like you also liked X." We have **N=2**. Collaborative filtering is off
the table, and that's a gift: it forces *depth on two people* instead of breadth across
millions. The product to build is a knowledgeable friend, not a ranking engine.

The competitor isn't "a clever algorithm." It's how we find books today: wandering
bookshops, blogs of people we trust (e.g. Bill Gates), and new books by authors we love.
Notice those are all **trust signals and author loyalty**, not content matching. The bar
to clear is "a friend who knows your taste." (Trusted *external* curators like Bill Gates
can still inform recommendations — but the other app user is **not** one of them. No
cross-user signal, ever.)

## What "a good recommendation" means here

Optimize for, in order:
1. **Reliable love** — books we'll genuinely enjoy (high hit-rate).
2. **Stretch** — books slightly outside our usual that still hit what we value.
3. **Right-for-now** — fits the current mood.

Explicitly *not* optimizing for **obscurity/discovery**. We don't need deep cuts.

Key reframe: **mood is not a third goal — it's the dispatcher.** Comfort (1) and stretch
(2) are in direct tension; mood is what decides which lever to pull tonight.

> Mood (now) → selects strategy → comfort *or* stretch → drawn from taste (history).

## The taste model

### Taste ≠ genre
Genre is a costume. The stable thing about a reader is the **dimensions they value**,
which *project onto* different genres depending on mood. So we model values, never
genres. Genre is an *output* ("by the way, this is sci-fi"), never an input.

### The 5 axes (aiming for MECE)

**Axis 1 — Source of reward** *(a composition, not a slider — what you read *for*)*
- **Language** — the sentences themselves
- **Story** — what happens / plot
- **Character** — who it happens to / inner life
- **Ideas** — concepts, argument, how it makes you think

A reader has an *appetite distribution* across these four. ("I read for language and
ideas, don't care about plot" is a complete taste statement.)

**Then four independent sliders, each orthogonal to the above and to each other:**
2. **Weight** — effortless ↔ demanding (cognitive load, regardless of *where* reward comes from)
3. **Propulsion** — slow burn ↔ page-turner (pace of pull)
4. **Darkness** — warm/comforting ↔ bleak/unsettling (emotional register)
5. **Tone** — earnest ↔ playful (independent of Darkness — this is what lets "dark comedy" exist)

The split between *Source of reward = Ideas* and *Weight* is deliberate: Gladwell is
ideas-rich but effortless; a philosophy text is ideas-rich and grueling.

### Each axis carries two values
- A **stable preferred range** (taste) — e.g. on *Darkness*, "moderate-to-dark, allergic to saccharine." Rarely changes.
- A **mood target for tonight** (state) — within that range, where you want to sit right now.

> A recommendation = where your stable range and tonight's mood point overlap.

## Architecture: two layers

- **Latent layer (drives the actual recommendations).** Rich embeddings of each book
  *fused with our reactions*. Fuzzy, high-dimensional, no human-readable names. This is
  what *picks* the book. Goal is best recs — the user does **not** need to follow the reasoning.
- **Legible layer (drives trust + control).** The 5 axes **plus a natural-language taste
  portrait** the librarian writes and maintains (this is `profiles.taste_summary`, which
  already exists). It *explains* picks after the fact and gives a *steering wheel*
  ("lighter tonight," "more like this"). It is a **projection** of the latent space, not its substrate.

## Capturing taste without homework

The thing that makes this newly possible: **pre-LLM, capturing "why" meant forms and
tags (homework). Post-LLM, you say one sentence of natural reaction and the model does
the structuring.**

Two principles:
- **You only supply the *delta*.** The LLM already knows the book; you describe only your
  *reaction* to it. ~8 words of human effort → a full placement on all axes.
- **The capture mechanism IS the librarian.** Not a logging form — a 60-second debrief
  conversation with a smart follow-up ("most people love that ending — was it the pacing?").
  The same chat surface does capture *and* recommendation.

### Shelf-membership vs reaction-depth (resolving a real tension)
We want a *complete* catalog of books read, but we *don't* want to comment on every book.
Resolve by splitting the two:
- **On the shelf** = a `user_books` row with just `book_id`. Cheap, and we *do* want this
  complete (powers dedup + the historic picture).
- **Reaction** = `rating`/`notes` + whatever the librarian extracts from chat. Rich,
  **sparse, optional.** Empty is fine.

> Rule: every book you read gets on the shelf; only the ones you feel like talking about get a soul.

The librarian is **agentic about its blind spots** — instead of nagging, it occasionally
probes what it doesn't know ("I have no idea if you like funny books — do you?").

## Recommendation delivery: a mood-spanning slate

Not one book (brittle — you may have read it or it misses), not a wall of 20 (Goodreads).
**A tight slate of ~3, each with a one-line reason, spanning the mood axis:**

- 🛋 **Comfort** — sink right into this
- 🌶 **Stretch** — outside your usual, but hits everything you love about [axis]
- 📚 **Sure thing** — straight down the middle of your taste

We don't have to *ask* the mood — the user reveals it by which one they reach for, and
that click is itself logged signal. This is how the multi-book requirement *resolves* the
comfort-vs-stretch tension.

## The everyday loop (deliberately minimal)

**No engagement machinery.** No notifications, no alerts, no finish-time nudges, no
author-release pings, no retention loops. Two motivated users on their own app will come
back when they want a book — there is no retention problem to solve, and building for one
would be over-engineering. **Pure user-initiated pull.**

The whole loop:

1. You want a book → open the app.
2. The librarian generates a **fresh** mood-spanning slate (recomputed live, never a stored queue).
3. You pick one (the pick logs an implicit mood signal).
4. *Optionally*, when you finish and feel like it, a short debrief — sparse and never required.

That's it. Everything else is a complication we are choosing not to add "for now."

## Onboarding (simplified)

1. Pick **5 books you loved** (the touchstones the librarian needs).
2. Optionally tap 2–3 genres to seed direction.
3. Drop into the conversation.

Skip ratings and "books you hated" at signup — those emerge in chat.

## What's already in the schema (we're ahead of where we thought)

- `user_books (user_id, book_id, rating, notes, read_at)` — the **read-catalog**. Already exists.
- `profiles.taste_summary` — the **natural-language taste portrait**. Field already exists.
- `recommendations (book_id, reasoning, status, feedback)` — the librarian's **loop**
  (pick → reason → did-it-land). Already scaffolded.
- `books (… description, subjects, …)` — cached book metadata (Open Library).

The work is making these three sing, not new tables.

## Quick win, straight from real behavior

**"Authors you love → books of theirs you haven't read."** Cross 5-star authors against
the catalog, subtract the shelf. Zero AI, high hit-rate, mirrors how we already hunt.

## Book grounding for recent/unknown titles (decided)

The LLM's "book half" of the delta is great for canonical titles but weak on new releases —
exactly the "new books by authors we like" case. Resolution:

- **Blurbs are marketing.** A publisher description is fine for *what a book is about*
  (Story/Darkness/Tone/Ideas) but useless and biased on *how it reads*
  (Voice/Weight/Propulsion — every blurb claims "unputdownable"). Reviews are where the
  how-it-reads signal actually lives.
- **Sources:** **Google Books API** for descriptions (richer than Open Library, free, no
  key, includes an average rating). **Live web search at recommendation time** ("`<title>`
  review") for the how-it-reads signal — fires only for recent/low-confidence titles.
  *Not* Open Library for this — its search returns no description (we hard-code `null`
  today) and it has no review text.
- **Confidence is explicit.** Canonical book → use model knowledge. Recent/unknown →
  fetch + read reviews → recommend *with an honest hedge* ("reviews peg this as a slow
  burn"), or hold it back if signal is too thin. The hedge is a librarian feature, not a failure.

## Open risks / unknowns
- **Cold-start first session** feeling like a quiz, not a conversation. (Deprioritized:
  we're patient users.)
- **RLS contradicts the isolation rule.** Current `user_books` policy lets *all*
  authenticated users read each other's rows (CLAUDE.md: "partners see each other's
  shelves"). Per the strict-isolation constraint this must be tightened to owner-only.
  Action item for the code track — do not preserve cross-user read access.

## Deliberately set aside (for now)

- Obscurity/discovery as a goal.
- Trust-earning launch choreography (safe first pick vs. proving-stretch). N=2, patient.
- Any social/growth/public features.
- **All engagement machinery** — notifications, alerts, nudges, retention loops.
- **Bookshop "vet this book" mode** — interesting, but a complication for later, not now.
