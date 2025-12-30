-- Migration: Fix and stabilize get_random_card RPC function
-- Ensures signature matches frontend usage and permissions are correct

-- 1. Drop existing function to ensure clean slate (handling potential overload differences)
drop function if exists public.get_random_card(uuid[]);

-- 2. Recreate function with simple, robust random selection
-- We trust Postgres optimization for "order by random() limit 1" on small datasets (filtered by packs)
-- If table gets huge (millions), we can revert to pivot method, but for now correctness > perf optimization logic that might fail
create or replace function public.get_random_card(pack_ids uuid[])
returns table (id uuid, word text, clue text, pack_id uuid)
language sql
stable
set search_path = ''
as $$
  select
    c.id,
    c.word,
    c.clue,
    c.pack_id
  from
    public.cards c
  where
    c.is_active = true
    and c.pack_id = any(pack_ids)
  order by
    random()
  limit 1;
$$;

-- 3. Explicitly grant permissions
-- This is critical to avoid 404/403 errors on the RPC endpoint
grant execute on function public.get_random_card(uuid[]) to anon;
grant execute on function public.get_random_card(uuid[]) to authenticated;
grant execute on function public.get_random_card(uuid[]) to service_role;

-- 4. Reload PostgREST schema cache
notify pgrst, 'reload schema';
