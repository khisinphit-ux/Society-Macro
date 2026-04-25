-- =====================================================================
-- Personal Training Portal — schema
-- Run this once in the Supabase SQL editor.
-- =====================================================================

-- ---------- profiles ----------
-- One row per auth user. Role decides which dashboard they see.
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'client' check (role in ('trainer','client')),
  sex         text check (sex in ('male','female')),
  birth_date  date,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile when a new auth.user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- trainer ↔ client link ----------
create table if not exists public.trainer_clients (
  trainer_id  uuid not null references public.profiles(id) on delete cascade,
  client_id   uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (trainer_id, client_id)
);

-- ---------- foods (shared library, owned by trainer) ----------
create table if not exists public.foods (
  id            uuid primary key default gen_random_uuid(),
  owner_id     uuid references public.profiles(id) on delete set null,
  name         text not null,
  serving_g    numeric not null default 100,
  kcal         numeric not null default 0,
  protein_g    numeric not null default 0,
  carbs_g      numeric not null default 0,
  fat_g        numeric not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists foods_name_idx on public.foods using gin (to_tsvector('simple', name));

-- ---------- daily macro targets per client ----------
create table if not exists public.macro_targets (
  client_id    uuid primary key references public.profiles(id) on delete cascade,
  kcal         numeric not null default 2000,
  protein_g    numeric not null default 150,
  carbs_g      numeric not null default 200,
  fat_g        numeric not null default 70,
  updated_at   timestamptz not null default now()
);

-- ---------- meal entries (food log) ----------
create table if not exists public.meal_entries (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles(id) on delete cascade,
  eaten_on     date not null default current_date,
  meal         text not null default 'snack' check (meal in ('breakfast','lunch','dinner','snack')),
  food_id      uuid references public.foods(id) on delete set null,
  custom_name  text,
  servings     numeric not null default 1,
  kcal         numeric not null default 0,
  protein_g    numeric not null default 0,
  carbs_g      numeric not null default 0,
  fat_g        numeric not null default 0,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists meal_entries_client_date_idx on public.meal_entries (client_id, eaten_on);

-- ---------- food journal (free-text) ----------
create table if not exists public.journal_entries (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles(id) on delete cascade,
  entry_date   date not null default current_date,
  body         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists journal_client_date_idx on public.journal_entries (client_id, entry_date desc);

-- ---------- body fat % entries ----------
create table if not exists public.body_fat_entries (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  measured_on   date not null default current_date,
  body_fat_pct  numeric not null,
  method        text default 'manual', -- 'manual' or 'skinfold'
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists body_fat_client_date_idx on public.body_fat_entries (client_id, measured_on desc);

-- ---------- skinfold measurements (raw site values) ----------
create table if not exists public.skinfold_entries (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  measured_on   date not null default current_date,
  -- 3-site Jackson-Pollock; nullable so either male or female sites work
  chest_mm      numeric,
  abdomen_mm    numeric,
  thigh_mm      numeric,
  tricep_mm     numeric,
  suprailiac_mm numeric,
  computed_pct  numeric,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ---------- weight log ----------
create table if not exists public.weight_entries (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles(id) on delete cascade,
  measured_on  date not null default current_date,
  weight_lb    numeric not null,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists weight_client_date_idx on public.weight_entries (client_id, measured_on desc);

-- ---------- progress photos (metadata only — file lives in Storage) ----------
create table if not exists public.progress_photos (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles(id) on delete cascade,
  taken_on     date not null default current_date,
  storage_path text not null,
  notes        text,
  created_at   timestamptz not null default now()
);

-- =====================================================================
-- Row-Level Security
-- A client only sees their own rows.
-- A trainer sees rows for clients linked to them via trainer_clients.
-- =====================================================================

alter table public.profiles          enable row level security;
alter table public.trainer_clients   enable row level security;
alter table public.foods             enable row level security;
alter table public.macro_targets     enable row level security;
alter table public.meal_entries      enable row level security;
alter table public.journal_entries   enable row level security;
alter table public.body_fat_entries  enable row level security;
alter table public.skinfold_entries  enable row level security;
alter table public.weight_entries    enable row level security;
alter table public.progress_photos   enable row level security;

-- helper: is the current user the trainer of <client_id>?
create or replace function public.is_my_client(_client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trainer_clients
    where trainer_id = auth.uid() and client_id = _client_id
  );
$$;

-- ---- profiles ----
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select using (id = auth.uid() or public.is_my_client(id));

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (id = auth.uid());

-- ---- trainer_clients ----
drop policy if exists "trainer sees own links" on public.trainer_clients;
create policy "trainer sees own links" on public.trainer_clients
  for select using (trainer_id = auth.uid() or client_id = auth.uid());

drop policy if exists "trainer manages own links" on public.trainer_clients;
create policy "trainer manages own links" on public.trainer_clients
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

-- ---- foods (shared visibility for trainer + their clients) ----
drop policy if exists "foods read" on public.foods;
create policy "foods read" on public.foods
  for select using (
    owner_id = auth.uid()
    or owner_id in (select trainer_id from public.trainer_clients where client_id = auth.uid())
    or owner_id is null
  );
drop policy if exists "foods write owner" on public.foods;
create policy "foods write owner" on public.foods
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---- generic per-client read/write policy macro ----
-- We repeat the same pattern for every per-client table.

-- macro_targets
drop policy if exists "mt read" on public.macro_targets;
create policy "mt read" on public.macro_targets
  for select using (client_id = auth.uid() or public.is_my_client(client_id));
drop policy if exists "mt write" on public.macro_targets;
create policy "mt write" on public.macro_targets
  for all using (client_id = auth.uid() or public.is_my_client(client_id))
  with check (client_id = auth.uid() or public.is_my_client(client_id));

-- meal_entries
drop policy if exists "me read" on public.meal_entries;
create policy "me read" on public.meal_entries
  for select using (client_id = auth.uid() or public.is_my_client(client_id));
drop policy if exists "me write" on public.meal_entries;
create policy "me write" on public.meal_entries
  for all using (client_id = auth.uid() or public.is_my_client(client_id))
  with check (client_id = auth.uid() or public.is_my_client(client_id));

-- journal_entries
drop policy if exists "je read" on public.journal_entries;
create policy "je read" on public.journal_entries
  for select using (client_id = auth.uid() or public.is_my_client(client_id));
drop policy if exists "je write" on public.journal_entries;
create policy "je write" on public.journal_entries
  for all using (client_id = auth.uid() or public.is_my_client(client_id))
  with check (client_id = auth.uid() or public.is_my_client(client_id));

-- body_fat_entries
drop policy if exists "bf read" on public.body_fat_entries;
create policy "bf read" on public.body_fat_entries
  for select using (client_id = auth.uid() or public.is_my_client(client_id));
drop policy if exists "bf write" on public.body_fat_entries;
create policy "bf write" on public.body_fat_entries
  for all using (client_id = auth.uid() or public.is_my_client(client_id))
  with check (client_id = auth.uid() or public.is_my_client(client_id));

-- skinfold_entries
drop policy if exists "sf read" on public.skinfold_entries;
create policy "sf read" on public.skinfold_entries
  for select using (client_id = auth.uid() or public.is_my_client(client_id));
drop policy if exists "sf write" on public.skinfold_entries;
create policy "sf write" on public.skinfold_entries
  for all using (client_id = auth.uid() or public.is_my_client(client_id))
  with check (client_id = auth.uid() or public.is_my_client(client_id));

-- weight_entries
drop policy if exists "we read" on public.weight_entries;
create policy "we read" on public.weight_entries
  for select using (client_id = auth.uid() or public.is_my_client(client_id));
drop policy if exists "we write" on public.weight_entries;
create policy "we write" on public.weight_entries
  for all using (client_id = auth.uid() or public.is_my_client(client_id))
  with check (client_id = auth.uid() or public.is_my_client(client_id));

-- progress_photos
drop policy if exists "pp read" on public.progress_photos;
create policy "pp read" on public.progress_photos
  for select using (client_id = auth.uid() or public.is_my_client(client_id));
drop policy if exists "pp write" on public.progress_photos;
create policy "pp write" on public.progress_photos
  for all using (client_id = auth.uid() or public.is_my_client(client_id))
  with check (client_id = auth.uid() or public.is_my_client(client_id));
