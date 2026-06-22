// Deno unit tests for the pure Discover-resolution logic.
//   deno test supabase/functions/librarian/resolve.test.ts
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { isEnglish, looksLikeSummary, pickBestDoc, type OLDoc } from './resolve.ts'

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
