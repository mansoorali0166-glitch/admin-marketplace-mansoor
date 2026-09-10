-- Run once in Supabase Dashboard > SQL Editor.
-- Enables secure, realtime chat between admins, agents, and merchants.

-- Bring older deployments up to the columns used by the current portals.
alter table public.announcements add column if not exists target_type text not null default 'all';
alter table public.announcements add column if not exists target_user_id uuid references public.profiles(id) on delete set null;
alter table public.announcements add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.messages add column if not exists channel text not null default 'service';
alter table public.messages add column if not exists image_url text;
alter table public.messages add column if not exists read_at timestamptz;

alter table public.messages enable row level security;
alter table public.announcements enable row level security;

drop policy if exists "messages read participants" on public.messages;
drop policy if exists "messages send self" on public.messages;
drop policy if exists "messages update recipient" on public.messages;
create policy "messages read participants" on public.messages for select to authenticated
using (sender_id=auth.uid() or recipient_id=auth.uid() or public.is_admin());
create policy "messages send self" on public.messages for insert to authenticated
with check (sender_id=auth.uid() and recipient_id is not null);
create policy "messages update recipient" on public.messages for update to authenticated
using (recipient_id=auth.uid() or public.is_admin())
with check (recipient_id=auth.uid() or public.is_admin());

drop policy if exists "announcements read targeted" on public.announcements;
drop policy if exists "announcements admin write" on public.announcements;
create policy "announcements read targeted" on public.announcements for select to authenticated
using (target_type='all' or target_user_id=auth.uid() or public.is_admin());
create policy "announcements admin write" on public.announcements for all to authenticated
using (public.is_admin()) with check (public.is_admin());

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.announcements;
exception when duplicate_object then null;
end $$;
