import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'No Anthropic API key configured. Go to Settings to see how to add it.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }

  const { userId, prompt } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const [{ data: userBooks }, { data: rejected }, { data: pending }] = await Promise.all([
    supabase
      .from('user_books')
      .select('rating, notes, book:books(title, author, subjects)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('recommendations')
      .select('book:books(title, author)')
      .eq('user_id', userId)
      .eq('status', 'rejected'),
    supabase
      .from('recommendations')
      .select('book:books(title, author)')
      .eq('user_id', userId)
      .eq('status', 'pending'),
  ])

  const readList = (userBooks ?? [])
    .map((ub: Record<string, unknown>) => {
      const b = ub.book as Record<string, unknown>
      const rating = ub.rating ? ` (rated ${ub.rating}/5)` : ''
      const notes = ub.notes ? ` — "${ub.notes}"` : ''
      return `- ${b.title} by ${b.author ?? 'Unknown'}${rating}${notes}`
    })
    .join('\n')

  const rejectedTitles = (rejected ?? [])
    .map((r: Record<string, unknown>) => {
      const b = r.book as Record<string, unknown>
      return `- ${b.title} by ${b.author ?? 'Unknown'}`
    })
    .join('\n')

  const pendingTitles = (pending ?? [])
    .map((p: Record<string, unknown>) => {
      const b = p.book as Record<string, unknown>
      return `- ${b.title} by ${b.author ?? 'Unknown'}`
    })
    .join('\n')

  const systemPrompt = `You are a warm, knowledgeable book recommender. You give thoughtful, personal recommendations based on a reader's history.

Return ONLY a valid JSON array of 3-5 books. Each object must have exactly these keys:
- "title": the exact book title
- "author": the author's full name
- "reasoning": 1-2 warm, specific sentences explaining why this reader will love this book

Do not suggest books already in their read list, pending queue, or rejected list.
Output only the JSON array — no markdown, no explanation, no extra text.`

  const userMessage = [
    'Here are the books I have read:',
    readList || '(none yet)',
    rejectedTitles ? `\nBooks I have rejected — do not suggest:\n${rejectedTitles}` : '',
    pendingTitles ? `\nAlready in my queue — do not suggest:\n${pendingTitles}` : '',
    prompt ? `\nMy specific request: ${prompt}` : '\nPlease recommend books based on my taste.',
  ].filter(Boolean).join('\n')

  const anthropic = new Anthropic({ apiKey })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  let recommendations: Array<{ title: string; author: string; reasoning: string }>
  try {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    recommendations = JSON.parse(jsonMatch?.[0] ?? rawText)
  } catch {
    return new Response(
      JSON.stringify({ error: 'Could not parse AI response. Please try again.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }

  let count = 0
  for (const rec of recommendations) {
    try {
      const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(`${rec.title} ${rec.author}`)}&limit=1&fields=key,title,author_name,cover_i,first_publish_year,subject,isbn`
      const res = await fetch(searchUrl)
      const data = await res.json()
      const book = data.docs?.[0]
      if (!book) continue

      const bookId = (book.key as string).replace('/works/', '')
      const bookData = {
        id: bookId,
        title: book.title as string,
        author: (book.author_name as string[])?.[0] ?? rec.author,
        cover_url: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : null,
        description: null,
        first_publish_year: (book.first_publish_year as number) ?? null,
        subjects: ((book.subject as string[]) ?? []).slice(0, 10),
        isbn: (book.isbn as string[])?.[0] ?? null,
      }

      await supabase.from('books').upsert(bookData, { onConflict: 'id' })
      await supabase.from('recommendations').insert({
        user_id: userId,
        book_id: bookId,
        reasoning: rec.reasoning,
        prompt: prompt ?? null,
        status: 'pending',
      })
      count++
    } catch {
      continue
    }
  }

  return new Response(
    JSON.stringify({ count }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
