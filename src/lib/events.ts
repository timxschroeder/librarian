import { logAppEvent } from './db'

// Client-side behavioural analytics. Routes product events (onboarding steps, books
// added, imports, refreshes) into the queryable `app_events` table so we can answer
// "what did this user actually do?" with one SQL query — instead of guessing from a
// bug report. The analytics twin of errorLog.ts; same fire-and-forget contract:
// reporting must never throw, never block the UI, and never surface to the user.

let getUserId: () => string | null = () => null

/** Let the reporter attribute events to the current user (set once from AuthContext). */
export function setEventUserProvider(fn: () => string | null): void {
  getUserId = fn
}

/**
 * Record a product event. `name` is a stable, snake_case event name (e.g.
 * "onboarding_genre_toggled"); `props` adds any useful structured context. Safe to
 * call from anywhere — fire-and-forget, resolves before the write completes.
 *
 * Keep names and prop shapes stable: they are the analytics schema. See
 * supabase/migrations/012_app_events.sql for the catalogue of events in use.
 */
export function logEvent(name: string, props: Record<string, unknown> = {}): void {
  try {
    void logAppEvent({ userId: getUserId(), name, props })
  } catch {
    // Analytics must never throw.
  }
}
