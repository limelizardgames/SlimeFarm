-- Cloud saves for Slime Ranch Idle: one row per player.
create table if not exists public.saves (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  data              text not null check (length(data) < 2000000),
  updated_at        bigint not null,              -- client clock (ms), used to detect newer saves
  lifetime_goo      double precision not null default 0,
  slimes            integer not null default 0,
  species           integer not null default 0,
  device            text not null default '',
  server_updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

-- Players can only ever see and change their own row.
create policy "Players read their own save" on public.saves
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players create their own save" on public.saves
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Players update their own save" on public.saves
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Players delete their own save" on public.saves
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.touch_saves() returns trigger language plpgsql as $$
begin
  new.server_updated_at := now();
  return new;
end $$;

drop trigger if exists saves_touch on public.saves;
create trigger saves_touch before update on public.saves for each row execute function public.touch_saves();
