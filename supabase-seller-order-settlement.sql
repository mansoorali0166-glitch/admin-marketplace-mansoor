-- Run this migration once in the Supabase SQL editor, after
-- supabase-seller-order-payment.sql. It settles a completed order exactly once.

-- The earlier payment migration used one unique index per order, which prevented
-- the separate settlement credit from being recorded for that same order.
drop index if exists public.wallet_transactions_one_order_payment;
create unique index if not exists wallet_transactions_one_order_debit
  on public.wallet_transactions(order_id)
  where type = 'Order Debit';
create unique index if not exists wallet_transactions_one_order_settlement
  on public.wallet_transactions(order_id)
  where type = 'Order Settlement';

drop function if exists public.settle_order_status(uuid, text);
drop function if exists public.settle_order_status(bigint, text);
drop function if exists public.settle_order_status(text, text);
create or replace function public.settle_order_status(target_order_id text, new_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order public.orders%rowtype;
  normalized_status text := trim(new_status);
  settlement_amount numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if not (public.is_admin() or public.is_agent()) then
    raise exception 'Administrator or agent access required.';
  end if;
  if normalized_status not in ('Pending Payment', 'Paid', 'Pending Ship', 'Pending Receive', 'Completed', 'Rejected', 'Cancelled', 'Refund') then
    raise exception 'Invalid order status.';
  end if;

  select * into target_order
  from public.orders
  where id::text = trim(target_order_id)
  for update;
  if not found then
    raise exception 'Order not found.';
  end if;
  if public.is_agent() and not exists (
    select 1 from public.profiles seller
    where seller.id = target_order.seller_id and seller.agent_id = auth.uid()
  ) then
    raise exception 'This order is not assigned to you.';
  end if;

  -- Only the first transition into Completed creates a credit. The unique
  -- index provides a second safety net for retries and concurrent requests.
  if normalized_status = 'Completed' and lower(trim(target_order.status)) <> 'completed' then
    settlement_amount := round(target_order.sell_price * target_order.quantity, 2);
    insert into public.wallet_transactions (seller_id, type, amount, note, order_id)
    values (
      target_order.seller_id,
      'Order Settlement',
      settlement_amount,
      'Completed order ' || target_order.order_no || ': cost price and profit credited',
      target_order.id
    )
    on conflict do nothing;
  end if;

  update public.orders
  set status = normalized_status, updated_at = now()
  where id = target_order.id;

  return jsonb_build_object(
    'order_id', target_order.id,
    'status', normalized_status,
    'settlement_amount', coalesce(settlement_amount, 0)
  );
end;
$$;

revoke all on function public.settle_order_status(text, text) from public;
grant execute on function public.settle_order_status(text, text) to authenticated;

-- Status changes must use the settlement function above; direct updates would
-- otherwise allow a Completed order without its wallet credit.
drop policy if exists "orders admin write" on public.orders;
drop policy if exists "orders agent update" on public.orders;
