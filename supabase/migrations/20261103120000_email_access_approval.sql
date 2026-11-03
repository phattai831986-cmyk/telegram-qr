create table if not exists public.app_access_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_access_admins enable row level security;
revoke all on public.app_access_admins from public, anon, authenticated;

create table if not exists public.app_access_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);

alter table public.app_access_requests enable row level security;
revoke all on public.app_access_requests from public, anon, authenticated;

create or replace function public.get_app_access_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  user_is_admin boolean;
  access_status text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from public.app_access_admins as admins
    where admins.user_id = current_user_id
  ) into user_is_admin;

  if user_is_admin then
    return jsonb_build_object('status', 'approved', 'is_admin', true);
  end if;

  select requests.status
  into access_status
  from public.app_access_requests as requests
  where requests.user_id = current_user_id;

  return jsonb_build_object(
    'status', coalesce(access_status, 'not_requested'),
    'is_admin', false
  );
end;
$$;

create or replace function public.request_app_access()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  requested_status text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if exists (
    select 1
    from public.app_access_admins as admins
    where admins.user_id = current_user_id
  ) then
    return 'approved';
  end if;

  insert into public.app_access_requests (user_id)
  values (current_user_id)
  on conflict (user_id) do update
  set status = case
        when public.app_access_requests.status = 'approved' then 'approved'
        else 'pending'
      end,
      requested_at = case
        when public.app_access_requests.status = 'approved'
          then public.app_access_requests.requested_at
        else now()
      end,
      reviewed_at = case
        when public.app_access_requests.status = 'approved'
          then public.app_access_requests.reviewed_at
        else null
      end,
      reviewed_by = case
        when public.app_access_requests.status = 'approved'
          then public.app_access_requests.reviewed_by
        else null
      end
  returning status into requested_status;

  return requested_status;
end;
$$;

create or replace function public.list_app_access_requests()
returns table (
  user_id uuid,
  email text,
  status text,
  requested_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.app_access_admins as admins
    where admins.user_id = (select auth.uid())
  ) then
    raise exception 'Access administrator permission required';
  end if;

  return query
  select requests.user_id, users.email::text, requests.status,
    requests.requested_at, requests.reviewed_at
  from public.app_access_requests as requests
  join auth.users as users on users.id = requests.user_id
  order by (requests.status = 'pending') desc, requests.requested_at asc;
end;
$$;

create or replace function public.review_app_access_request(
  target_user_id uuid,
  approved boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.app_access_admins as admins
    where admins.user_id = (select auth.uid())
  ) then
    raise exception 'Access administrator permission required';
  end if;

  if target_user_id is null or approved is null then
    raise exception 'A target user and review decision are required';
  end if;

  update public.app_access_requests
  set status = case when approved then 'approved' else 'denied' end,
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
  where user_id = target_user_id;

  if not found then
    raise exception 'Access request not found';
  end if;
end;
$$;

revoke all on function public.get_app_access_state() from public, anon;
revoke all on function public.request_app_access() from public, anon;
revoke all on function public.list_app_access_requests() from public, anon;
revoke all on function public.review_app_access_request(uuid, boolean) from public, anon;
grant execute on function public.get_app_access_state() to authenticated;
grant execute on function public.request_app_access() to authenticated;
grant execute on function public.list_app_access_requests() to authenticated;
grant execute on function public.review_app_access_request(uuid, boolean) to authenticated;
