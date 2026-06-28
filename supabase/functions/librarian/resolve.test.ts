// Deno unit tests for the pure Discover-resolution logic.
//   deno test supabase/functions/librarian/resolve.test.ts
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import {
  isEnglish,
  looksLikeSummary,
  mainTitle,
  pickBestDoc,
  resolveBook,
  type OLDoc,
} from './resolve.ts'

const eng = (over: Partial<OLDoc> = {}): OLDoc => ({
  key: '/works/OL1W',
  title: 'Factfulness',
  language: ['eng'],
  edition_count: 40,
  cover_i: 111,
  ...over,
})

Deno.test('looksLikeSummary flags study-guide cash-ins, not real titles', () => {
  assertEquals(looksLikeSummary('SUMMARY Of Factfulness'), true)
  assertEquals(looksLikeSummary("Jim Collins' GOOD to GREAT Summary"), true)
  assertEquals(looksLikeSummary('Workbook: Atomic Habits'), true)
  assertEquals(looksLikeSummary('Key Takeaways from Sapiens'), true)
  assertEquals(looksLikeSummary('Factfulness'), false)
  assertEquals(looksLikeSummary('A Study in Scarlet'), false) // "study" not "study guide"
  assertEquals(looksLikeSummary(undefined), false)
})

Deno.test('isEnglish requires the eng MARC tag', () => {
  assertEquals(isEnglish(eng()), true)
  assertEquals(isEnglish({ language: ['ger'] }), false)
  assertEquals(isEnglish({ language: [] }), false)
  assertEquals(isEnglish({}), false)
})

Deno.test('pickBestDoc drops summary knockoffs ranked first', () => {
  const docs: OLDoc[] = [
    { key: '/works/OLsum', title: 'SUMMARY Of Factfulness', language: ['eng'], edition_count: 3 },
    eng(),
  ]
  assertEquals(pickBestDoc(docs, { title: 'Factfulness' })?.key, '/works/OL1W')
})

Deno.test('pickBestDoc keeps summaries when the rec asked for one', () => {
  const docs: OLDoc[] = [
    { key: '/works/OLsum', title: 'SUMMARY Of Factfulness', language: ['eng'], edition_count: 3 },
  ]
  assertEquals(pickBestDoc(docs, { title: 'Summary of Factfulness' })?.key, '/works/OLsum')
})

Deno.test('pickBestDoc prefers the English edition over a foreign one', () => {
  const docs: OLDoc[] = [
    { key: '/works/OLde', title: '... Trotzdem Ja zum Leben sagen', language: ['ger'], edition_count: 50 },
    eng({ key: '/works/OLen', title: "Man's Search for Meaning" }),
  ]
  assertEquals(pickBestDoc(docs, { title: "Man's Search for Meaning" })?.key, '/works/OLen')
})

Deno.test('pickBestDoc returns null when every doc is tagged non-English', () => {
  const docs: OLDoc[] = [
    { key: '/works/OLde', title: 'Foreign edition', language: ['ger'] },
    { key: '/works/OLit', title: 'Edizione italiana', language: ['ita'] },
  ]
  assertEquals(pickBestDoc(docs, { title: 'Some Book' }), null)
})

Deno.test('pickBestDoc falls back to untagged docs (missing tag != foreign)', () => {
  const docs: OLDoc[] = [
    { key: '/works/OLuntagged', title: 'Real Book', edition_count: 12, cover_i: 9 },
  ]
  assertEquals(pickBestDoc(docs, { title: 'Real Book' })?.key, '/works/OLuntagged')
})

Deno.test('pickBestDoc ranks English docs by edition_count then cover', () => {
  const docs: OLDoc[] = [
    eng({ key: '/works/OLa', edition_count: 5, cover_i: undefined }),
    eng({ key: '/works/OLb', edition_count: 30, cover_i: 222 }),
    eng({ key: '/works/OLc', edition_count: 30, cover_i: undefined }),
  ]
  // OLb and OLc tie on editions; OLb wins on having a cover.
  assertEquals(pickBestDoc(docs, { title: 'x' })?.key, '/works/OLb')
})

Deno.test('pickBestDoc returns null on no docs', () => {
  assertEquals(pickBestDoc([], { title: 'x' }), null)
})

Deno.test('mainTitle strips the subtitle after the first colon', () => {
  assertEquals(mainTitle('Life 3.0: Being Human in the Age of Artificial Intelligence'), 'Life 3.0')
  assertEquals(mainTitle('Sapiens: A Brief History of Humankind'), 'Sapiens')
  assertEquals(mainTitle('Atomic Habits'), 'Atomic Habits')
  assertEquals(mainTitle('  Educated : A Memoir '), 'Educated')
  assertEquals(mainTitle(': only a subtitle'), ': only a subtitle') // empty head -> keep original
  assertEquals(mainTitle(undefined), '')
})

// --- resolveBook network behaviour, with fetch stubbed ----------------------------------

interface FakeDocs {
  [substringOfUrl: string]: OLDoc[]
}

// Stub global fetch: return the OL docs whose key substring matches the requested URL.
// Records every requested URL so tests can assert which query ran. The first matching key
// wins, so order keys most-specific-first.
function stubFetch(byUrl: FakeDocs): { urls: string[]; restore: () => void } {
  const urls: string[] = []
  const orig = globalThis.fetch
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = String(input)
    urls.push(url)
    const hit = Object.entries(byUrl).find(([frag]) => url.includes(frag))
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ docs: hit ? hit[1] : [] }),
    } as Response)
  }) as typeof fetch
  return { urls, restore: () => { globalThis.fetch = orig } }
}

const realLife30: OLDoc = {
  key: '/works/OL17091839W',
  title: 'Life 3.0',
  author_name: ['Max Tegmark'],
  language: ['eng'],
  edition_count: 8,
  cover_i: 8902916,
}

const lifeSummaries: OLDoc[] = [
  { key: '/works/OLs1', title: "Summary of Max Tegmark's Life 3.0", author_name: ['Irb Media'], language: ['eng'], edition_count: 1 },
  { key: '/works/OLs2', title: 'Summary and Analysis of Life 3. 0', author_name: ['Acesprint'], language: ['eng'], edition_count: 1 },
]

Deno.test('resolveBook beats summary mills via the fielded author query', async () => {
  // Free-text q= returns only mills (the real-world failure); fielded author= returns the
  // genuine work. The fielded pass must win and the mills must never be surfaced.
  const { urls, restore } = stubFetch({ 'author=': [realLife30], 'q=': lifeSummaries })
  try {
    const book = await resolveBook({
      title: 'Life 3.0: Being Human in the Age of Artificial Intelligence',
      author: 'Max Tegmark',
    })
    assertEquals(book?.id, 'OL17091839W')
    assertEquals(book?.title, 'Life 3.0')
    // Fielded pass ran first with the subtitle stripped, and short-circuited the q= pass.
    assertEquals(urls.length, 1)
    assertEquals(urls[0].includes('title=Life%203.0&author=Max%20Tegmark'), true)
    assertEquals(urls[0].includes('Being%20Human'), false)
  } finally {
    restore()
  }
})

Deno.test('resolveBook falls back to free-text q= when the fielded pass is empty', async () => {
  // e.g. the model's author spelling differs from OL's, so fielded returns nothing.
  const { urls, restore } = stubFetch({ 'q=': [realLife30] }) // 'author=' fielded -> []
  try {
    const book = await resolveBook({ title: 'Life 3.0', author: 'M. Tegmark' })
    assertEquals(book?.id, 'OL17091839W')
    assertEquals(urls.length, 2) // fielded (empty) then q= fallback
    assertEquals(urls[1].includes('q='), true)
  } finally {
    restore()
  }
})

Deno.test('resolveBook skips the fielded pass when the rec has no author', async () => {
  const { urls, restore } = stubFetch({ 'q=': [realLife30] })
  try {
    const book = await resolveBook({ title: 'Life 3.0' })
    assertEquals(book?.id, 'OL17091839W')
    assertEquals(urls.length, 1)
    assertEquals(urls[0].includes('author='), false)
    assertEquals(urls[0].includes('q='), true)
  } finally {
    restore()
  }
})

Deno.test('resolveBook returns null when nothing resolves', async () => {
  const { restore } = stubFetch({}) // every query -> no docs
  try {
    assertEquals(await resolveBook({ title: 'Nonexistent', author: 'Nobody' }), null)
  } finally {
    restore()
  }
})

Deno.test('resolveBook returns null on a blank title without fetching', async () => {
  const { urls, restore } = stubFetch({ 'q=': [realLife30] })
  try {
    assertEquals(await resolveBook({ title: '   ', author: 'x' }), null)
    assertEquals(urls.length, 0)
  } finally {
    restore()
  }
})
