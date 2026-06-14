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

    // ── Recommendation slate ────────────────────────────────────────────────
    if (mode === 'recommend') {
      const moodLine = message.trim() ? `The reader says: "${message}"\n\n` : ''
      const prompt = `${moodLine}Recommend exactly 3 books. Respond with ONLY the following JSON — no prose before or after:\n{"intro":"one warm sentence","recommendations":[{"title":"","author":"","type":"comfort","reasoning":"one sentence tied to their specific taste"},{"title":"","author":"","type":"stretch","reasoning":""},{"title":"","author":"","type":"sure_thing","reasoning":""}]}\n\ntype meanings — comfort: a warm safe bet they'll reliably love; stretch: slightly outside their usual but hits their core values; sure_thing: straight down the middle of their taste. Never recommend a book already on their shelf.`
      const msgs = historyToGemini(history)
      msgs.push({ role: 'user', parts: [{ text: prompt }] })
      const raw = await gemini(system, msgs)
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Malformed recommendation response from model')
      return json(JSON.parse(match[0]))
    }

    // ── Conversational chat (default) ───────────────────────────────────────
    const msgs = historyToGemini(history)
    msgs.push({ role: 'user', parts: [{ text: message }] })
    const response = await gemini(system, msgs)

    // Every 10 assistant turns, refresh the taste portrait
    let taste_summary_update: string | null = null
    const assistantTurns = history.filter((m: { role: string }) => m.role === 'assistant').length
    if (assistantTurns > 0 && assistantTurns % 10 === 0 && tasteSummary) {
      const updatePrompt = `Based on this conversation, write an updated 2–3 sentence taste portrait for ${name} in second person. Current portrait: "${tasteSummary}". Refine it with any new insight from the conversation.`
      taste_summary_update = await gemini(system, [{ role: 'user', parts: [{ text: updatePrompt }] }])
    }

    return json({ message: response, taste_summary_update })
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

async function gemini(systemPrompt: string, contents: object[]): Promise<string> {
  const key = Deno.env.get('GOOGLE_API_KEY')
  const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
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
