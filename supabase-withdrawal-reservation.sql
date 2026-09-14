-- Run once in the Supabase SQL editor.
-- New withdrawals debit immediately; rejection refunds once; approval adds no ledger entry.
create extension if not exists pgcrypto with schema extensions;

alter table public.wallet_transactions add column if not exists withdrawal_id text;
create unique index if not exists wallet_transactions_one_withdrawal_event
  on public.wallet_transactions(withdrawal_id, type)
  where withdrawal_id is not null;

create or replace function public.request_seller_withdrawal(
  withdrawal_amount numeric,
  withdrawal_method text,
  withdrawal_account text,
  supplied_trade_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  seller_profile public.profiles%rowtype;
  new_withdrawal public.withdrawals%rowtype;
  wallet_balance numeric(12,2);
  frozen_balance numeric(12,2);
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if withdrawal_amount is null or withdrawal_amount <= 0 then raise exception 'Enter a valid withdrawal amount.'; end if;
  if trim(coalesce(withdrawal_method, '')) = '' or trim(coalesce(withdrawal_account, '')) = '' then
    raise exception 'Choose a withdrawal method and account.';
  end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select * into seller_profile from public.profiles where id = auth.uid() and role = 'seller' for update;
  if not found then raise exception 'Seller profile not found.'; end if;
  if seller_profile.allow_withdraw = false then raise exception 'Your withdrawals have been locked. Please contact your agent.'; end if;
  if withdrawal_method = 'Bank Card' and seller_profile.bank_card_locked then raise exception 'Your bank card has been temporarily locked.'; end if;
  if seller_profile.trade_password_hash is null then raise exception 'Set your trade password before withdrawing.'; end if;
  if crypt(coalesce(supplied_trade_password, ''), seller_profile.trade_password_hash) <> seller_profile.trade_password_hash then
    raise exception 'Trade password is incorrect.';
  end if;
  select coalesce(sum(amount), 0) into wallet_balance from public.wallet_transactions where seller_id = auth.uid();
  select coalesce(sum(amount), 0) into frozen_balance from public.balance_locks
    where seller_id = auth.uid() and lower(status) = 'active' and (lock_until is null or lock_until > now());
  if wallet_balance - frozen_balance < withdrawal_amount then raise exception 'Insufficient available balance.'; end if;

  insert into public.withdrawals(seller_id, amount, method, account_details, status)
  values (auth.uid(), round(withdrawal_amount, 2), withdrawal_method, withdrawal_account, 'Pending')
  returning * into new_withdrawal;
  insert into public.wallet_transactions(seller_id, type, amount, note, withdrawal_id)
  values (auth.uid(), 'Withdrawal Debit', -round(withdrawal_amount, 2), 'Withdrawal request #' || new_withdrawal.id, new_withdrawal.id::text);
  return to_jsonb(new_withdrawal);
end;
$$;

create or replace function public.review_seller_withdrawal(
  target_withdrawal_id text,
  review_decision text,
  review_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare target_withdrawal public.withdrawals%rowtype;
begin
  if not (public.is_admin() or public.is_agent()) then raise exception 'Not authorized.'; end if;
  select * into target_withdrawal from public.withdrawals where id::text = target_withdrawal_id for update;
  if not found then raise exception 'Withdrawal not found.'; end if;
  if public.is_agent() and not exists (
    select 1 from public.profiles where id = target_withdrawal.seller_id and agent_id = auth.uid()
  ) then raise exception 'This seller is not assigned to you.'; end if;
  if target_withdrawal.status <> 'Pending' then raise exception 'This request was already processed.'; end if;

  if lower(review_decision) = 'approved' then
    update public.withdrawals set status = 'Approved', updated_at = now() where id::text = target_withdrawal_id;
  elsif lower(review_decision) = 'rejected' then
    update public.withdrawals set status = 'Rejected', rejection_reason = nullif(trim(review_reason), ''), updated_at = now()
      where id::text = target_withdrawal_id;
    if exists (select 1 from public.wallet_transactions where withdrawal_id = target_withdrawal_id and type = 'Withdrawal Debit') then
      insert into public.wallet_transactions(seller_id, type, amount, note, withdrawal_id)
      values (target_withdrawal.seller_id, 'Withdrawal Refund', target_withdrawal.amount,
        'Refund for rejected withdrawal #' || target_withdrawal.id, target_withdrawal.id::text);
    end if;
  else
    raise exception 'Decision must be Approved or Rejected.';
  end if;
  return jsonb_build_object('id', target_withdrawal.id, 'status', initcap(lower(review_decision)));
end;
$$;

revoke all on function public.request_seller_withdrawal(numeric, text, text, text) from public;
revoke all on function public.review_seller_withdrawal(text, text, text) from public;
grant execute on function public.request_seller_withdrawal(numeric, text, text, text) to authenticated;
grant execute on function public.review_seller_withdrawal(text, text, text) to authenticated;
