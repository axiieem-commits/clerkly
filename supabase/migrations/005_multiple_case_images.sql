-- Run once in Supabase SQL Editor before deploying this version.
begin;

create table if not exists public.case_images (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.clinical_cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  sort_order integer not null default 0 check (sort_order >= 0 and sort_order < 6),
  created_at timestamptz not null default now()
);

create index if not exists case_images_case_sort_idx
  on public.case_images (case_id, sort_order);

alter table public.case_images enable row level security;
revoke all on table public.case_images from anon;
grant select, insert, update, delete on table public.case_images to authenticated;

drop policy if exists "Users read their own case images metadata" on public.case_images;
create policy "Users read their own case images metadata"
  on public.case_images for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users create their own case images metadata" on public.case_images;
create policy "Users create their own case images metadata"
  on public.case_images for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.clinical_cases
      where clinical_cases.id = case_images.case_id
        and clinical_cases.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users update their own case images metadata" on public.case_images;
create policy "Users update their own case images metadata"
  on public.case_images for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their own case images metadata" on public.case_images;
create policy "Users delete their own case images metadata"
  on public.case_images for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Existing accounts only" on public.case_images;
create policy "Existing accounts only" on public.case_images as restrictive for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

commit;
