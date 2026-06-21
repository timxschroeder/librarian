import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authErr } = await admin.auth.getUser(jwt)
    if (authErr || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const body = await req.json()
    const { mode, message = '', history = [], books: initBooks = [] } = body

    // Load user context (shelf + taste portrait) from DB
    const [profileRes, shelfRes] = await Promise.all([
      admin.from('profiles').select('name, taste_summary').eq('id', user.id).single(),
      admin.from('user_books').select('rating, book:books(title, author)').eq('user_id', user.id),
    ])

    const name = profileRes.data?.name || 'the reader'
    const tasteSummary: string | null = profileRes.data?.taste_summary ?? null
    const shelfLines = (shelfRes.data ?? [])
      .map((ub: { rating: number | null; book: { title: string; author: string | null } }) => {
        const stars = ub.rating ? `★${ub.rating}` : 'unrated'
        return `- ${ub.book.title}${ub.book.author ? ` by ${ub.book.author}` : ''} (${stars})`
      })
      .join('\n')

    const system = buildSystem(name, tasteSummary, shelfLines)

    // ── Initialize taste portrait from loved books ──────────────────────────
    if (mode === 'initialize') {
      const bookList = (initBooks as { title: string; author: string }[])
        .map((b) => `- "${b.title}" by ${b.author}`)
        .join('\n')
      const prompt = `${name} just told me the following books are among their all-time favourites:\n${bookList}\n\nWrite a 2–3 sentence taste portrait in second person ("You…") capturing what their love of these books reveals about their reading values — what they seek in prose, story, character, and ideas. Be specific and insightful, not generic.`
      const portrait = await gemini(system, [{ role: 'user', parts: [{ text: prompt }] }])
      return json({ taste_summary: portrait })
    }

    // ── Structured taste axes (the legible layer) ───────────────────────────
    if (mode === 'profile') {
      const shelf = (shelfRes.data ?? []) as {
        rating: number | null
        book: { title: string; author: string | null }
      }[]
      const totalCount = shelf.length
      const ratingSum = shelf.reduce((s, b) => s + (b.rating ?? 0), 0)
      const signature = `${totalCount}:${ratingSum}`

      // Nothing on the shelf to infer from — persist an explicit empty profile so
      // the UI shows the "still reading you in" state instead of spinning.
      if (totalCount === 0) {
        const empty = emptyAxes(signature)
        await admin.from('profiles').update({ taste_axes: empty }).eq('id', user.id)
        return json({ taste_axes: empty })
      }

      const prompt = `Analyze ${name}'s reading taste from their shelf and portrait above, and place them on a fixed set of taste axes. Judge how they like to READ, not genre.\n\nRespond with ONLY this JSON — no prose before or after:\n{"source_of_reward":{"language":0.0,"story":0.0,"character":0.0,"ideas":0.0},"weight":{"value":0.0,"confidence":0.0},"propulsion":{"value":0.0,"confidence":0.0},"darkness":{"value":0.0,"confidence":0.0},"tone":{"value":0.0,"confidence":0.0}}\n\nsource_of_reward: four shares in 0..1 that SUM TO 1 — what they read FOR. language = the sentences themselves; story = plot/what happens; character = inner life of who it happens to; ideas = concepts/argument.\nThe four bipolar axes take value in -1..1 — weight: -1 effortless .. +1 demanding; propulsion: -1 slow burn .. +1 page-turner; darkness: -1 warm .. +1 bleak; tone: -1 earnest .. +1 playful.\nconfidence is YOUR certainty 0..1 for that axis given how much the shelf actually reveals about it. If the shelf gives little basis for an axis, set a LOW confidence and a near-0 value — do not guess.`

      const raw = await gemini(system, [{ role: 'user', parts: [{ text: prompt }] }], 0.2)
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Malformed taste profile response from model')
      const axes = normalizeAxes(JSON.parse(match[0]), totalCount, signature)
      await admin.from('profiles').update({ taste_axes: axes }).eq('id', user.id)
      return json({ taste_axes: axes })
    }

    // ── Parse a pasted reading list into candidate books ────────────────────
    if (mode === 'parse') {
      const text = String(body.text ?? '').slice(0, 4000)
      if (!text.trim()) return json({ entries: [] })
      const prompt = `${name} pasted a rough list of books they've read — it may be a clean list, reading notes, or half-remembered references. Extract each distinct book as a candidate.\n\nPASTED TEXT:\n${text}\n\nRespond with ONLY this JSON — no prose before or after:\n{"entries":[{"title":"","author":"","confidence":0.0,"source_line":"","series_expanded":false}]}\n\nRules:\n- One entry per distinct book. Resolve vague references ("that new Sally Rooney one") to a real title + author.\n- author: the best-known author's full name, or "" if genuinely unknown.\n- confidence 0..1: your certainty the title+author is correct and unambiguous. Vague or guessed references get LOW confidence.\n- source_line: the exact fragment of the pasted text this entry came from.\n- series_expanded: true ONLY when you inferred the book from a series/author instruction ("all of the Wayfarers books") rather than it being named directly. When expanding a series, include AT MOST 6 books and set series_expanded:true on each.\n- Do not invent books to pad the list, and skip lines that clearly aren't books.`
      const raw = await gemini(system, [{ role: 'user', parts: [{ text: prompt }] }], 0.2, 2048)
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Malformed parse response from model')
      return json(JSON.parse(match[0]))
    }

    // ── Unified librarian turn (default) ────────────────────────────────────
    // One mode: every turn returns a spoken `message` AND a fresh recommendation
    // slate. The librarian leads with books by default; pinned books on the table
    // survive a re-roll. `recommendations: []` only on a pure-conversation turn.
    const table = (body.table ?? []) as SlateBook[]
    const coldStart = !tasteSummary && !shelfLines
    const prompt = `${tableBlock(table)}The reader says: "${message}"\n\n${converseInstructions(coldStart)}`
    const msgs = historyToGemini(history)
    msgs.push({ role: 'user', parts: [{ text: prompt }] })
    const raw = await gemini(system, msgs)
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Malformed librarian response from model')
    const parsed = asRecord(JSON.parse(match[0]))
    return json({
      message: String(parsed.message ?? ''),
      recommendations: normalizeRecs(parsed.recommendations, table),
    })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})

function buildSystem(name: string, tasteSummary: string | null, shelfLines: string): string {
  const portrait = tasteSummary
    ? `TASTE PORTRAIT:\n${tasteSummary}`
    : `You are still getting to know ${name}'s taste. Ask warm, specific questions to understand what they love in books.`
  const shelf = shelfLines
    ? `THEIR SHELF:\n${shelfLines}`
    : 'Their shelf is empty so far.'
  return `You are a personal librarian for ${name}. You know their reading history and taste intimately — you remember their books, draw connections, and ask smart follow-up questions.\n\n${portrait}\n\n${shelf}\n\nEngage warmly and specifically. Keep responses concise (2–4 sentences). Never recommend a book already on their shelf.`
}

function historyToGemini(history: { role: string; content: string }[]) {
  return history.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))
}

interface SlateBook {
  title: string
  author: string
  type: 'comfort' | 'stretch' | 'sure_thing' | null
  reasoning: string
  pinned: boolean
}

function tableBlock(table: SlateBook[]): string {
  if (!table.length) return ''
  const lines = table
    .map((b, i) => `${i + 1}. "${b.title}"${b.author ? ` by ${b.author}` : ''}${b.pinned ? '  [PINNED]' : ''}`)
    .join('\n')
  return `BOOKS CURRENTLY ON THE TABLE (the slate you last offered):\n${lines}\n\n`
}

function converseInstructions(coldStart: boolean): string {
  const base = `Respond with ONLY this JSON — no prose before or after:
{"message":"your warm spoken reply, 1–3 sentences","recommendations":[{"title":"","author":"","type":"comfort","reasoning":"one sentence tied to their specific taste","pinned":false}]}

You are a librarian who ALWAYS has books in hand. Rules:
- By DEFAULT, put 1–3 books on the table that fit what the reader just said. Fewer is honest — don't pad to three when one is the right answer.
- KEEP every book marked [PINNED] in your recommendations exactly as-is (same title and author, pinned: true). Re-roll only the un-pinned ones around it. If the reader's message clearly points at one book on the table ("more like the second one", "the Clarke one"), set pinned: true on it and refresh the others to match its key.
- "type" is optional flavour — comfort: a warm safe bet; stretch: just outside their usual but hits their core values; sure_thing: dead-centre of their taste. Use null when no label fits.
- "reasoning" ties each pick to their specific taste in one sentence.
- Never recommend a book already on their shelf, and never repeat a book on the table unless it's pinned.
- A turn may be pure conversation with NO new books (recommendations: []) ONLY when the reader is clearly being reflective or emotional, or when a single question would resolve a real ambiguity about what to recommend. In that case you MUST end "message" with a warm, specific question that teaches you something about their taste — a question is never a dead end. Otherwise, always return books.`
  if (!coldStart) return base
  return `${base}\n- IMPORTANT: their shelf is empty and you don't know their taste yet, so you have nothing to recommend from. Return recommendations: [] and ask one warm, specific question about a book they've loved.`
}

function clampRecType(t: unknown): SlateBook['type'] {
  return t === 'comfort' || t === 'stretch' || t === 'sure_thing' ? t : null
}

function sameBook(a: { title: string }, b: { title: string }): boolean {
  return a.title.trim().toLowerCase() === b.title.trim().toLowerCase()
}

// Pure-conversation turn (model returned []) → keep it empty; the client leaves the
// existing sticky table untouched. Otherwise coerce the model's slate and enforce the
// core invariant: a pinned book is NEVER dropped or silently un-pinned by a re-roll.
function normalizeRecs(raw: unknown, table: SlateBook[]): SlateBook[] {
  const arr = Array.isArray(raw) ? raw : []
  if (arr.length === 0) return []

  const recs: SlateBook[] = arr
    .map((r) => {
      const o = asRecord(r)
      return {
        title: String(o.title ?? '').trim(),
        author: String(o.author ?? '').trim(),
        type: clampRecType(o.type),
        reasoning: String(o.reasoning ?? '').trim(),
        pinned: Boolean(o.pinned),
      }
    })
    .filter((r) => r.title)

  for (const r of recs) {
    if (table.some((t) => t.pinned && sameBook(t, r))) r.pinned = true
  }
  for (const t of table) {
    if (t.pinned && !recs.some((r) => sameBook(r, t))) recs.unshift({ ...t, pinned: true })
  }
  return recs.slice(0, 3)
}

// Coverage caps confidence by how much shelf evidence exists. A small shelf can't
// justify a confident read, so its axes surface as gaps in the UI rather than
// fake precision. Full confidence is reachable at ~6 books.
function coverageFor(totalCount: number): number {
  return Math.min(1, totalCount / 6)
}

function clampNum(n: unknown, lo: number, hi: number): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return lo
  return Math.max(lo, Math.min(hi, n))
}

function emptyAxes(signature: string) {
  const z = { value: 0, confidence: 0 }
  return {
    source_of_reward: { language: 0.25, story: 0.25, character: 0.25, ideas: 0.25 },
    weight: { ...z },
    propulsion: { ...z },
    darkness: { ...z },
    tone: { ...z },
    signature,
    updated_at: new Date().toISOString(),
  }
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

function normalizeAxes(rawAxes: unknown, totalCount: number, signature: string) {
  const coverage = coverageFor(totalCount)

  const r = asRecord(rawAxes)
  const sr = asRecord(r.source_of_reward)
  const parts = {
    language: clampNum(sr.language, 0, 1),
    story: clampNum(sr.story, 0, 1),
    character: clampNum(sr.character, 0, 1),
    ideas: clampNum(sr.ideas, 0, 1),
  }
  const sum = parts.language + parts.story + parts.character + parts.ideas
  const source_of_reward = sum > 0
    ? {
        language: parts.language / sum,
        story: parts.story / sum,
        character: parts.character / sum,
        ideas: parts.ideas / sum,
      }
    : { language: 0.25, story: 0.25, character: 0.25, ideas: 0.25 }

  const axis = (a: unknown) => {
    const o = asRecord(a)
    return {
      value: clampNum(o.value, -1, 1),
      confidence: clampNum(o.confidence, 0, 1) * coverage,
    }
  }

  return {
    source_of_reward,
    weight: axis(r.weight),
    propulsion: axis(r.propulsion),
    darkness: axis(r.darkness),
    tone: axis(r.tone),
    signature,
    updated_at: new Date().toISOString(),
  }
}

async function gemini(
  systemPrompt: string,
  contents: object[],
  temperature = 0.8,
  maxOutputTokens = 1024,
): Promise<string> {
  const key = Deno.env.get('GOOGLE_API_KEY')
  const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      // gemini-2.5-flash is a thinking model and thinking tokens are drawn from the
      // SAME maxOutputTokens budget as the reply. Left on, a long internal trace
      // eats the budget and the visible answer is truncated mid-sentence — which is
      // exactly what made the 2–3 sentence taste portrait look cut off. None of our
      // prompts need step-by-step reasoning, so disable thinking: full budget for
      // the actual output, and faster responses across the board.
      generationConfig: { temperature, maxOutputTokens, thinkingConfig: { thinkingBudget: 0 } },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
