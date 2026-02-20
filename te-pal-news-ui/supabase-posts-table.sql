-- Run this in Supabase SQL Editor (Dashboard → SQL Editor).

-- 1) Profiles (name, profile info) — linked to Supabase Auth
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
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

-- Auto-create profile when a new auth user is created (from signup metadata)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, bio)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'User'),
    (new.raw_user_meta_data->>'bio')::text
  )
  on conflict (id) do update set
    name = coalesce(excluded.name, profiles.name),
    bio = coalesce(excluded.bio, profiles.bio);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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
