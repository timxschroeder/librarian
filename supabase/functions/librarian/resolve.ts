// Resolving a model-named recommendation to a real Open Library work for the Discover
// slate. Open Library's relevance ranking routinely floats junk to the top for a bare
// "title author" query — study-guide cash-ins ("SUMMARY Of Factfulness", "Jim Collins'
// GOOD to GREAT Summary") and foreign-language editions of an English title. Worse, for
// some titles the real work is *absent* from the free-text results entirely: q="Life 3.0
// Max Tegmark" returns only summary-mill knockoffs, because the mills embed the real
// author in their *title* ("Summary of Max Tegmark's Life 3.0") and so out-match the
// genuine work, whose author lives in a separate field. Taking docs[0] surfaces the junk;
// filtering the junk out then leaves nothing and the book silently vanishes.
//
// resolveBook therefore queries Open Library's *fielded* search first (title=…&author=…):
// a mill can fake the title but not the author (it publishes under its own imprint), so
// the fielded author constraint excludes the whole class. The model-supplied title is
// reduced to its main title (subtitle stripped) because fielded `title=` matches the
// catalogued main title and a stray subtitle zeroes the match. A free-text `q=` pass is
// kept as a fallback for recs with no author or an author spelling OL doesn't share.
//
// The fetch lives in resolveBook; the decision (pickBestDoc) is pure so it can be
// unit-tested without the network — see resolve.test.ts.

/** Open Library search doc — only the fields we request in `fields=`. */
export interface OLDoc {
  key?: string
  title?: string
  author_name?: string[]
  cover_i?: number
  first_publish_year?: number
  language?: string[]
  edition_count?: number
}

export interface RawPick {
  title?: string
  author?: string
  reasoning?: string
}

export interface DiscoverBook {
  id: string
  title: string
  author: string | null
  cover_url: string | null
  first_publish_year: number | null
  reasoning: string
}

// Titles of summary / study-guide / workbook cash-ins that impersonate the real book on
// Open Library. Dropped unless the recommendation itself asked for a summary/guide.
const SUMMARY_MARKERS =
  /\b(summary|study guide|analysis|workbook|key takeaways|conversation starters)\b/i

export function looksLikeSummary(title: string | undefined): boolean {
  return Boolean(title) && SUMMARY_MARKERS.test(title as string)
}

// A work's identity lives in its main title, before any subtitle. Open Library's fielded
// `title=` search matches the catalogued main title, so passing the model's full title
// ("Life 3.0: Being Human in the Age of Artificial Intelligence") returns zero hits while
// the bare "Life 3.0" returns the work. Take everything before the first colon; if that is
// empty (title starts with a colon) keep the original.
export function mainTitle(title: string | undefined): string {
  const trimmed = (title ?? '').trim()
  const head = trimmed.split(':')[0].trim()
  return head || trimmed
}

// MARC 'eng'. Open Library aggregates languages across a work's editions, so a work with
// any English edition carries 'eng', while a foreign-only work (e.g. the German edition
// "Trotzdem Ja zum Leben sagen" catalogued as its own work) does not. Mirrors
// inAllowedLanguage in src/lib/openLibrary.ts, narrowed to English for Discover.
export function isEnglish(doc: OLDoc): boolean {
  return Array.isArray(doc.language) && doc.language.includes('eng')
}

function hasLanguage(doc: OLDoc): boolean {
  return Array.isArray(doc.language) && doc.language.length > 0
}

// Most-published-then-has-cover ordering. JS sort is stable, so docs of equal rank keep
// Open Library's original relevance order.
function rank(a: OLDoc, b: OLDoc): number {
  const byEditions = (b.edition_count ?? 0) - (a.edition_count ?? 0)
  if (byEditions !== 0) return byEditions
  return (b.cover_i ? 1 : 0) - (a.cover_i ? 1 : 0)
}

/**
 * Pick the best Open Library doc for a recommendation, or null when none is good.
 * - Drops summary/study-guide knockoffs — unless the rec itself asked for one.
 * - Prefers an English edition. If docs are language-tagged but none is English, returns
 *   null rather than surface a foreign edition.
 * - Falls back to untagged docs (real books occasionally lack a language tag) so a
 *   missing tag never blanks an otherwise-good pick.
 * - Among eligible docs, ranks by edition_count, then cover presence.
 */
export function pickBestDoc(docs: OLDoc[], rec: RawPick): OLDoc | null {
  const wantsSummary = looksLikeSummary(rec.title)
  const candidates = docs.filter(
    (d) => d?.key && (wantsSummary || !looksLikeSummary(d.title)),
  )
  if (candidates.length === 0) return null

  const english = candidates.filter(isEnglish)
  // Prefer English; otherwise fall back to untagged (resilient), but never to a doc that
  // is positively tagged as some other language.
  const pool = english.length ? english : candidates.filter((d) => !hasLanguage(d))
  if (pool.length === 0) return null

  return pool.slice().sort(rank)[0]
}

// limit=10 (not 1) gives pickBestDoc room to skip junk top hits and choose the
// most-published English edition; `language`/`edition_count` drive that ranking.
const SEARCH_BASE =
  'https://openlibrary.org/search.json?limit=10' +
  '&fields=key,title,author_name,cover_i,first_publish_year,language,edition_count'

async function searchDocs(url: string): Promise<OLDoc[]> {
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.docs ?? []) as OLDoc[]
}

function toDiscoverBook(doc: OLDoc, rec: RawPick): DiscoverBook {
  return {
    id: (doc.key as string).replace('/works/', ''),
    title: doc.title ?? rec.title ?? '',
    author: doc.author_name?.[0] ?? rec.author ?? null,
    cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    first_publish_year: doc.first_publish_year ?? null,
    reasoning: rec.reasoning ?? '',
  }
}

// Resolve a model-named title+author to a real Open Library work (id + cover), so the
// Discover slate stores everything the client needs to render and to add to the shelf.
// Returns null when there's no confident match — the caller drops it.
export async function resolveBook(rec: RawPick): Promise<DiscoverBook | null> {
  const title = (rec.title ?? '').trim()
  if (!title) return null
  const author = (rec.author ?? '').trim()
  try {
    // Fielded title+author first: the author constraint excludes summary mills (they
    // publish under their own imprint, not the real author), which a free-text query
    // cannot. Strip the subtitle so a model-supplied subtitle doesn't zero the match.
    // Skip when there's no author to constrain on — bare fielded title can't beat mills.
    if (author) {
      const fielded =
        `${SEARCH_BASE}&title=${encodeURIComponent(mainTitle(title))}` +
        `&author=${encodeURIComponent(author)}`
      const doc = pickBestDoc(await searchDocs(fielded), rec)
      if (doc?.key) return toDiscoverBook(doc, rec)
    }
    // Fallback: free-text over the full title+author. Catches works whose author tag
    // varies from the model's spelling, and recs with no author for the fielded pass.
    const q = `${title} ${author}`.trim()
    const doc = pickBestDoc(await searchDocs(`${SEARCH_BASE}&q=${encodeURIComponent(q)}`), rec)
    return doc?.key ? toDiscoverBook(doc, rec) : null
  } catch {
    return null
  }
}
