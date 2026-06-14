# Librarian

A personal book recommendation app for two, powered by Claude AI.

## Stack

- **Frontend**: React + Vite + Tailwind CSS, deployed on Vercel
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **AI**: Anthropic Claude (via Supabase Edge Function)
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

### 3. Add users (Tim & Michelle)

In **Authentication → Users**, click **"Invite user"** and send invites to:
- `timxschroeder@gmail.com`
- `Kroegermichelle@web.de`

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
supabase functions deploy recommend --project-ref your-project-ref
```

### 8. Enable AI recommendations (when you have an API key)

In Supabase dashboard → **Edge Functions → recommend → Secrets**, add:

```
ANTHROPIC_API_KEY=sk-ant-...
```

That's it. Both Tim and Michelle can use the app without each needing their own key.

---

## How it works

- **Shelf**: Log books you've read. Search by title/author via Open Library.
- **Discover**: Claude reads your reading history and suggests books. Use the prompt field to guide it — "Something like Cosmos but more literary", etc.
- **Together**: See what your partner has been reading.
- **Settings**: Update your name. See instructions for adding the API key.

Accepted recommendations go straight to your shelf. Rejected ones are remembered so Claude won't suggest them again.
