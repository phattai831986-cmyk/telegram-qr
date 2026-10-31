alter table public.transfer_profiles
  add column if not exists id uuid;

update public.transfer_profiles
set id = gen_random_uuid()
where id is null;

alter table public.transfer_profiles
  alter column id set default gen_random_uuid(),
  alter column id set not null;

alter table public.transfer_profiles
  drop constraint if exists transfer_profiles_pkey;

alter table public.transfer_profiles
  add constraint transfer_profiles_pkey primary key (id);

alter table public.transfer_profiles
  add column if not exists is_default boolean not null default false;

with first_profile_per_user as (
  select id, row_number() over (partition by user_id order by updated_at desc, id) as position
  from public.transfer_profiles
  where not exists (
    select 1
    from public.transfer_profiles as existing_default
    where existing_default.user_id = transfer_profiles.user_id
      and existing_default.is_default
  )
)
update public.transfer_profiles
set is_default = true
where id in (select id from first_profile_per_user where position = 1);

create unique index if not exists transfer_profiles_owner_account_key
  on public.transfer_profiles (user_id, bank_bin, account_number);

create unique index if not exists transfer_profiles_one_default_per_user
  on public.transfer_profiles (user_id)
  where is_default;

create or replace function public.set_default_transfer_profile(profile_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.transfer_profiles
  set is_default = false
  where user_id = (select auth.uid())
    and is_default;

  update public.transfer_profiles
  set is_default = true
  where id = profile_id
    and user_id = (select auth.uid());

  if not found then
    raise exception 'Transfer profile not found for the current user';
  end if;
end;
$$;

revoke all on function public.set_default_transfer_profile(uuid) from public, anon;
grant execute on function public.set_default_transfer_profile(uuid) to authenticated;
