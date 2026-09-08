-- Run this once in Supabase SQL Editor to enable the Agent portal to work
-- with the same seller records used by the Admin and Seller portals.
create or replace function public.is_agent() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='agent');
$$;

create table if not exists public.balance_locks (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  reason text,
  status text not null default 'Active',
  lock_until timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  released_at timestamptz
);
alter table public.balance_locks enable row level security;

drop policy if exists "showcase agent read" on public.showcase_products;
drop policy if exists "showcase assigned agent insert" on public.showcase_products;
drop policy if exists "showcase assigned agent update" on public.showcase_products;
drop policy if exists "orders agent read" on public.orders;
drop policy if exists "orders agent update" on public.orders;
drop policy if exists "orders agent insert" on public.orders;
drop policy if exists "feedback agent read" on public.feedback_tickets;
drop policy if exists "feedback agent update" on public.feedback_tickets;
drop policy if exists "withdrawals agent read" on public.withdrawals;
drop policy if exists "withdrawals assigned agent update" on public.withdrawals;
drop policy if exists "transactions agent read" on public.wallet_transactions;
drop policy if exists "transactions agent insert" on public.wallet_transactions;
drop policy if exists "payments agent read" on public.payment_methods;
drop policy if exists "payments agent insert" on public.payment_methods;
drop policy if exists "payments agent update" on public.payment_methods;
drop policy if exists "payments admin insert" on public.payment_methods;
drop policy if exists "payments admin update" on public.payment_methods;
drop policy if exists "balance locks read own admin agent" on public.balance_locks;
drop policy if exists "balance locks admin agent insert" on public.balance_locks;
drop policy if exists "balance locks admin agent update" on public.balance_locks;

create policy "showcase agent read" on public.showcase_products for select to authenticated using (public.is_agent());
create policy "showcase assigned agent insert" on public.showcase_products for insert to authenticated
with check (public.is_agent() and exists (select 1 from public.profiles seller where seller.id=showcase_products.seller_id and seller.agent_id=auth.uid()));
create policy "showcase assigned agent update" on public.showcase_products for update to authenticated
using (public.is_agent() and exists (select 1 from public.profiles seller where seller.id=showcase_products.seller_id and seller.agent_id=auth.uid()))
with check (public.is_agent() and exists (select 1 from public.profiles seller where seller.id=showcase_products.seller_id and seller.agent_id=auth.uid()));
create policy "orders agent read" on public.orders for select to authenticated using (public.is_agent());
create policy "orders agent update" on public.orders for update to authenticated using (public.is_agent()) with check (public.is_agent());
create policy "orders agent insert" on public.orders for insert to authenticated with check (public.is_agent());
create policy "feedback agent read" on public.feedback_tickets for select to authenticated using (public.is_agent());
create policy "feedback agent update" on public.feedback_tickets for update to authenticated using (public.is_agent()) with check (public.is_agent());
create policy "withdrawals agent read" on public.withdrawals for select to authenticated using (public.is_agent());
create policy "withdrawals assigned agent update" on public.withdrawals for update to authenticated
using (public.is_agent() and exists (select 1 from public.profiles seller where seller.id=withdrawals.seller_id and seller.agent_id=auth.uid()))
with check (public.is_agent() and exists (select 1 from public.profiles seller where seller.id=withdrawals.seller_id and seller.agent_id=auth.uid()));
create policy "transactions agent read" on public.wallet_transactions for select to authenticated using (public.is_agent());
create policy "transactions agent insert" on public.wallet_transactions for insert to authenticated with check (public.is_agent());
create policy "payments agent read" on public.payment_methods for select to authenticated using (public.is_agent());
create policy "payments agent insert" on public.payment_methods for insert to authenticated with check (public.is_agent());
create policy "payments agent update" on public.payment_methods for update to authenticated using (public.is_agent()) with check (public.is_agent());
create policy "payments admin insert" on public.payment_methods for insert to authenticated with check (public.is_admin());
create policy "payments admin update" on public.payment_methods for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "balance locks read own admin agent" on public.balance_locks for select to authenticated using (seller_id=auth.uid() or public.is_admin() or public.is_agent());
create policy "balance locks admin agent insert" on public.balance_locks for insert to authenticated with check (public.is_admin() or public.is_agent());
create policy "balance locks admin agent update" on public.balance_locks for update to authenticated using (public.is_admin() or public.is_agent()) with check (public.is_admin() or public.is_agent());

-- Merchant management controls used by both the Admin and Agent portals.
alter table public.profiles add column if not exists agent_id uuid references public.profiles(id);
alter table public.profiles add column if not exists credit_score integer not null default 100 check (credit_score between 0 and 100);
alter table public.profiles add column if not exists merchant_remark text;
alter table public.profiles add column if not exists allow_login boolean not null default true;
alter table public.profiles add column if not exists allow_withdraw boolean not null default true;
alter table public.profiles add column if not exists bank_card_locked boolean not null default false;
alter table public.profiles add column if not exists trade_password_hash text;
alter table public.profiles add column if not exists shop_locked boolean not null default false;
alter table public.profiles add column if not exists showcase_visible boolean not null default true;
alter table public.profiles add column if not exists traffic_enabled boolean not null default true;

create table if not exists public.merchant_clicks (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  ip_address text,
  device text,
  source text not null default 'click',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.merchant_clicks enable row level security;
drop policy if exists "merchant clicks read" on public.merchant_clicks;
drop policy if exists "merchant clicks insert" on public.merchant_clicks;
drop policy if exists "merchant clicks delete" on public.merchant_clicks;
create policy "merchant clicks read" on public.merchant_clicks for select to authenticated
using (seller_id=auth.uid() or public.is_admin() or public.is_agent());
create policy "merchant clicks insert" on public.merchant_clicks for insert to authenticated
with check (public.is_admin() or public.is_agent());
create policy "merchant clicks delete" on public.merchant_clicks for delete to authenticated
using (public.is_admin() or public.is_agent());

drop policy if exists "profile agent update sellers" on public.profiles;
create policy "profile agent update sellers" on public.profiles for update to authenticated
using (public.is_agent() and role='seller') with check (public.is_agent() and role='seller');

create or replace function public.manage_merchant_password(target_user_id uuid, new_password text, new_trade_password text default null)
returns void language plpgsql security definer set search_path=public,auth,extensions as $$
begin
  if not (public.is_admin() or public.is_agent()) then raise exception 'Not authorized'; end if;
  if length(coalesce(new_password,'')) < 6 then raise exception 'Password must contain at least 6 characters'; end if;
  update auth.users set encrypted_password=crypt(new_password,gen_salt('bf')), updated_at=now() where id=target_user_id;
  if new_trade_password is not null and new_trade_password <> '' then
    update public.profiles set trade_password_hash=crypt(new_trade_password,gen_salt('bf')) where id=target_user_id and role='seller';
  end if;
end; $$;

create or replace function public.force_logout_merchant(target_user_id uuid)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
  if not (public.is_admin() or public.is_agent()) then raise exception 'Not authorized'; end if;
  delete from auth.sessions where user_id=target_user_id;
end; $$;

revoke all on function public.manage_merchant_password(uuid,text,text) from public;
revoke all on function public.force_logout_merchant(uuid) from public;
grant execute on function public.manage_merchant_password(uuid,text,text) to authenticated;
grant execute on function public.force_logout_merchant(uuid) to authenticated;
