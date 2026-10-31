create table if not exists public.site_settings (
  id text primary key check (id = 'default'),
  destination_url text,
  poster_url text not null default '/telegram-qr/bhxh-guide-template.png',
  qr_x_percent numeric not null default 33 check (qr_x_percent >= 0 and qr_x_percent <= 100),
  qr_y_percent numeric not null default 43 check (qr_y_percent >= 0 and qr_y_percent <= 100),
  qr_size_percent numeric not null default 34 check (qr_size_percent >= 5 and qr_size_percent <= 80),
  updated_at timestamptz not null default now(),
  check (qr_x_percent + qr_size_percent <= 100),
  check (qr_y_percent + qr_size_percent * 0.68828125 <= 100)
);

insert into public.site_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;
grant select on public.admin_users to authenticated;

drop policy if exists "Public can read guide settings" on public.site_settings;
create policy "Public can read guide settings"
  on public.site_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can update guide settings" on public.site_settings;
create policy "Admins can update guide settings"
  on public.site_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can read their own admin record" on public.admin_users;
create policy "Admins can read their own admin record"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'poster-templates',
  'poster-templates',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view poster templates" on storage.objects;
create policy "Public can view poster templates"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'poster-templates');

drop policy if exists "Admins can upload poster templates" on storage.objects;
create policy "Admins can upload poster templates"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'poster-templates' and public.is_admin());

drop policy if exists "Admins can update poster templates" on storage.objects;
create policy "Admins can update poster templates"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'poster-templates' and public.is_admin())
  with check (bucket_id = 'poster-templates' and public.is_admin());

drop policy if exists "Admins can delete poster templates" on storage.objects;
create policy "Admins can delete poster templates"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'poster-templates' and public.is_admin());
