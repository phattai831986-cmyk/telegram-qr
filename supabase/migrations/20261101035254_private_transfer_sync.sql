create table if not exists public.transfer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  bank_bin text not null,
  account_number text not null,
  account_name text not null,
  amount text not null default '',
  description text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.transfer_profiles enable row level security;
revoke all on public.transfer_profiles from anon;
grant select, insert, update, delete on public.transfer_profiles to authenticated;

drop policy if exists "Users can read their own transfer profile" on public.transfer_profiles;
create policy "Users can read their own transfer profile"
  on public.transfer_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own transfer profile" on public.transfer_profiles;
create policy "Users can create their own transfer profile"
  on public.transfer_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own transfer profile" on public.transfer_profiles;
create policy "Users can update their own transfer profile"
  on public.transfer_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own transfer profile" on public.transfer_profiles;
create policy "Users can delete their own transfer profile"
  on public.transfer_profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('transfer-posters', 'transfer-posters', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can read their own transfer posters" on storage.objects;
create policy "Users can read their own transfer posters"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'transfer-posters'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can upload their own transfer posters" on storage.objects;
create policy "Users can upload their own transfer posters"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'transfer-posters'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update their own transfer posters" on storage.objects;
create policy "Users can update their own transfer posters"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'transfer-posters'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'transfer-posters'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own transfer posters" on storage.objects;
create policy "Users can delete their own transfer posters"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'transfer-posters'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
