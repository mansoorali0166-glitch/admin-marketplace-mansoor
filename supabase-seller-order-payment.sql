-- Run this migration once in the Supabase SQL editor.
-- It keeps trade passwords hashed and makes each order payment atomic/idempotent.
create extension if not exists pgcrypto with schema extensions;

alter table public.profiles add column if not exists trade_password_hash text;
alter table public.wallet_transactions add column if not exists order_id uuid references public.orders(id) on delete restrict;
create unique index if not exists wallet_transactions_one_order_payment
  on public.wallet_transactions(order_id)
  where order_id is not null;

create or replace function public.set_seller_trade_password(new_trade_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if length(coalesce(new_trade_password, '')) < 6 or length(new_trade_password) > 20 then
    raise exception 'Trade password must contain 6–20 characters.';
  end if;
  update public.profiles
  set trade_password_hash = crypt(new_trade_password, gen_salt('bf'))
  where id = auth.uid() and role = 'seller';
  if not found then raise exception 'Seller profile not found.'; end if;
end;
$$;

create or replace function public.change_seller_trade_password(current_trade_password text, new_trade_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare saved_hash text;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select trade_password_hash into saved_hash from public.profiles where id = auth.uid() and role = 'seller';
  if saved_hash is not null and crypt(coalesce(current_trade_password, ''), saved_hash) <> saved_hash then
    raise exception 'Current trade password is incorrect.';
  end if;
  if length(coalesce(new_trade_password, '')) < 6 or length(new_trade_password) > 20 then
    raise exception 'Trade password must contain 6–20 characters.';
  end if;
  update public.profiles set trade_password_hash = crypt(new_trade_password, gen_salt('bf')) where id = auth.uid();
end;
$$;

create or replace function public.pay_seller_order(target_order_id uuid, supplied_trade_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_order public.orders%rowtype;
  saved_hash text;
  order_amount numeric(12,2);
  wallet_balance numeric(12,2);
  frozen_balance numeric(12,2);
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

  select * into target_order from public.orders
  where id = target_order_id and seller_id = auth.uid()
  for update;
  if not found then raise exception 'Order not found.'; end if;
  if lower(trim(target_order.status)) not in ('pending payment', 'pending pay') then
    raise exception 'This order is not awaiting payment.';
  end if;

  select trade_password_hash into saved_hash from public.profiles where id = auth.uid() and role = 'seller';
  if saved_hash is null then raise exception 'Set your bank card trade password before paying.'; end if;
  if crypt(coalesce(supplied_trade_password, ''), saved_hash) <> saved_hash then
    raise exception 'Trade password is incorrect.';
  end if;

  order_amount := round(target_order.cost_price * target_order.quantity, 2);
  select coalesce(sum(amount), 0) into wallet_balance from public.wallet_transactions where seller_id = auth.uid();
  select coalesce(sum(amount), 0) into frozen_balance from public.balance_locks
    where seller_id = auth.uid() and lower(status) = 'active' and (lock_until is null or lock_until > now());
  if wallet_balance - frozen_balance < order_amount then raise exception 'Insufficient available balance.'; end if;

  insert into public.wallet_transactions(seller_id, type, amount, note, order_id)
  values (auth.uid(), 'Order Debit', -order_amount, 'Payment for order ' || target_order.order_no, target_order.id);
  update public.orders set status = 'Pending Ship', updated_at = now() where id = target_order.id;

  return jsonb_build_object('order_id', target_order.id, 'status', 'Pending Ship', 'amount', order_amount,
    'balance', wallet_balance - order_amount);
end;
$$;

revoke all on function public.set_seller_trade_password(text) from public;
revoke all on function public.change_seller_trade_password(text, text) from public;
revoke all on function public.pay_seller_order(uuid, text) from public;
grant execute on function public.set_seller_trade_password(text) to authenticated;
grant execute on function public.change_seller_trade_password(text, text) to authenticated;
grant execute on function public.pay_seller_order(uuid, text) to authenticated;
