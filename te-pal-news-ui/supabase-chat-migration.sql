-- TePal News — Chat: slug + global room (Supabase SQL Editor에서 실행)
-- 1) conversations에 slug 추가 (전체방 1개 보장용)
alter table public.conversations add column if not exists slug text;

-- 2) slug unique index (전체방은 slug='global' 1개만)
create unique index if not exists uq_conversations_slug on public.conversations(slug) where slug is not null;

-- 3) 기존 "TePal Global Chat" 그룹이 있으면 slug 설정 (1개만)
update public.conversations
set slug = 'global'
where id = (
  select id from public.conversations
  where type = 'group' and title = 'TePal Global Chat' and slug is null
  order by created_at asc limit 1
);

-- 4) global 방이 하나도 없으면 insert (한 번만 실행되면 됨)
insert into public.conversations (type, title, slug)
select 'group', 'TePal Global Chat', 'global'
where not exists (
  select 1 from public.conversations where slug = 'global'
);

-- 메시지 조회용 인덱스(이미 있으면 무시)
create index if not exists idx_messages_conversation_time on public.messages(conversation_id, created_at asc);
