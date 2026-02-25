-- TePal News: single RPC for feed (group-by aggregates, no per-row subqueries)
-- Run in Supabase SQL Editor after supabase-schema-v1.sql

-- Index for feed: order by created_at desc, filter is_hidden = false
create index if not exists idx_posts_feed_created
  on public.posts(created_at desc)
  where is_hidden = false;

-- Aggregation indexes (if not already covered)
create index if not exists idx_post_likes_post_id on public.post_likes(post_id);
create index if not exists idx_comments_post_hidden on public.comments(post_id, is_hidden) where not is_hidden;
create index if not exists idx_post_media_post_id on public.post_media(post_id);

-- RPC: one round-trip feed with CTE + group by (no per-row subqueries)
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
  with posts_page as (
    select p.id, p.author_id, p.type, p.title, p.content, p.link_url, p.tags, p.is_hidden, p.created_at, p.updated_at
    from public.posts p
    where p.is_hidden = false
    order by p.created_at desc
    limit limit_n
  ),
  likes_agg as (
    select pl.post_id, count(*)::bigint as cnt
    from public.post_likes pl
    inner join posts_page pp on pp.id = pl.post_id
    group by pl.post_id
  ),
  comments_agg as (
    select c.post_id, count(*)::bigint as cnt
    from public.comments c
    inner join posts_page pp on pp.id = c.post_id
    where not c.is_hidden
    group by c.post_id
  ),
  media_agg as (
    select pm.post_id, coalesce(json_agg(pm.storage_path order by pm.sort_order), '[]'::json) as media
    from public.post_media pm
    inner join posts_page pp on pp.id = pm.post_id
    group by pm.post_id
  )
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
    coalesce(la.cnt, 0) as like_count,
    coalesce(ca.cnt, 0) as comment_count,
    coalesce(ma.media, '[]'::json) as media
  from posts_page pp
  left join public.profiles pr on pr.user_id = pp.author_id
  left join likes_agg la on la.post_id = pp.id
  left join comments_agg ca on ca.post_id = pp.id
  left join media_agg ma on ma.post_id = pp.id
  order by pp.created_at desc;
$$;

grant execute on function public.get_feed(int) to authenticated;
grant execute on function public.get_feed(int) to service_role;
