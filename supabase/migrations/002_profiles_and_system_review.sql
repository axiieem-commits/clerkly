-- Run this entire file in Supabase Dashboard > SQL Editor after 001_clerkly_schema.sql.
-- It adds student profiles, private profile photos, and structured systemic review fields.

alter table public.clinical_cases
  add column if not exists main_system text,
  add column if not exists system_problem text;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  username text not null,
  year_of_study text not null default 'Year 3',
  posting text not null default 'Internal Medicine',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon;
grant select, insert, update, delete on table public.profiles to authenticated;

drop policy if exists "Users read their own profile" on public.profiles;
create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users create their own profile" on public.profiles;
create policy "Users create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

update storage.buckets
set file_size_limit = 1048576
where id = 'case-images';

drop policy if exists "Users read their own profile images" on storage.objects;
create policy "Users read their own profile images"
  on storage.objects for select to authenticated
  using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users upload their own profile images" on storage.objects;
create policy "Users upload their own profile images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete their own profile images" on storage.objects;
create policy "Users delete their own profile images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
