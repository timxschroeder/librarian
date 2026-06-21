import type { UserBook } from '../types'

/**
 * A cheap fingerprint of the shelf's state — book count plus the sum of ratings.
 * Both the taste profile (`taste_axes`) and the Discover slate (`discover_slate`)
 * stamp this on what they compute so the client can tell when the shelf has changed
 * (a book added, removed, or re-rated) and a recompute is due. Same string format on
 * both so the two stay in lockstep.
 */
export function shelfSignature(books: UserBook[]): string {
  const ratingSum = books.reduce((s, b) => s + (b.rating ?? 0), 0)
  return `${books.length}:${ratingSum}`
}
