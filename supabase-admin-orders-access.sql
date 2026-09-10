-- Run this once in Supabase Dashboard > SQL Editor.
-- It fixes older deployments where orders RLS hides rows from the admin UI.

create or replace function public.admin_list_orders()
returns setof public.orders
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  return query select orders.* from public.orders orders order by orders.created_at desc;
end;
$$;

drop function if exists public.admin_update_order_status(uuid,text);
drop function if exists public.admin_update_order_status(text,text);

create function public.admin_update_order_status(order_id_text text, new_status text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if new_status not in ('Pending Payment','Paid','Pending Ship','Pending Receive','Completed','Rejected','Cancelled','Refund') then
    raise exception 'Invalid order status';
  end if;
  update public.orders set status=new_status, updated_at=now() where id::text=trim(order_id_text);
  return found;
end;
$$;

grant execute on function public.admin_list_orders() to authenticated;
grant execute on function public.admin_update_order_status(text,text) to authenticated;
