-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null default '',
  email text not null default '',
  taste_summary text,
  created_at timestamptz default now()
);

-- Books (cached from Open Library)
create table if not exists public.books (
  id text primary key,
  title text not null,
  author text,
  cover_url text,
  description text,
  first_publish_year int,
  subjects text[],
  isbn text
);

-- Books read by each user
create table if not exists public.user_books (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  book_id text references public.books(id) on delete cascade not null,
  rating int check (rating >= 1 and rating <= 5),
  notes text,
  read_at date default current_date,
  created_at timestamptz default now(),
  unique(user_id, book_id)
);

-- AI-generated recommendations
create table if not exists public.recommendations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  book_id text references public.books(id) on delete cascade not null,
  reasoning text not null default '',
  prompt text,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  feedback text,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.user_books enable row level security;
alter table public.recommendations enable row level security;

-- Books: readable and writable by all authenticated users
drop policy if exists "books_select" on public.books;
create policy "books_select" on public.books
  for select to authenticated using (true);

drop policy if exists "books_insert" on public.books;
create policy "books_insert" on public.books
  for insert to authenticated with check (true);

drop policy if exists "books_update" on public.books;
create policy "books_update" on public.books
  for update to authenticated using (true);

-- Profiles: readable by all authenticated users, writable by self
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- User books: readable by all authenticated users (partners can see each other)
drop policy if exists "user_books_select" on public.user_books;
create policy "user_books_select" on public.user_books
  for select to authenticated using (true);

drop policy if exists "user_books_write" on public.user_books;
create policy "user_books_write" on public.user_books
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Recommendations: private to each user
drop policy if exists "recommendations_select" on public.recommendations;
create policy "recommendations_select" on public.recommendations
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "recommendations_write" on public.recommendations;
create policy "recommendations_write" on public.recommendations
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
