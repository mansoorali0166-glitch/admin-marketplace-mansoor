-- Run this migration in the Supabase SQL editor.
-- Sellers can edit their own bank card unless their assigned agent enables Lock Bank Card.

drop policy if exists "payments insert own" on public.payment_methods;
drop policy if exists "payments update own" on public.payment_methods;

create policy "payments insert own" on public.payment_methods
for insert to authenticated with check (
  seller_id = auth.uid() and (
    method_type <> 'bank_card' or not coalesce((
      select bank_card_locked from public.profiles where id = auth.uid()
    ), false)
  )
);

create policy "payments update own" on public.payment_methods
for update to authenticated using (
  seller_id = auth.uid() and (
    method_type <> 'bank_card' or not coalesce((
      select bank_card_locked from public.profiles where id = auth.uid()
    ), false)
  )
) with check (
  seller_id = auth.uid() and (
    method_type <> 'bank_card' or not coalesce((
      select bank_card_locked from public.profiles where id = auth.uid()
    ), false)
  )
);
