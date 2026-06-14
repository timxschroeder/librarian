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

### Supabase client

**Critical:** the Supabase JS client never throws — every call returns `{data, error}`. Always destructure and check the error explicitly, then throw if needed:

```typescript
const { data, error } = await supabase.from('profiles').update({...}).eq('id', user.id).select('id')
if (error) throw error
if (!data?.length) throw new Error('No rows updated')
```

Swallowing errors produces infinite loading spinners with no user feedback. Don't do it.

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

## Testing

### Unit tests (Vitest)

```bash
npm test
```

Pure-function tests in `src/**/*.test.ts`. Currently covers `src/lib/openLibrary.ts`.

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

**Verify before pushing.** For any change that touches DB reads/writes or a new user-facing flow: start the dev server locally (`npm run dev`), test the actual feature against real Supabase, confirm it works. Mocked E2E tests pass even when the real DB operations are broken — they are not a substitute for a manual check on DB-touching code.

Otherwise, move fast. This is a personal project — no approval process, no staging environment, push directly to `main`.
