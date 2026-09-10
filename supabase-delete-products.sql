-- Run once in Supabase Dashboard > SQL Editor.
-- Allows only an authenticated admin to permanently delete a product.

create or replace function public.admin_delete_product_permanently(target_product_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Match the real products.id type (some installations use bigint, others UUID).
  resolved_product_id public.products.id%type;
  dependency record;
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

  -- Discover the real product-reference columns only in the two tables this
  -- operation is authorized to change. This supports installations where the
  -- column is named id, product_id, catalog_product_id, or something else.
  for dependency in
    select
      child_namespace.nspname as schema_name,
      child_table.relname as table_name,
      child_column.attname as column_name,
      child_column.attnotnull as is_required
    from pg_constraint constraint_row
    join pg_class child_table
      on child_table.oid = constraint_row.conrelid
    join pg_namespace child_namespace
      on child_namespace.oid = child_table.relnamespace
    join lateral unnest(constraint_row.conkey) with ordinality child_key(attnum, position)
      on true
    join lateral unnest(constraint_row.confkey) with ordinality parent_key(attnum, position)
      on parent_key.position = child_key.position
    join pg_attribute child_column
      on child_column.attrelid = child_table.oid
     and child_column.attnum = child_key.attnum
    join pg_attribute parent_column
      on parent_column.attrelid = constraint_row.confrelid
     and parent_column.attnum = parent_key.attnum
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.products'::regclass
      and parent_column.attname = 'id'
      and child_namespace.nspname = 'public'
      and child_table.relname in ('orders', 'showcase_products')
  loop
    -- Keep historical orders when their product reference is nullable.
    if dependency.table_name = 'orders' and not dependency.is_required then
      execute format(
        'update %I.%I set %I = null where %I = $1',
        dependency.schema_name,
        dependency.table_name,
        dependency.column_name,
        dependency.column_name
      ) using resolved_product_id;
    else
      -- Showcase and other dependent rows must disappear with the product.
      execute format(
        'delete from %I.%I where %I = $1',
        dependency.schema_name,
        dependency.table_name,
        dependency.column_name
      ) using resolved_product_id;
    end if;
  end loop;

  -- Remove the global product seen by admin, agents, and merchants.
  delete from public.products
  where id = resolved_product_id;

  return found;
end;
$$;

revoke all on function public.admin_delete_product_permanently(text) from public;
grant execute on function public.admin_delete_product_permanently(text) to authenticated;
