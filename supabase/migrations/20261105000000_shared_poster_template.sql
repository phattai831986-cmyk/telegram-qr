drop policy if exists "Approved users can read the shared poster template" on storage.objects;
create policy "Approved users can read the shared poster template"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'transfer-posters'
    and (storage.foldername(name))[1] = 'templates'
  );

drop policy if exists "Access admins can upload the shared poster template" on storage.objects;
create policy "Access admins can upload the shared poster template"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'transfer-posters'
    and (storage.foldername(name))[1] = 'templates'
    and exists (
      select 1 from public.app_access_admins as admins
      where admins.user_id = (select auth.uid())
    )
  );

drop policy if exists "Access admins can replace the shared poster template" on storage.objects;
create policy "Access admins can replace the shared poster template"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'transfer-posters'
    and (storage.foldername(name))[1] = 'templates'
    and exists (
      select 1 from public.app_access_admins as admins
      where admins.user_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'transfer-posters'
    and (storage.foldername(name))[1] = 'templates'
    and exists (
      select 1 from public.app_access_admins as admins
      where admins.user_id = (select auth.uid())
    )
  );
