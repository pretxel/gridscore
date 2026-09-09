-- ===========================================================================
-- gridscore — accounts foundation
-- ---------------------------------------------------------------------------
-- profiles (one row per auth user), the signup trigger that creates it, the
-- updated_at helper, the is_admin() resolver used by every later policy, and
-- the guard that keeps `is_admin` / `plan` writable only by the service role.
-- Copied from Winscore's init migration with the `plan` column added for the
-- monetization hooks. Domain tables land in the next migration.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  plan text not null default 'free',
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) between 2 and 32),
  constraint profiles_plan_check check (plan in ('free', 'pro'))
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- auth.users -> profiles: create an empty profile row on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Is the current user an admin? SECURITY DEFINER so policies on profiles can
-- call it without recursing into their own RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Only the service role (service_role JWT or no JWT at all) may change
-- `is_admin` or `plan`; the user API cannot self-promote or self-upgrade.
create or replace function public.guard_profiles_privileged_columns()
returns trigger
language plpgsql
as $$
declare
  jwt_role text;
begin
  if new.is_admin is distinct from old.is_admin
     or new.plan is distinct from old.plan then
    jwt_role := (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role');
    if jwt_role is null or jwt_role = 'service_role' then
      return new;
    end if;
    raise exception 'is_admin and plan cannot be changed via the user API';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.guard_profiles_privileged_columns();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Any signed-in user can read any profile (leaderboards need display names).
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_all"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant execute on function public.is_admin() to anon, authenticated;
