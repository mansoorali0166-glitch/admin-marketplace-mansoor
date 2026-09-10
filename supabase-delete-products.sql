-- Run once in Supabase Dashboard > SQL Editor.
-- Allows only an authenticated admin to permanently delete a product.

create or replace function public.admin_delete_product_permanently(target_product_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_product_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  select id into resolved_product_id
  from public.products
  where id::text = trim(target_product_id)
     or product_code = trim(target_product_id)
  limit 1;

  if resolved_product_id is null then
    return false;
  end if;

  -- Preserve historical orders, but detach their deleted catalog reference.
  update public.orders
  set product_id = null
  where product_id = resolved_product_id;

  -- Remove the product from every merchant showcase.
  delete from public.showcase_products
  where product_id = resolved_product_id;

  -- Remove the global product seen by admin, agents, and merchants.
  delete from public.products
  where id = resolved_product_id;

  return found;
end;
$$;

revoke all on function public.admin_delete_product_permanently(text) from public;
grant execute on function public.admin_delete_product_permanently(text) to authenticated;
