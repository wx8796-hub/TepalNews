-- Run this in Supabase SQL Editor (Dashboard → SQL Editor) to create the posts table.

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
