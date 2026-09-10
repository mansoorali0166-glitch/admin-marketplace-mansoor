-- Run once in Supabase Dashboard > SQL Editor.
-- Permanently removes an agent's Auth login while retaining an admin audit row.

create table if not exists public.deleted_agents (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  email text not null,
  display_name text,
  company_name text,
  invitation_code text,
  previous_status text,
  deleted_by uuid,
  deleted_at timestamptz not null default now()
);

alter table public.deleted_agents enable row level security;
drop policy if exists "deleted agents admin read" on public.deleted_agents;
create policy "deleted agents admin read" on public.deleted_agents for select to authenticated using (public.is_admin());

create or replace function public.delete_agent_permanently(target_agent_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,auth
as $$
declare target_agent public.profiles%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  select * into target_agent from public.profiles where id=target_agent_id and role='agent';
  if target_agent.id is null then raise exception 'Agent not found'; end if;

  insert into public.deleted_agents(agent_id,email,display_name,company_name,invitation_code,previous_status,deleted_by)
  values(target_agent.id::text,target_agent.email,target_agent.display_name,target_agent.company_name,target_agent.invitation_code,target_agent.status,auth.uid());

  update public.profiles set agent_id=null where agent_id=target_agent_id;
  delete from public.merchant_applications where agent_id=target_agent_id;
  delete from public.messages where sender_id=target_agent_id or recipient_id=target_agent_id;
  update public.announcements set created_by=null where created_by=target_agent_id;
  update public.announcements set target_user_id=null where target_user_id=target_agent_id;
  update public.merchant_clicks set created_by=null where created_by=target_agent_id;
  update public.balance_locks set created_by=null where created_by=target_agent_id;

  -- Older projects use a restrictive profiles -> auth.users foreign key,
  -- so remove the fully detached public profile before the Auth account.
  delete from public.profiles where id=target_agent_id and role='agent';
  if not found then raise exception 'Agent profile could not be deleted'; end if;

  delete from auth.users where id=target_agent_id;
  if not found then raise exception 'Agent authentication account not found'; end if;
  return true;
end;
$$;

revoke all on function public.delete_agent_permanently(uuid) from public;
grant execute on function public.delete_agent_permanently(uuid) to authenticated;

-- Make the new RPC available to the website immediately.
notify pgrst, 'reload schema';
