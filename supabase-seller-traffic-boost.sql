-- Run once in Supabase Dashboard > SQL Editor.
-- Enforces one traffic collection per rolling 24 hours and a two-hour boost.

alter table public.profiles add column if not exists traffic_collected_at timestamptz;
alter table public.profiles add column if not exists traffic_boost_expires_at timestamptz;
alter table public.profiles add column if not exists traffic_boost_enabled boolean not null default false;
alter table public.profiles add column if not exists traffic_enabled boolean not null default true;

create or replace function public.collect_seller_traffic()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  seller_profile public.profiles%rowtype;
  collected_at timestamptz := clock_timestamp();
begin
  select * into seller_profile
  from public.profiles
  where id = auth.uid() and role = 'seller'
  for update;

  if not found then
    raise exception 'Seller account required';
  end if;
  if seller_profile.traffic_enabled is false then
    raise exception 'Traffic is disabled for this account';
  end if;
  if seller_profile.traffic_collected_at is not null
     and seller_profile.traffic_collected_at + interval '24 hours' > collected_at then
    raise exception 'Traffic can only be collected once every 24 hours';
  end if;

  update public.profiles
  set traffic_collected_at = collected_at,
      traffic_boost_expires_at = collected_at + interval '2 hours',
      traffic_boost_enabled = true
  where id = auth.uid();

  return jsonb_build_object(
    'traffic_collected_at', collected_at,
    'traffic_boost_expires_at', collected_at + interval '2 hours',
    'traffic_boost_enabled', true,
    'next_collection_at', collected_at + interval '24 hours'
  );
end;
$$;

create or replace function public.set_seller_traffic_boost(enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  seller_profile public.profiles%rowtype;
begin
  select * into seller_profile
  from public.profiles
  where id = auth.uid() and role = 'seller'
  for update;

  if not found then
    raise exception 'Seller account required';
  end if;
  if seller_profile.traffic_enabled is false then
    raise exception 'Traffic is disabled for this account';
  end if;
  if seller_profile.traffic_boost_expires_at is null
     or seller_profile.traffic_boost_expires_at <= clock_timestamp() then
    update public.profiles set traffic_boost_enabled = false where id = auth.uid();
    raise exception 'The two-hour traffic boost has expired';
  end if;

  update public.profiles
  set traffic_boost_enabled = enabled
  where id = auth.uid();

  return jsonb_build_object(
    'traffic_boost_enabled', enabled,
    'traffic_boost_expires_at', seller_profile.traffic_boost_expires_at
  );
end;
$$;

revoke all on function public.collect_seller_traffic() from public;
revoke all on function public.set_seller_traffic_boost(boolean) from public;
grant execute on function public.collect_seller_traffic() to authenticated;
grant execute on function public.set_seller_traffic_boost(boolean) to authenticated;
