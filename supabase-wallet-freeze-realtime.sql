-- Run once in the Supabase SQL editor so seller wallets update immediately
-- when their balance or frozen amount changes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wallet_transactions'
  ) then
    alter publication supabase_realtime add table public.wallet_transactions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'balance_locks'
  ) then
    alter publication supabase_realtime add table public.balance_locks;
  end if;
end;
$$;
