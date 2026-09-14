-- Run after supabase-merchant-registration.sql in Supabase SQL Editor.
-- Seller identity is email only. Shared agent columns and all approval
-- decisions are retained. Existing seller names/phone/address are cleared.
begin;

create or replace function public.normalize_seller_profile_identity()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.role = 'seller' then
    new.display_name := new.email;
    new.phone := '';
    new.address := '';
  end if;
  return new;
end; $$;

drop trigger if exists seller_email_identity on public.profiles;
create trigger seller_email_identity before insert or update on public.profiles
for each row execute function public.normalize_seller_profile_identity();

create or replace function public.normalize_seller_application_identity()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.name := new.email;
  new.phone := '';
  new.address := '';
  return new;
end; $$;

drop trigger if exists seller_application_email_identity on public.merchant_applications;
create trigger seller_application_email_identity
before insert or update on public.merchant_applications
for each row execute function public.normalize_seller_application_identity();

create or replace function public.normalize_seller_auth_metadata()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.raw_user_meta_data->>'role' = 'seller'
     or exists (select 1 from public.profiles where id=new.id and role='seller') then
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
      - 'display_name' - 'name' - 'full_name' - 'store_name' - 'phone' - 'address';
  end if;
  return new;
end; $$;

drop trigger if exists seller_email_auth_metadata on auth.users;
create trigger seller_email_auth_metadata before insert or update on auth.users
for each row execute function public.normalize_seller_auth_metadata();

update public.profiles set display_name=email, phone='', address='' where role='seller';
update public.merchant_applications set name=email, phone='', address='';
update auth.users users
set raw_user_meta_data=coalesce(users.raw_user_meta_data, '{}'::jsonb)
  - 'display_name' - 'name' - 'full_name' - 'store_name' - 'phone' - 'address'
from public.profiles profiles
where profiles.id=users.id and profiles.role='seller';

-- Retain compatibility columns for existing registration triggers, but never
-- collect or store a separate seller name, phone, or registration address.
-- Synchronizing applications must not reset an agent's previous decision.
create or replace function public.ensure_merchant_application(seller_id_input uuid, invitation_code_input text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare selected_agent uuid; selected_user auth.users%rowtype; application_id uuid;
begin
  select * into selected_user from auth.users
  where id=seller_id_input
    and coalesce(raw_user_meta_data->>'role','')='seller'
    and upper(trim(raw_user_meta_data->>'invitation_code'))=upper(trim(invitation_code_input));
  if selected_user.id is null then
    raise exception 'Registration could not be verified. Please register again.';
  end if;
  -- Serializes repair attempts for this seller, including concurrent agent sync.
  perform 1 from auth.users where id=selected_user.id for update;
  select id into application_id from public.merchant_applications
  where seller_id=selected_user.id;
  if application_id is not null then return application_id; end if;

  select id into selected_agent from public.profiles
  where role='agent' and invitation_code_enabled=true
    and upper(invitation_code)=upper(trim(invitation_code_input)) limit 1;
  if selected_agent is null then raise exception 'Invalid agent invitation code'; end if;

  insert into public.profiles (id,email,display_name,role,agent_id,address,phone,allow_login,registration_status)
  values (selected_user.id,selected_user.email,selected_user.email,'seller',selected_agent,'','',false,'Pending')
  on conflict (id) do update set agent_id=excluded.agent_id;

  insert into public.merchant_applications (seller_id,agent_id,name,email,address,phone,status)
  values (selected_user.id,selected_agent,selected_user.email,selected_user.email,'','','Pending')
  returning id into application_id;
  return application_id;
end; $$;

revoke all on function public.normalize_seller_profile_identity() from public;
revoke all on function public.normalize_seller_application_identity() from public;
revoke all on function public.normalize_seller_auth_metadata() from public;
revoke all on function public.ensure_merchant_application(uuid,text) from public;
grant execute on function public.ensure_merchant_application(uuid,text) to anon,authenticated;
revoke execute on function public.update_own_seller_display_name(text) from public,anon,authenticated;

notify pgrst, 'reload schema';
commit;
