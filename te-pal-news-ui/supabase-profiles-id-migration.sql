-- TePal News: Ensure public.profiles has "id" (uuid) as PK = auth.users.id
-- Run in Supabase → SQL Editor if Table Editor shows no "id" column or update by id fails.
-- 영향: 기존 row가 있으면 id를 채우고, 없으면 새로 만들 때 id를 쓰게 됨.

-- 1) id 컬럼이 없으면 추가 (user_id만 있는 스키마용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    UPDATE public.profiles SET id = user_id WHERE user_id IS NOT NULL AND id IS NULL;
    ALTER TABLE public.profiles
      DROP CONSTRAINT IF EXISTS profiles_pkey,
      ADD PRIMARY KEY (id);
  END IF;
END $$;

-- 2) id가 있지만 PK가 아닌 경우: unique 제약만 있으면 upsert/update 가능
-- (이미 id가 PK면 위 블록이 아무 것도 하지 않음)

-- 3) 확인용 (실행 후 Table Editor에서 id 컬럼 확인)
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'profiles' ORDER BY ordinal_position;
