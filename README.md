# Librarian

A personal book recommendation app for two, powered by Google Gemini.

## Stack

- **Frontend**: React + Vite + Tailwind CSS, deployed on GitHub Pages
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **AI**: Google Gemini (via the `librarian` Supabase Edge Function)
- **Book data**: Open Library API (free, no key required)

---

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the SQL editor, run the contents of `supabase/migrations/001_initial.sql`

### 2. Configure Auth

In your Supabase dashboard:

1. Go to **Authentication → Providers → Email**
2. Enable **"Magic Link"** (passwordless)
3. Go to **Authentication → Settings**
4. Set **"Site URL"** to your Vercel deployment URL (or `http://localhost:5173` for local dev)
5. Under **"User signups"**, disable public signups so only invited users can join

### 3. Add users

In **Authentication → Users**, click **"Invite user"** and send invites to both users.

### 4. Configure the frontend

```bash
cp .env.example .env
```

Fill in your Supabase URL and anon key (found in **Project Settings → API**):

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Run locally

```bash
npm install
npm run dev
```

### 6. Deploy to Vercel

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Add the environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
4. Deploy

### 7. Deploy the Edge Function

```bash
# Install Supabase CLI first: https://supabase.com/docs/guides/cli
supabase login
supabase functions deploy librarian --project-ref your-project-ref
```

(CI also deploys this automatically on every push to `main`.)

### 8. Enable AI recommendations

In Supabase dashboard → **Edge Functions → librarian → Secrets**, add:

```
GOOGLE_API_KEY=...
```

Gemini's free tier is enough for two readers, so both Tim and Michelle share one key.

---

## How it works

- **Shelf**: Log books you've read. Search by title/author via Open Library.
- **Discover**: Gemini reads your reading history and lays out rows of suggestions — your best picks, a few stretches, more from authors you love, and "because you loved X" similarity rows.
- **Librarian**: Chat with the librarian for on-demand recommendations.
- **Together**: See what your partner has been reading.
- **Settings**: Update your name. See instructions for adding the API key.

Books added from Discover go straight to your shelf. Dismissed ones are remembered so they won't be suggested again.
