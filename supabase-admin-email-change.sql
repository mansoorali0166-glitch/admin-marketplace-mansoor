-- Run this migration in the Supabase SQL editor.
-- It lets the currently signed-in administrator change only their own email.

create or replace function public.change_admin_email(new_email text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(trim(coalesce(new_email, '')));
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and lower(role) = 'admin'
  ) then
    raise exception 'Administrator access required.';
  end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address.';
  end if;
  if exists (select 1 from auth.users where lower(email) = normalized_email and id <> auth.uid()) then
    raise exception 'That email address is already in use.';
  end if;

  update auth.users
  set email = normalized_email,
      updated_at = now()
  where id = auth.uid();
  if not found then
    raise exception 'Administrator login not found.';
  end if;

  update public.profiles
  set email = normalized_email,
      updated_at = now()
  where id = auth.uid();

  return normalized_email;
end;
$$;

revoke all on function public.change_admin_email(text) from public;
grant execute on function public.change_admin_email(text) to authenticated;
