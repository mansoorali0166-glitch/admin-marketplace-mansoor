-- Run once in the Supabase SQL Editor for an existing installation.
-- Each agent is limited to sellers assigned through profiles.agent_id.

drop policy if exists "showcase assigned agent insert" on public.showcase_products;
drop policy if exists "showcase assigned agent update" on public.showcase_products;
drop policy if exists "withdrawals assigned agent update" on public.withdrawals;

create policy "showcase assigned agent insert"
on public.showcase_products for insert to authenticated
with check (
  public.is_agent() and exists (
    select 1 from public.profiles seller
    where seller.id=showcase_products.seller_id and seller.agent_id=auth.uid()
  )
);

create policy "showcase assigned agent update"
on public.showcase_products for update to authenticated
using (
  public.is_agent() and exists (
    select 1 from public.profiles seller
    where seller.id=showcase_products.seller_id and seller.agent_id=auth.uid()
  )
)
with check (
  public.is_agent() and exists (
    select 1 from public.profiles seller
    where seller.id=showcase_products.seller_id and seller.agent_id=auth.uid()
  )
);

create policy "withdrawals assigned agent update"
on public.withdrawals for update to authenticated
using (
  public.is_agent() and exists (
    select 1 from public.profiles seller
    where seller.id=withdrawals.seller_id and seller.agent_id=auth.uid()
  )
)
with check (
  public.is_agent() and exists (
    select 1 from public.profiles seller
    where seller.id=withdrawals.seller_id and seller.agent_id=auth.uid()
  )
);
