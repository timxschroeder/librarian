// Regenerates src/data/curatedBooks.generated.ts from Open Library.
//
// For each onboarding genre we pull the most *read* books (sort=readinglog —
// real reader-popularity, not most-published, so we get recognizable modern
// titles rather than a wall of public-domain classics), keep only English/German
// editions with a cover, dedupe shared works, and tag books that appear under
// several genres with all of them. Work-key ids match books added via search /
// Discover, so onboarding picks dedupe against the rest of the cache.
//
//   PATH=/opt/homebrew/bin:$PATH node scripts/generate-onboarding-books.mjs

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PER_GENRE = 32
const FETCH_LIMIT = 120 // over-fetch so filtering still leaves PER_GENRE
const ALLOWED_LANGUAGES = new Set(['eng', 'ger'])

// genre key -> Open Library subject query. Some genres pull from more than one
// subject; results are merged in popularity order.
const GENRE_SUBJECTS = {
  literary: ['literary fiction', 'fiction'],
  romance: ['romance', 'love stories'],
  mystery: ['mystery', 'thriller'],
  scifi: ['science fiction'],
  fantasy: ['fantasy'],
  historical: ['historical fiction'],
  horror: ['horror'],
  classics: ['classics', 'classic literature'],
  biography: ['biography', 'memoir'],
  history: ['history'],
  science: ['science', 'nature'],
  philosophy: ['philosophy'],
  essays: ['essays'],
  poetry: ['poetry'],
  selfhelp: ['self-help', 'psychology'],
  humor: ['humor'],
  business: ['business', 'economics'],
  tech: ['technology', 'computers'],
  religion: ['religion', 'spirituality'],
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const normalizeTitle = (title) =>
  title
    .toLowerCase()
    .split(/[:–—]| - /)[0]
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const dedupeKey = (doc) =>
  `${normalizeTitle(doc.title)}::${(doc.author_name?.[0] ?? '').toLowerCase()}`

// search.json returns a work's *canonical* (often original-language) title, so a
// Russian or Japanese classic with English editions still shows its native title.
// For any non-ASCII title, resolve the English (then German) edition title instead.
const isAscii = (s) => /^[\x20-\x7E]*$/.test(s)

async function resolveLatinTitle(workId, fallback) {
  if (isAscii(fallback)) return fallback
  try {
    const res = await fetch(`https://openlibrary.org/works/${workId}/editions.json?limit=50`)
    await sleep(150)
    if (!res.ok) return null
    const entries = (await res.json()).entries ?? []
    const titleIn = (lang) =>
      entries.find(
        (e) => e.title && isAscii(e.title) && (e.languages ?? []).some((l) => l.key === `/languages/${lang}`),
      )?.title
    return titleIn('eng') ?? titleIn('ger') ?? null
  } catch {
    return null
  }
}

async function fetchSubject(subject) {
  const url =
    `https://openlibrary.org/search.json?q=${encodeURIComponent(`subject:"${subject}"`)}` +
    `&sort=readinglog&limit=${FETCH_LIMIT}` +
    `&fields=key,title,author_name,cover_i,language,readinglog_count`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OL search failed for "${subject}": ${res.status}`)
  const data = await res.json()
  return data.docs ?? []
}

function usable(doc) {
  if (!doc.cover_i || !doc.title || !doc.author_name?.[0]) return false
  if (!doc.language?.length) return false // untagged language => translation noise
  return doc.language.some((c) => ALLOWED_LANGUAGES.has(c))
}

async function main() {
  // work key -> { id, title, author, coverId, genres:Set, reads }
  const byWork = new Map()

  for (const [genre, subjects] of Object.entries(GENRE_SUBJECTS)) {
    const seenInGenre = new Set()
    let kept = 0
    for (const subject of subjects) {
      if (kept >= PER_GENRE) break
      const docs = await fetchSubject(subject)
      await sleep(250) // be gentle to Open Library
      for (const doc of docs) {
        if (kept >= PER_GENRE) break
        if (!usable(doc)) continue
        const dk = dedupeKey(doc)
        if (seenInGenre.has(dk)) continue
        const id = doc.key.replace('/works/', '')
        const existing = byWork.get(id)
        if (existing) {
          existing.genres.add(genre)
          seenInGenre.add(dk)
          kept++
          continue
        }
        const title = await resolveLatinTitle(id, doc.title)
        if (!title) continue // non-Latin work with no English/German edition title
        seenInGenre.add(dk)
        byWork.set(id, {
          id,
          title,
          author: doc.author_name[0],
          coverId: doc.cover_i,
          genres: new Set([genre]),
          reads: doc.readinglog_count ?? 0,
        })
        kept++
      }
    }
    console.log(`${genre.padEnd(12)} ${kept} books`)
  }

  // Stable order: most-read first, so the All view leads with the biggest titles.
  const books = [...byWork.values()]
    .sort((a, b) => b.reads - a.reads)
    .map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      coverId: b.coverId,
      genres: [...b.genres],
    }))

  const header =
    '// AUTO-GENERATED by scripts/generate-onboarding-books.mjs — do not edit by hand.\n' +
    `// ${books.length} books, regenerated ${new Date().toISOString().slice(0, 10)}.\n` +
    "import type { CuratedBook } from './onboardingBooks'\n\n" +
    'export const CURATED_BOOKS: CuratedBook[] = [\n'
  const body = books
    .map(
      (b) =>
        `  { id: ${JSON.stringify(b.id)}, title: ${JSON.stringify(b.title)}, ` +
        `author: ${JSON.stringify(b.author)}, coverId: ${b.coverId}, ` +
        `genres: ${JSON.stringify(b.genres)} },`,
    )
    .join('\n')
  const out = `${header}${body}\n]\n`

  const dest = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'curatedBooks.generated.ts')
  writeFileSync(dest, out)
  console.log(`\nWrote ${books.length} books to ${dest}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
