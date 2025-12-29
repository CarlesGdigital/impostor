-- Migration: Add get_random_card RPC function
-- This replaces the massive SELECT with an efficient server-side random card selection

-- Ensure pgcrypto extension is enabled (for gen_random_uuid)
create extension if not exists pgcrypto;

-- Create index for efficient card lookup by pack_id and is_active
create index if not exists cards_pack_active_id_idx
  on public.cards (pack_id, is_active, id);

-- Create RPC function to get a random active card from specified packs
-- Uses a pivot-based approach for efficiency without ORDER BY random()
create or replace function public.get_random_card(pack_ids uuid[])
returns table (id uuid, word text, clue text, pack_id uuid)
language sql stable as $$
  with pivot as (select gen_random_uuid() as p)
  (
    select c.id, c.word, c.clue, c.pack_id
    from public.cards c, pivot
    where c.is_active = true
      and c.pack_id = any(pack_ids)
      and c.id >= pivot.p
    order by c.id
    limit 1
  )
  union all
  (
    select c.id, c.word, c.clue, c.pack_id
    from public.cards c
    where c.is_active = true
      and c.pack_id = any(pack_ids)
    order by c.id
    limit 1
  )
  limit 1;
$$;

-- Grant execute permission to authenticated and anon users
grant execute on function public.get_random_card(uuid[]) to authenticated;
grant execute on function public.get_random_card(uuid[]) to anon;

-- Force PostgREST to reload its schema cache so the new function is immediately available
notify pgrst, 'reload schema';

