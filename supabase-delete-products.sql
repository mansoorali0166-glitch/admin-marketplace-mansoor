-- Run once in Supabase Dashboard > SQL Editor.
-- Allows only an authenticated admin to permanently delete a product.

-- Bring older products tables up to the complete schema used by all portals.
-- These statements preserve existing rows and safely skip columns already present.
alter table public.products add column if not exists product_code text;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists name text;
alter table public.products add column if not exists sell_price numeric(12,2) default 0;
alter table public.products add column if not exists cost_price numeric(12,2) default 0;
alter table public.products add column if not exists category text default 'Other';
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists admin_on_shelf boolean default true;
alter table public.products add column if not exists created_at timestamptz default now();
alter table public.products add column if not exists updated_at timestamptz default now();

update public.products set product_code = 'CR' || id::text where product_code is null;
update public.products set sku = 'P' || id::text where sku is null;
update public.products set name = coalesce(nullif(name, ''), product_code, 'Product') where name is null or name = '';
update public.products set sell_price = 0 where sell_price is null;
update public.products set cost_price = 0 where cost_price is null;
update public.products set category = 'Other' where category is null or category = '';
update public.products set admin_on_shelf = true where admin_on_shelf is null;
update public.products set created_at = now() where created_at is null;
update public.products set updated_at = now() where updated_at is null;

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

-- Remove the older function signature that included the unsupported source link.
drop function if exists public.admin_create_showcase_product(text, text, text, numeric, numeric, text, text, text, text);

-- Create products through an admin-only function so inserts are persisted even
-- when direct table writes are protected by Row Level Security.
create or replace function public.admin_create_showcase_product(
  new_product_code text,
  new_sku text,
  new_name text,
  new_sell_price numeric,
  new_cost_price numeric,
  new_category text,
  new_image_url text default null,
  new_description text default null
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  created_product public.products%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  insert into public.products (
    product_code, sku, name, sell_price, cost_price, category,
    image_url, description, admin_on_shelf
  ) values (
    new_product_code, new_sku, new_name, new_sell_price,
    coalesce(new_cost_price, 0), new_category, new_image_url,
    new_description, true
  ) returning * into created_product;

  return created_product;
end;
$$;

revoke all on function public.admin_create_showcase_product(text, text, text, numeric, numeric, text, text, text) from public;
grant execute on function public.admin_create_showcase_product(text, text, text, numeric, numeric, text, text, text) to authenticated;
