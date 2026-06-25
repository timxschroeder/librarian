import { logAppError } from './db'

// Client-side error reporting. Routes caught failures and unhandled errors into the
// queryable `app_errors` table so silent failures become findable with one SQL query,
// instead of living only in a user's console. Everything here is best-effort and
// fire-and-forget — reporting must never throw or block.

let getUserId: () => string | null = () => null
let installed = false

/** Let the reporter attribute errors to the current user (set once from AuthContext). */
export function setErrorUserProvider(fn: () => string | null): void {
  getUserId = fn
}

/**
 * Report a caught error. `where` is a stable label for the call site (e.g.
 * "Taste.sync"); `extra` adds any useful context. Fire-and-forget — safe to call from
 * a catch block alongside the user-facing handling.
 */
export function reportError(where: string, error: unknown, extra: Record<string, unknown> = {}): void {
  try {
    const err = error as { message?: string; stack?: string } | undefined
    void logAppError({
      source: 'client',
      userId: getUserId(),
      context: { where, ...extra },
      message: String(err?.message ?? error),
      stack: err?.stack ?? null,
    })
  } catch {
    // Reporting must never throw.
  }
}

/** Capture otherwise-unhandled errors. Install once, early (from AuthProvider). */
export function installGlobalErrorReporting(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('unhandledrejection', (e) => reportError('unhandledrejection', e.reason))
  window.addEventListener('error', (e) => reportError('window.error', e.error ?? e.message))
}
