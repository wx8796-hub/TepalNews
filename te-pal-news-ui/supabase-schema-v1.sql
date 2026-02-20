-- TePal News — Schema v1 (Supabase Postgres) / RLS OFF
-- Run directly in Supabase SQL Editor

-- 0) Extensions
create extension if not exists pgcrypto;
create extension if not exists citext;

-- 0) Enums
do $$
begin
  create type public.post_type as enum ('photo', 'update', 'english_tip');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.conversation_type as enum ('dm', 'group');
exception
  when duplicate_object then null;
end $$;

-- 1) updated_at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2) profiles
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member', -- 'member' | 'admin'
  display_name text not null,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles disable row level security;
alter table public.profiles no force row level security;

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_display_name on public.profiles(display_name);

-- 3) posts + post_media
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  type public.post_type not null,
  title text,
  content text not null,
  link_url text,
  tags text[] not null default '{}',
  is_hidden boolean not null default false, -- moderation (admin)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

alter table public.posts disable row level security;
alter table public.posts no force row level security;

create index if not exists idx_posts_author_created on public.posts(author_id, created_at desc);
create index if not exists idx_posts_type_created on public.posts(type, created_at desc);
create index if not exists idx_posts_hidden on public.posts(is_hidden);
create index if not exists idx_posts_tags_gin on public.posts using gin (tags);

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_bucket text not null default 'post-media',
  storage_path text not null, -- Supabase Storage path
  media_type text not null default 'image',
  width int,
  height int,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.post_media disable row level security;
alter table public.post_media no force row level security;

create index if not exists idx_post_media_post_sort on public.post_media(post_id, sort_order asc);

-- 3b) View for app feed: posts + author profile + like/comment counts + media array
create or replace view public.posts_feed as
select
  p.id,
  p.author_id,
  replace(p.type::text, '_', '-') as type,
  p.title,
  p.content,
  p.link_url,
  p.tags,
  p.is_hidden,
  p.created_at,
  p.updated_at,
  pr.display_name,
  pr.avatar_url,
  pr.bio,
  (select count(*)::int from public.post_likes pl where pl.post_id = p.id) as like_count,
  (select count(*)::int from public.comments c where c.post_id = p.id and not c.is_hidden) as comment_count,
  (select coalesce(json_agg(pm.storage_path order by pm.sort_order), '[]'::json) from public.post_media pm where pm.post_id = p.id) as media
from public.posts p
left join public.profiles pr on pr.user_id = p.author_id;

-- 4) comments
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  is_hidden boolean not null default false,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_comments_updated_at on public.comments;
create trigger trg_comments_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

alter table public.comments disable row level security;
alter table public.comments no force row level security;

create index if not exists idx_comments_post_created on public.comments(post_id, created_at asc);
create index if not exists idx_comments_author_created on public.comments(author_id, created_at desc);
create index if not exists idx_comments_hidden on public.comments(is_hidden);
create index if not exists idx_comments_parent on public.comments(parent_comment_id);

-- 5) post_likes
create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes disable row level security;
alter table public.post_likes no force row level security;

create index if not exists idx_post_likes_user_created on public.post_likes(user_id, created_at desc);

-- 6) hot_topics (manual override)
create table if not exists public.hot_topics (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  set_by uuid references auth.users(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.hot_topics disable row level security;
alter table public.hot_topics no force row level security;

create unique index if not exists uq_hot_topics_single_active
on public.hot_topics(is_active)
where is_active = true;

create index if not exists idx_hot_topics_time on public.hot_topics(starts_at desc);
create index if not exists idx_hot_topics_post on public.hot_topics(post_id);

-- 7) weekly_best (Top 3 snapshot)
create table if not exists public.weekly_best_runs (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  generated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (week_start, week_end)
);

alter table public.weekly_best_runs disable row level security;
alter table public.weekly_best_runs no force row level security;

create table if not exists public.weekly_best_posts (
  run_id uuid not null references public.weekly_best_runs(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  rank int not null check (rank between 1 and 3),
  score numeric not null,
  likes_count int not null,
  comments_count int not null,
  created_at timestamptz not null default now(),
  primary key (run_id, post_id),
  unique (run_id, rank)
);

alter table public.weekly_best_posts disable row level security;
alter table public.weekly_best_posts no force row level security;

create index if not exists idx_weekly_best_runs_created on public.weekly_best_runs(created_at desc);
create index if not exists idx_weekly_best_posts_rank on public.weekly_best_posts(run_id, rank);

-- 8) chat: conversations / members / messages (DM + Group)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.conversation_type not null,
  title text,
  dm_key text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_conversations_dm_fields
    check (
      (type = 'dm' and dm_key is not null and title is null)
      or
      (type = 'group' and dm_key is null)
    )
);

drop trigger if exists trg_conversations_updated_at on public.conversations;
create trigger trg_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

alter table public.conversations disable row level security;
alter table public.conversations no force row level security;

create unique index if not exists uq_conversations_dm_key
on public.conversations(dm_key)
where dm_key is not null;

create index if not exists idx_conversations_type_created on public.conversations(type, created_at desc);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

alter table public.conversation_members disable row level security;
alter table public.conversation_members no force row level security;

create index if not exists idx_conversation_members_user on public.conversation_members(user_id, joined_at desc);
create index if not exists idx_conversation_members_conversation on public.conversation_members(conversation_id, joined_at asc);

-- 9) messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_messages_updated_at on public.messages;
create trigger trg_messages_updated_at
before update on public.messages
for each row execute function public.set_updated_at();

alter table public.messages disable row level security;
alter table public.messages no force row level security;

create index if not exists idx_messages_conversation_time on public.messages(conversation_id, created_at asc);
create index if not exists idx_messages_sender_time on public.messages(sender_id, created_at desc);

-- 10) Grants (RLS OFF)
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- View for app
grant select on public.posts_feed to authenticated;

alter default privileges in schema public
grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
grant usage, select on sequences to authenticated;
