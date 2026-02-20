-- Run this in Supabase SQL Editor (Dashboard → SQL Editor).

-- 1) Profiles (name, profile info) — linked to Supabase Auth
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  bio text,
  avatar text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read all profiles"
  on public.profiles for select using (true);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Profile rows are created by the app (POST /api/auth/profile) when users sign up.
-- Optional: you can add a trigger in Supabase Dashboard if you prefer auto-creation.

-- 2) Posts table
create table if not exists public.posts (
  id text primary key,
  type text not null check (type in ('photo', 'update', 'english-tip')),
  author jsonb not null,
  title text,
  content text not null,
  media jsonb,
  link_url text,
  tags jsonb,
  likes int not null default 0,
  comments int not null default 0,
  created_at timestamptz not null default now()
);

-- Allow anonymous read/write for now (optional: tighten with RLS later)
alter table public.posts enable row level security;

create policy "Allow all for posts"
  on public.posts
  for all
  using (true)
  with check (true);
