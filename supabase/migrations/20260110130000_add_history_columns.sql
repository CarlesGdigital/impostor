alter table public.saved_rooms
add column if not exists is_favorite boolean not null default false,
add column if not exists last_played_at timestamp with time zone not null default now();

-- Update existing rooms to be favorites by default (since they were manually saved)
update public.saved_rooms set is_favorite = true where is_favorite is false;
