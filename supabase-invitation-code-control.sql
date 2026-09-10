-- Run once in Supabase Dashboard > SQL Editor.
-- Adds an independent enable/disable switch for every agent invitation code.

alter table public.profiles
add column if not exists invitation_code_enabled boolean not null default true;

update public.profiles
set invitation_code = 'P' || upper(substr(replace(id::text, '-', ''), 1, 8))
where role = 'agent' and invitation_code is null;

create unique index if not exists profiles_invitation_code_unique
on public.profiles (upper(invitation_code)) where invitation_code is not null;

create or replace function public.verify_agent_invitation_code(invitation_code_input text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles
    where role='agent'
      and invitation_code_enabled=true
      and upper(invitation_code)=upper(trim(invitation_code_input))
  );
$$;

revoke all on function public.verify_agent_invitation_code(text) from public;
grant execute on function public.verify_agent_invitation_code(text) to anon,authenticated;
