-- Run this migration in the Supabase SQL editor.
-- It permits only administrators to set a new password for an agent.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.reset_agent_password(target_agent_id uuid, new_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;
  if length(coalesce(new_password, '')) < 6 or length(new_password) > 72 then
    raise exception 'Password must contain 6 to 72 characters.';
  end if;
  if not exists (select 1 from public.profiles where id = target_agent_id and role = 'agent') then
    raise exception 'Agent not found.';
  end if;

  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  where id = target_agent_id;
  if not found then
    raise exception 'Agent login not found.';
  end if;

  delete from auth.sessions where user_id = target_agent_id;
end;
$$;

revoke all on function public.reset_agent_password(uuid, text) from public;
grant execute on function public.reset_agent_password(uuid, text) to authenticated;
