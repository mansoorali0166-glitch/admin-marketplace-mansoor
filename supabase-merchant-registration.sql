-- Run once in Supabase Dashboard > SQL Editor.
-- Adds seller applications tied to an agent invitation code.

alter table public.profiles add column if not exists agent_id uuid references public.profiles(id);
alter table public.profiles add column if not exists allow_login boolean not null default true;
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists invitation_code text;
alter table public.profiles add column if not exists registration_status text not null default 'Approved'
  check (registration_status in ('Pending','Approved','Rejected'));

with ranked_agents as (
  select id,row_number() over (order by created_at,id) as position
  from public.profiles where role='agent' and invitation_code is null
)
update public.profiles profile
set invitation_code = case when ranked_agents.position=1 then 'P516326U' else 'P' || upper(substr(replace(profile.id::text, '-', ''), 1, 8)) end
from ranked_agents where profile.id=ranked_agents.id;

create unique index if not exists profiles_invitation_code_unique
on public.profiles (upper(invitation_code)) where invitation_code is not null;

create table if not exists public.merchant_applications (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null unique references public.profiles(id) on delete cascade,
  agent_id uuid not null references public.profiles(id),
  name text not null,
  email text not null,
  address text not null,
  phone text not null default '',
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table public.merchant_applications add column if not exists phone text not null default '';

alter table public.merchant_applications enable row level security;
drop policy if exists "applications seller read own" on public.merchant_applications;
drop policy if exists "applications agent read assigned" on public.merchant_applications;
create policy "applications seller read own" on public.merchant_applications for select to authenticated using (seller_id=auth.uid());
create policy "applications agent read assigned" on public.merchant_applications for select to authenticated using (agent_id=auth.uid() and public.is_agent());

create or replace function public.submit_merchant_application(invitation_code_input text, address_input text)
returns uuid language plpgsql security definer set search_path=public as $$
declare selected_agent uuid; application_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required to submit an application'; end if;
  select id into selected_agent from public.profiles where role='agent' and upper(invitation_code)=upper(trim(invitation_code_input)) limit 1;
  if selected_agent is null then raise exception 'Invalid agent invitation code'; end if;
  update public.profiles set agent_id=selected_agent, address=trim(address_input), allow_login=false, registration_status='Pending' where id=auth.uid() and role='seller';
  if not found then raise exception 'Only seller accounts can apply'; end if;
  insert into public.merchant_applications (seller_id,agent_id,name,email,address,status,created_at,decided_at)
  select id,selected_agent,display_name,email,trim(address_input),'Pending',now(),null from public.profiles where id=auth.uid()
  on conflict (seller_id) do update set agent_id=excluded.agent_id,name=excluded.name,email=excluded.email,address=excluded.address,status='Pending',created_at=now(),decided_at=null
  returning id into application_id;
  return application_id;
end; $$;

create or replace function public.decide_merchant_application(application_id_input uuid, decision_input text)
returns void language plpgsql security definer set search_path=public as $$
declare target_seller uuid;
begin
  if decision_input not in ('Approved','Rejected') then raise exception 'Invalid decision'; end if;
  select seller_id into target_seller from public.merchant_applications where id=application_id_input and agent_id=auth.uid() and status='Pending';
  if target_seller is null or not public.is_agent() then raise exception 'Application not found or not authorized'; end if;
  update public.merchant_applications set status=decision_input,decided_at=now() where id=application_id_input;
  update public.profiles set registration_status=decision_input,allow_login=(decision_input='Approved') where id=target_seller;
  if decision_input='Approved' then
    update auth.users set email_confirmed_at=coalesce(email_confirmed_at,now()) where id=target_seller;
  end if;
end; $$;

revoke all on function public.submit_merchant_application(text,text) from public;
revoke all on function public.decide_merchant_application(uuid,text) from public;
grant execute on function public.submit_merchant_application(text,text) to authenticated;
grant execute on function public.decide_merchant_application(uuid,text) to authenticated;

create or replace function public.verify_agent_invitation_code(invitation_code_input text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where role='agent' and upper(invitation_code)=upper(trim(invitation_code_input)));
$$;

create or replace function public.ensure_merchant_application(seller_id_input uuid, invitation_code_input text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare selected_agent uuid; selected_user auth.users%rowtype; application_id uuid;
begin
  select * into selected_user
  from auth.users
  where id=seller_id_input
    and coalesce(raw_user_meta_data->>'role','')='seller'
    and upper(trim(raw_user_meta_data->>'invitation_code'))=upper(trim(invitation_code_input));
  if selected_user.id is null then raise exception 'Registration could not be verified. Please register again.'; end if;
  select id into selected_agent from public.profiles
  where role='agent' and upper(invitation_code)=upper(trim(invitation_code_input)) limit 1;
  if selected_agent is null then raise exception 'Invalid agent invitation code'; end if;

  insert into public.profiles (id,email,display_name,role,agent_id,address,phone,allow_login,registration_status)
  values (selected_user.id,selected_user.email,
    coalesce(selected_user.raw_user_meta_data->>'display_name',split_part(selected_user.email,'@',1)),
    'seller',selected_agent,coalesce(selected_user.raw_user_meta_data->>'address',''),
    coalesce(selected_user.raw_user_meta_data->>'phone',''),false,'Pending')
  on conflict (id) do update set agent_id=excluded.agent_id,address=excluded.address,phone=excluded.phone,
    allow_login=public.profiles.allow_login,
    registration_status=public.profiles.registration_status;

  insert into public.merchant_applications (seller_id,agent_id,name,email,address,phone,status,created_at,decided_at)
  values (selected_user.id,selected_agent,
    coalesce(selected_user.raw_user_meta_data->>'display_name',split_part(selected_user.email,'@',1)),
    selected_user.email,coalesce(selected_user.raw_user_meta_data->>'address',''),
    coalesce(selected_user.raw_user_meta_data->>'phone',''),'Pending',now(),null)
  on conflict (seller_id) do update set
    agent_id=excluded.agent_id,name=excluded.name,email=excluded.email,address=excluded.address,phone=excluded.phone,
    status=public.merchant_applications.status,
    created_at=public.merchant_applications.created_at,
    decided_at=public.merchant_applications.decided_at
  returning id into application_id;
  return application_id;
end; $$;

create or replace function public.sync_agent_merchant_applications()
returns void language plpgsql security definer set search_path=public,auth as $$
declare own_code text; registration_user record;
begin
  if auth.uid() is null or not public.is_agent() then raise exception 'Agent access is required'; end if;
  select invitation_code into own_code from public.profiles where id=auth.uid() and role='agent';
  if coalesce(own_code,'')='' then raise exception 'This agent does not have an invitation code'; end if;
  for registration_user in
    select id from auth.users
    where coalesce(raw_user_meta_data->>'role','')='seller'
      and upper(trim(raw_user_meta_data->>'invitation_code'))=upper(own_code)
  loop
    perform public.ensure_merchant_application(registration_user.id,own_code);
  end loop;
end; $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
declare selected_agent uuid; submitted_code text; submitted_role text;
begin
  submitted_role := coalesce(new.raw_user_meta_data->>'role','seller');
  submitted_code := trim(coalesce(new.raw_user_meta_data->>'invitation_code',''));
  if submitted_role='seller' and submitted_code<>'' then
    select id into selected_agent from public.profiles where role='agent' and upper(invitation_code)=upper(submitted_code) limit 1;
    if selected_agent is null then raise exception 'Invalid agent invitation code'; end if;
    insert into public.profiles (id,email,display_name,role,agent_id,address,phone,allow_login,registration_status)
    values (new.id,new.email,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)),'seller',selected_agent,coalesce(new.raw_user_meta_data->>'address',''),coalesce(new.raw_user_meta_data->>'phone',''),false,'Pending');
    insert into public.merchant_applications (seller_id,agent_id,name,email,address,phone,status)
    values (new.id,selected_agent,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)),new.email,coalesce(new.raw_user_meta_data->>'address',''),coalesce(new.raw_user_meta_data->>'phone',''),'Pending');
  else
    insert into public.profiles (id,email,display_name,role)
    values (new.id,new.email,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)),submitted_role);
  end if;
  return new;
end; $$;

revoke all on function public.verify_agent_invitation_code(text) from public;
revoke all on function public.ensure_merchant_application(uuid,text) from public;
revoke all on function public.sync_agent_merchant_applications() from public;
grant execute on function public.verify_agent_invitation_code(text) to anon,authenticated;
grant execute on function public.ensure_merchant_application(uuid,text) to anon,authenticated;
grant execute on function public.sync_agent_merchant_applications() to authenticated;

create or replace function public.update_own_seller_display_name(new_display_name text)
returns text language plpgsql security definer set search_path=public,auth as $$
declare cleaned_name text;
begin
  cleaned_name := trim(coalesce(new_display_name,''));
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if cleaned_name='' or char_length(cleaned_name)>40 then raise exception 'Shop name must contain 1 to 40 characters'; end if;
  update public.profiles set display_name=cleaned_name where id=auth.uid() and role='seller';
  if not found then raise exception 'Seller profile not found'; end if;
  update public.merchant_applications set name=cleaned_name where seller_id=auth.uid();
  update auth.users
  set raw_user_meta_data=jsonb_set(coalesce(raw_user_meta_data,'{}'::jsonb),'{display_name}',to_jsonb(cleaned_name),true)
  where id=auth.uid();
  return cleaned_name;
end; $$;

revoke all on function public.update_own_seller_display_name(text) from public;
grant execute on function public.update_own_seller_display_name(text) to authenticated;

-- Repair verified seller sign-ups created before this trigger version was installed.
with registration_users as (
  select users.id,users.email,
    coalesce(users.raw_user_meta_data->>'display_name',split_part(users.email,'@',1)) as display_name,
    coalesce(users.raw_user_meta_data->>'address','') as address,
    coalesce(users.raw_user_meta_data->>'phone','') as phone,
    agents.id as agent_id,users.created_at
  from auth.users users
  join public.profiles agents on agents.role='agent'
    and upper(agents.invitation_code)=upper(trim(users.raw_user_meta_data->>'invitation_code'))
  where coalesce(users.raw_user_meta_data->>'role','')='seller'
)
insert into public.profiles (id,email,display_name,role,agent_id,address,phone,allow_login,registration_status)
select id,email,display_name,'seller',agent_id,address,phone,false,'Pending'
from registration_users
on conflict (id) do nothing;

with registration_users as (
  select users.id,
    coalesce(users.raw_user_meta_data->>'address','') as address,
    coalesce(users.raw_user_meta_data->>'phone','') as phone,
    agents.id as agent_id
  from auth.users users
  join public.profiles agents on agents.role='agent'
    and upper(agents.invitation_code)=upper(trim(users.raw_user_meta_data->>'invitation_code'))
  where coalesce(users.raw_user_meta_data->>'role','')='seller'
)
update public.profiles profiles
set agent_id=registration_users.agent_id,address=registration_users.address,
    phone=registration_users.phone,allow_login=false,registration_status='Pending'
from registration_users
where profiles.id=registration_users.id
  and not exists (select 1 from public.merchant_applications applications where applications.seller_id=profiles.id);

insert into public.merchant_applications (seller_id,agent_id,name,email,address,phone,status,created_at)
select users.id,agents.id,
  coalesce(users.raw_user_meta_data->>'display_name',split_part(users.email,'@',1)),users.email,
  coalesce(users.raw_user_meta_data->>'address',''),coalesce(users.raw_user_meta_data->>'phone',''),
  'Pending',users.created_at
from auth.users users
join public.profiles agents on agents.role='agent'
  and upper(agents.invitation_code)=upper(trim(users.raw_user_meta_data->>'invitation_code'))
where coalesce(users.raw_user_meta_data->>'role','')='seller'
on conflict (seller_id) do nothing;

-- Agent approval is the final account verification step for merchant accounts.
-- Repair sellers that were already approved before this migration version.
update auth.users users
set email_confirmed_at=coalesce(users.email_confirmed_at,now())
from public.profiles profiles
where profiles.id=users.id
  and profiles.role='seller'
  and profiles.registration_status='Approved'
  and users.email_confirmed_at is null;

do $$ begin
  alter publication supabase_realtime add table public.merchant_applications;
exception when duplicate_object then null;
end $$;
