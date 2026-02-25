-- TePal News: single RPC for feed (scalar subqueries = index lookup per row, avoids slow GroupAggregate)
-- Run in Supabase SQL Editor after supabase-schema-v1.sql

-- Index for feed: order by created_at desc, filter is_hidden = false
create index if not exists idx_posts_feed_created
  on public.posts(created_at desc)
  where is_hidden = false;

-- Aggregation indexes (if not already covered)
create index if not exists idx_post_likes_post_id on public.post_likes(post_id);
create index if not exists idx_comments_post_hidden on public.comments(post_id, is_hidden) where not is_hidden;
create index if not exists idx_post_media_post_id on public.post_media(post_id);

-- RPC: feed with scalar subqueries so planner uses index per post_id (avoids slow GroupAggregate)
create or replace function public.get_feed(limit_n int default 12)
returns table (
  id uuid,
  author_id uuid,
  type text,
  title text,
  content text,
  link_url text,
  tags text[],
  is_hidden boolean,
  created_at timestamptz,
  updated_at timestamptz,
  display_name text,
  avatar_url text,
  bio text,
  like_count bigint,
  comment_count bigint,
  media json
)
language sql
stable
as $$
  select
    pp.id,
    pp.author_id,
    replace(pp.type::text, '_', '-') as type,
    pp.title,
    pp.content,
    pp.link_url,
    pp.tags,
    pp.is_hidden,
    pp.created_at,
    pp.updated_at,
    pr.display_name,
    pr.avatar_url,
    pr.bio,
    (select count(*)::bigint from public.post_likes pl where pl.post_id = pp.id) as like_count,
    (select count(*)::bigint from public.comments c where c.post_id = pp.id and not c.is_hidden) as comment_count,
    (select coalesce(json_agg(pm.storage_path order by pm.sort_order), '[]'::json) from public.post_media pm where pm.post_id = pp.id) as media
  from (
    select p.id, p.author_id, p.type, p.title, p.content, p.link_url, p.tags, p.is_hidden, p.created_at, p.updated_at
    from public.posts p
    where p.is_hidden = false
    order by p.created_at desc
    limit limit_n
  ) pp
  left join public.profiles pr on pr.user_id = pp.author_id
  order by pp.created_at desc;
$$;

grant execute on function public.get_feed(int) to authenticated;
grant execute on function public.get_feed(int) to service_role;
