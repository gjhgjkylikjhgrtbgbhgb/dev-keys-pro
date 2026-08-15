
-- 1. Create app_role enum if it doesn't exist
do $$ begin
  create type public.app_role as enum ('admin', 'reseller');
exception
  when duplicate_object then null;
end $$;

-- 2. Create user_roles table
create table if not exists public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    role app_role not null,
    unique (user_id, role)
);

-- 3. Enable RLS and Grants
alter table public.user_roles enable row level security;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

-- 4. Create profiles table to store phone and status
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  full_name text,
  is_blocked boolean default false,
  license_inventory int default 0,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- 5. Create has_role function
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- 6. Add policies for profiles
drop policy if exists "Admins can see all profiles" on public.profiles;
create policy "Admins can see all profiles" on public.profiles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles" on public.profiles
  for update to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users can see their own profile" on public.profiles;
create policy "Users can see their own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);

-- 7. Add policies for user_roles
drop policy if exists "Admins can see all roles" on public.user_roles;
create policy "Admins can see all roles" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- 8. Modify licenses table to support assignment to resellers
alter table public.licenses add column if not exists owner_id uuid references auth.users(id);
create index if not exists idx_licenses_owner on public.licenses(owner_id);

-- 9. Update existing RLS on licenses
drop policy if exists "Authenticated users can manage licenses" on public.licenses;
drop policy if exists "Admins see all licenses" on public.licenses;
drop policy if exists "Resellers see their own licenses" on public.licenses;

create policy "Admins see all licenses" on public.licenses
  for all to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Resellers see their own licenses" on public.licenses
  for select to authenticated using (owner_id = auth.uid());
