-- Run in Supabase Dashboard > SQL Editor after supabase-merchant-registration.sql.
-- Lets an agent transfer only merchants that they previously approved.

create or replace function public.list_transfer_agents()
returns table (agent_id uuid, name text, email text)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if auth.uid() is null or not public.is_agent() then
    raise exception 'Agent access is required';
  end if;

  return query
  select profiles.id, coalesce(nullif(profiles.display_name, ''), profiles.email), profiles.email
  from public.profiles profiles
  where profiles.role = 'agent'
    and profiles.id <> auth.uid()
  order by coalesce(nullif(profiles.display_name, ''), profiles.email), profiles.email;
end;
$$;

create or replace function public.transfer_merchant_to_agent(
  target_seller_id uuid,
  target_agent_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null or not public.is_agent() then
    raise exception 'Agent access is required';
  end if;

  if target_agent_id = auth.uid() then
    raise exception 'Choose a different destination agent';
  end if;

  if not exists (
    select 1
    from public.profiles agent
    where agent.id = target_agent_id and agent.role = 'agent'
  ) then
    raise exception 'The destination agent is not available';
  end if;

  if not exists (
    select 1
    from public.merchant_applications application
    join public.profiles seller on seller.id = application.seller_id
    where application.seller_id = target_seller_id
      and application.agent_id = auth.uid()
      and application.status = 'Approved'
      and seller.role = 'seller'
      and seller.agent_id = auth.uid()
      and seller.registration_status = 'Approved'
  ) then
    raise exception 'This approved merchant is not assigned to you';
  end if;

  update public.profiles
  set agent_id = target_agent_id
  where id = target_seller_id and role = 'seller';

  -- The approval travels with the merchant so the receiving agent sees the
  -- merchant immediately, while pending and rejected applications remain hidden.
  update public.merchant_applications
  set agent_id = target_agent_id
  where seller_id = target_seller_id and status = 'Approved';
end;
$$;

revoke all on function public.list_transfer_agents() from public;
revoke all on function public.transfer_merchant_to_agent(uuid, uuid) from public;
grant execute on function public.list_transfer_agents() to authenticated;
grant execute on function public.transfer_merchant_to_agent(uuid, uuid) to authenticated;

-- Make the new RPC endpoints available to Supabase's REST schema cache immediately.
notify pgrst, 'reload schema';
