-- Run this entire file in Supabase Dashboard > SQL Editor.
-- It creates the casebook table, owner-only access rules, and private image storage.

create extension if not exists pgcrypto;

create table if not exists public.clinical_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  posting text not null,
  patient_age text,
  patient_gender text,
  patient_race text,
  chief_complaint text,
  presentation text not null,
  systemic_review text,
  past_medical_history text,
  past_surgical_history text,
  drug_history text,
  allergy_history text,
  family_history text,
  social_history text,
  findings text,
  provisional_diagnosis text,
  differential_diagnoses text,
  investigations text,
  management_plan text,
  notes_snippets text,
  case_image_path text,
  learning text not null,
  tags text,
  status text not null default 'To review' check (status in ('To review', 'Reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinical_cases_user_created_idx
  on public.clinical_cases (user_id, created_at desc);

alter table public.clinical_cases enable row level security;
revoke all on table public.clinical_cases from anon;
grant select, insert, update, delete on table public.clinical_cases to authenticated;

drop policy if exists "Users read their own cases" on public.clinical_cases;
create policy "Users read their own cases"
  on public.clinical_cases for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users create their own cases" on public.clinical_cases;
create policy "Users create their own cases"
  on public.clinical_cases for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users update their own cases" on public.clinical_cases;
create policy "Users update their own cases"
  on public.clinical_cases for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users delete their own cases" on public.clinical_cases;
create policy "Users delete their own cases"
  on public.clinical_cases for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('case-images', 'case-images', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read their own case images" on storage.objects;
create policy "Users read their own case images"
  on storage.objects for select to authenticated
  using (bucket_id = 'case-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users upload their own case images" on storage.objects;
create policy "Users upload their own case images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'case-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete their own case images" on storage.objects;
create policy "Users delete their own case images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'case-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
