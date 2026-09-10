-- Run this file once in Supabase Dashboard > SQL Editor.
-- Agents may request profile changes. Only an admin can approve or deny them.

create extension if not exists pgcrypto;

create table if not exists public.agent_profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  requested_display_name text not null,
  requested_company_name text,
  requested_phone text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists one_pending_agent_profile_request
  on public.agent_profile_change_requests(agent_id)
  where status = 'pending';

alter table public.agent_profile_change_requests enable row level security;

drop policy if exists "agents read own profile requests" on public.agent_profile_change_requests;
create policy "agents read own profile requests"
  on public.agent_profile_change_requests for select
  using (agent_id = auth.uid() or public.is_admin());

drop policy if exists "agents create own profile requests" on public.agent_profile_change_requests;
create policy "agents create own profile requests"
  on public.agent_profile_change_requests for insert
  with check (
    agent_id = auth.uid()
    and status = 'pending'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'agent')
  );

drop policy if exists "admins update profile requests" on public.agent_profile_change_requests;
create policy "admins update profile requests"
  on public.agent_profile_change_requests for update
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.review_agent_profile_change(request_id uuid, decision text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_request public.agent_profile_change_requests%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if decision not in ('approved', 'denied') then
    raise exception 'Decision must be approved or denied';
  end if;

  select * into profile_request
  from public.agent_profile_change_requests
  where id = request_id and status = 'pending'
  for update;
  if not found then
    raise exception 'Pending profile request not found';
  end if;

  if decision = 'approved' then
    update public.profiles
    set display_name = profile_request.requested_display_name,
        company_name = profile_request.requested_company_name,
        phone = profile_request.requested_phone
    where id = profile_request.agent_id and role = 'agent';
  end if;

  update public.agent_profile_change_requests
  set status = decision, reviewed_by = auth.uid(), reviewed_at = now()
  where id = request_id;
  return true;
end;
$$;

grant select, insert on public.agent_profile_change_requests to authenticated;
grant execute on function public.review_agent_profile_change(uuid, text) to authenticated;
