-- Ejecutar en Supabase > SQL Editor

create table if not exists conversations (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  title       text        not null default 'Consulta',
  data        jsonb       not null default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table conversations enable row level security;

create policy "conversations_all_own"
  on conversations
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage para imagenes OCR
insert into storage.buckets (id, name, public)
values ('report-images', 'report-images', false)
on conflict (id) do nothing;

drop policy if exists "report_images_select_own" on storage.objects;
create policy "report_images_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'report-images'
    and name like auth.uid()::text || '/%'
  );

drop policy if exists "report_images_insert_own" on storage.objects;
create policy "report_images_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'report-images'
    and name like auth.uid()::text || '/%'
  );

drop policy if exists "report_images_update_own" on storage.objects;
create policy "report_images_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'report-images'
    and name like auth.uid()::text || '/%'
  )
  with check (
    bucket_id = 'report-images'
    and name like auth.uid()::text || '/%'
  );

drop policy if exists "report_images_delete_own" on storage.objects;
create policy "report_images_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'report-images'
    and name like auth.uid()::text || '/%'
  );
