-- Run once in Supabase SQL Editor before deploying the portfolio editor.
alter table public.profiles add column if not exists store_name text;
