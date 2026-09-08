-- Run this migration in the Supabase SQL editor after deploying the matching UI.
-- It lets an authenticated agent operate only on sellers assigned to that agent.

create or replace function public.agent_manages_seller(target_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_agent() and exists (
    select 1
    from public.profiles seller
    where seller.id = target_seller_id
      and seller.role = 'seller'
      and seller.agent_id = auth.uid()
  );
$$;

grant execute on function public.agent_manages_seller(uuid) to authenticated;

drop policy if exists "messages assigned agent read" on public.messages;
drop policy if exists "messages assigned agent insert" on public.messages;
create policy "messages assigned agent read" on public.messages
for select to authenticated using (
  public.agent_manages_seller(sender_id) or public.agent_manages_seller(recipient_id)
);
create policy "messages assigned agent insert" on public.messages
for insert to authenticated with check (public.agent_manages_seller(sender_id));

drop policy if exists "withdrawals assigned agent read" on public.withdrawals;
drop policy if exists "withdrawals assigned agent insert" on public.withdrawals;
create policy "withdrawals assigned agent read" on public.withdrawals
for select to authenticated using (public.agent_manages_seller(seller_id));
create policy "withdrawals assigned agent insert" on public.withdrawals
for insert to authenticated with check (public.agent_manages_seller(seller_id));

drop policy if exists "feedback assigned agent read" on public.feedback_tickets;
drop policy if exists "feedback assigned agent insert" on public.feedback_tickets;
create policy "feedback assigned agent read" on public.feedback_tickets
for select to authenticated using (public.agent_manages_seller(seller_id));
create policy "feedback assigned agent insert" on public.feedback_tickets
for insert to authenticated with check (public.agent_manages_seller(seller_id));

-- Replace the older broad agent payment policies with assigned-seller policies.
drop policy if exists "payments agent read" on public.payment_methods;
drop policy if exists "payments agent insert" on public.payment_methods;
drop policy if exists "payments agent update" on public.payment_methods;
drop policy if exists "payments assigned agent read" on public.payment_methods;
drop policy if exists "payments assigned agent insert" on public.payment_methods;
drop policy if exists "payments assigned agent update" on public.payment_methods;
create policy "payments assigned agent read" on public.payment_methods
for select to authenticated using (public.agent_manages_seller(seller_id));
create policy "payments assigned agent insert" on public.payment_methods
for insert to authenticated with check (public.agent_manages_seller(seller_id));
create policy "payments assigned agent update" on public.payment_methods
for update to authenticated using (public.agent_manages_seller(seller_id))
with check (public.agent_manages_seller(seller_id));
