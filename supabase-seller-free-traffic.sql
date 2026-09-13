-- Run once in Supabase Dashboard > SQL Editor.
-- Gives every seller one permanent, server-generated free traffic reward.

alter table public.profiles add column if not exists free_traffic_claimed_at timestamptz;
alter table public.profiles add column if not exists free_traffic_amount integer;

drop function if exists public.collect_seller_traffic();
drop function if exists public.set_seller_traffic_boost(boolean);

create or replace function public.claim_seller_free_traffic()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  seller_profile public.profiles%rowtype;
  reward_amount integer;
  claimed_at timestamptz := clock_timestamp();
begin
  select * into seller_profile
  from public.profiles
  where id = auth.uid() and role = 'seller'
  for update;

  if not found then
    raise exception 'Seller account required';
  end if;
  if seller_profile.free_traffic_claimed_at is not null then
    raise exception 'This free traffic package has already been claimed';
  end if;

  reward_amount := floor(random() * 3000)::integer + 1;

  update public.profiles
  set free_traffic_claimed_at = claimed_at,
      free_traffic_amount = reward_amount
  where id = auth.uid();

  insert into public.merchant_clicks (seller_id, source, created_by, created_at)
  select auth.uid(), 'free-traffic-package', auth.uid(), claimed_at
  from generate_series(1, reward_amount);

  return jsonb_build_object('amount', reward_amount, 'claimed_at', claimed_at);
end;
$$;

revoke all on function public.claim_seller_free_traffic() from public;
grant execute on function public.claim_seller_free_traffic() to authenticated;
