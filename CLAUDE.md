# Librarian — Claude Instructions

## What this is

A private reading companion app for two people (Tim and one partner). Users log the books they've read, rate them, and will get AI-powered recommendations based on shared taste. It's intentionally small-scope — no public access, no user growth, no social features.

## Stack

- **React 18 + TypeScript + Vite** — SPA, no SSR
- **Tailwind CSS** — custom design tokens only (see below)
- **Supabase** — auth (magic link email), Postgres DB, RLS policies
- **React Router v6** — HashRouter (required for GitHub Pages)
- **GitHub Pages** — deployed via GH Actions on push to `main`

## Running locally

npm is installed via Homebrew. Always use full paths or prefix `PATH=/opt/homebrew/bin:$PATH` for any npm/npx commands in the shell:

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev        # dev server on :5173
PATH=/opt/homebrew/bin:$PATH npm test           # Vitest unit tests
PATH=/opt/homebrew/bin:$PATH npm run test:e2e   # Playwright E2E
```

Real Supabase credentials are in `.env` (not committed, but present locally). The dev server picks them up automatically — you can test against the real DB when running locally.

## Architecture

### Routing (`src/App.tsx`)

Three-state gate before any page renders:

```
loading → show spinner
!user   → show <Login />
!profile?.onboarded_at → show <Onboarding />
else → show <Layout> with shelf/discover/settings routes
```

### Auth (`src/contexts/AuthContext.tsx`)

Provides `user`, `session`, `profile`, `loading`, `signOut`, `refreshProfile`. After onboarding saves, call `refreshProfile()` — it re-fetches the profile and the routing gate re-evaluates, navigating away from `<Onboarding />` automatically.

### Data access (`src/lib/db.ts`)

**All Supabase table calls go through `src/lib/db.ts`. Components must NOT import `supabase` directly** (the auth methods in `AuthContext` are the only exception). This is where the `{data, error}` → throw contract lives, enforced once and unit-tested in `src/lib/db.test.ts`:

```typescript
const { data, error } = await supabase.from('profiles').update({...}).eq('id', user.id).select('id')
if (error) throw error
if (!data?.length) throw new Error('No rows updated')
```

The Supabase JS client never throws — every call returns `{data, error}`. Swallowing the error produces silent failures / infinite spinners with no user feedback. To add a new DB operation: add a typed function to `db.ts`, cover it in `db.test.ts`, then call it from the component (which try/catches and surfaces the error in the UI).

## Design system

All colours and fonts come from custom Tailwind tokens — never introduce new ones.

| Token | Value | Use |
|---|---|---|
| `bg-cream` | `#FAF8F5` | Page background |
| `bg-parchment` | `#F0EBE1` | Card / panel background |
| `text-ink` | `#1A1A1A` | Primary text |
| `text-muted` | `#7A7068` | Secondary / caption text |
| `border-border` | `#DDD5C8` | Dividers and input borders |
| `forest-700` | `#2C5F2E` | Primary brand colour (buttons, accents) |
| `forest-900` | `#1A3A1B` | Hover state for forest-700 |
| `burgundy-700` | `#6B1E1E` | Accent (book spines, etc.) |

Fonts: `font-display` (Playfair Display, serif) for headings, `font-body` (Inter) for everything else.

## Database

Supabase project ref: `tzlvhvihnoaypajraide`

Tables: `profiles`, `books`, `user_books`, `recommendations`

RLS is enabled on all tables. Key policies:
- `profiles` — users can only update their own row
- `user_books` — users can write their own rows; all authenticated users can read (partners see each other's shelves)
- `books` — any authenticated user can read/write (shared book cache)

Migrations live in `supabase/migrations/` and are applied on every deploy via the Supabase Management API. **All migration SQL must be idempotent** (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS` before recreating policies).

**RLS policies require table GRANTs.** Policies are only evaluated *after* a role passes table-level privilege checks. Because we create tables via the Management API (not the dashboard), the `authenticated`/`anon` roles do **not** auto-receive GRANTs — a missing GRANT surfaces as `permission denied for table X` (Postgres 42501), distinct from an RLS denial (`new row violates row-level security policy`). `003_grants.sql` grants the required privileges; any new table needs a matching GRANT. The deploy's "Verify table grants" step asserts this against the real DB so a gap fails the deploy instead of shipping.

## Testing

### Unit + component tests (Vitest)

```bash
npm test          # run once
npm run check     # typecheck + lint + tests — run this before every push
```

Runs in `happy-dom` with React Testing Library (`src/test/setup.ts`). Tests live in `src/**/*.test.{ts,tsx}`:
- `src/lib/db.test.ts` — the data layer, using the chainable mock in `src/test/supabaseMock.ts` (mock the client, assert each function throws on error / returns data / builds the right payload). **This is the highest-value coverage — it catches the silent-failure bug class without a live DB.**
- `src/pages/Onboarding.test.tsx`, `src/components/AddBookModal.test.tsx` — component flows; mock `../lib/db` and `../contexts/AuthContext`.
- `src/lib/openLibrary.test.ts` — pure functions.

When you touch DB logic or a component flow, add/extend a test here first — don't rely on the live app to find the bug.

### E2E tests (Playwright)

```bash
npm run test:e2e
```

**Port isolation is critical.** E2E tests run on `:5174` with `VITE_SUPABASE_URL=https://test.supabase.co`. This is intentional — if they reused the real dev server on `:5173`, the Supabase localStorage key would be `sb-tzlvhvihnoaypajraide-auth-token` (real project), but the tests inject `sb-test-auth-token` (derived from `test.supabase.co`). Wrong port = auth injection silently fails = all tests redirect to Login.

Auth is bypassed in E2E tests via `tests/helpers/auth.ts`: a fake JWT session is injected into localStorage via `page.addInitScript` (string form, not function+args), and all Supabase REST/auth network calls are mocked with `page.route()`. Route predicates receive a `URL` object — always use `url.href.includes(...)`, never `url.includes(...)`.

## Deployment

Push to `main` → GH Actions runs test job → deploy job.

Deploy job: applies migrations → builds → uploads to GH Pages → smoke tests.

Migrations use `curl` to `https://api.supabase.com/v1/projects/{ref}/database/query` (HTTPS, always reachable). Direct Postgres (`db.*.supabase.co:5432`) resolves to IPv6 and is unreachable from GH Actions runners.

Required secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN`.

## Working in this repo

### Definition of Done (before every push)

1. `PATH=/opt/homebrew/bin:$PATH npm run check` passes (typecheck + lint + tests).
2. New/changed DB logic has a `db.test.ts` case; new/changed flows have a component test.
3. **DB-touching changes also get one manual check against real Supabase** — start `npm run dev`, exercise the actual feature. Mocked unit/E2E tests pass even when real DB ops (RLS/grants/schema) are broken; they are not a substitute.

A `pre-push` git hook runs `npm run check` automatically. Enable it once per clone:

```bash
git config core.hooksPath .githooks
```

Bypass in a pinch with `git push --no-verify`.

Otherwise, move fast. This is a personal project — no approval process, no staging environment, push directly to `main`.
