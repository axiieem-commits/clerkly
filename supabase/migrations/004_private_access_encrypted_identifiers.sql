-- Run once in Supabase SQL Editor before deploying the new code.
begin;
create table if not exists public.allowed_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
-- Freeze the CURRENT two accounts; rerunning never adds new accounts.
do $$
begin
  if not exists (select 1 from public.allowed_users) then
    if (select count(*) from auth.users) <> 2 then
      raise exception 'Expected exactly two existing accounts. Review Authentication > Users before proceeding.';
    end if;
    insert into public.allowed_users select id from auth.users;
  end if;
end $$;
alter table public.allowed_users enable row level security;
revoke all on public.allowed_users from anon, authenticated;
create or replace function public.is_allowed_user() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.allowed_users where user_id = auth.uid()); $$;
revoke all on function public.is_allowed_user() from public;
grant execute on function public.is_allowed_user() to authenticated;
alter table public.clinical_cases add column if not exists patient_identifiers_encrypted text;
drop policy if exists "Existing accounts only" on public.clinical_cases;
create policy "Existing accounts only" on public.clinical_cases as restrictive for all to authenticated
using (public.is_allowed_user()) with check (public.is_allowed_user());
drop policy if exists "Existing accounts only" on public.profiles;
create policy "Existing accounts only" on public.profiles as restrictive for all to authenticated
using (public.is_allowed_user()) with check (public.is_allowed_user());
drop policy if exists "Existing Clerkly accounts only" on storage.objects;
create policy "Existing Clerkly accounts only" on storage.objects as restrictive for all to authenticated
using (bucket_id not in ('case-images','profile-images') or public.is_allowed_user())
with check (bucket_id not in ('case-images','profile-images') or public.is_allowed_user());
commit;
