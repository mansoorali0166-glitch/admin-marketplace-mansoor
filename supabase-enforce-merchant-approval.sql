-- Run once in Supabase Dashboard > SQL Editor.
-- Pending or rejected merchant applications cannot access seller accounts.

alter table public.profiles add column if not exists allow_login boolean not null default true;
alter table public.profiles add column if not exists registration_status text not null default 'Approved'
  check (registration_status in ('Pending','Approved','Rejected'));

create or replace function public.sync_merchant_approval_gate()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.profiles
  set registration_status=new.status,
      allow_login=(new.status='Approved')
  where id=new.seller_id and role='seller';
  return new;
end; $$;

drop trigger if exists merchant_application_approval_gate on public.merchant_applications;
create trigger merchant_application_approval_gate
after insert or update of status on public.merchant_applications
for each row execute function public.sync_merchant_approval_gate();

-- Repair existing accounts to match their application decision.
update public.profiles profiles
set registration_status=applications.status,
    allow_login=(applications.status='Approved')
from public.merchant_applications applications
where profiles.id=applications.seller_id and profiles.role='seller';
