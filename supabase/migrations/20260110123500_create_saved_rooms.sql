create table if not exists public.saved_rooms (
  id uuid not null default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  mode text not null,
  players jsonb not null default '[]'::jsonb,
  topo_count integer,
  variant text,
  selected_pack_ids text[],
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (id)
);

alter table public.saved_rooms enable row level security;

create policy "Users can view their own saved rooms"
  on public.saved_rooms for select
  using (auth.uid() = user_id);

create policy "Users can insert their own saved rooms"
  on public.saved_rooms for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own saved rooms"
  on public.saved_rooms for update
  using (auth.uid() = user_id);

create policy "Users can delete their own saved rooms"
  on public.saved_rooms for delete
  using (auth.uid() = user_id);
