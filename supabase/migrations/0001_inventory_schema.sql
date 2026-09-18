-- PhilFIDA Inventory System initial schema.
-- The FastAPI service connects as the private database owner through the
-- Supabase transaction pooler. Public Data API roles are denied by default.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'userrole') then
    create type public.userrole as enum ('admin', 'encoder', 'viewer');
  end if;
  if not exists (select 1 from pg_type where typname = 'transactiontype') then
    create type public.transactiontype as enum ('IN', 'OUT');
  end if;
end
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  full_name text not null,
  position text,
  email text not null unique,
  hashed_password text not null,
  role public.userrole not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  unit text,
  quantity integer not null default 0 check (quantity >= 0),
  minimum_quantity integer not null default 0 check (minimum_quantity >= 0),
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signatories (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  designation text not null,
  unit text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_type public.transactiontype not null,
  reference_number text not null unique,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  recipient_name text,
  recipient_department text,
  purpose text,
  condition text,
  remarks text,
  transaction_date timestamptz not null default now(),
  created_by uuid not null references public.users(id) on delete restrict,
  voided boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.number_counters (
  key text primary key,
  next_value integer not null check (next_value > 0)
);

create table if not exists public.report_documents (
  name text primary key,
  content bytea not null,
  size integer not null check (size >= 0),
  modified timestamptz not null default now()
);

create index if not exists items_category_id_idx
  on public.items (category_id);
create index if not exists items_active_code_idx
  on public.items (is_active, code);
create index if not exists transactions_item_id_idx
  on public.transactions (item_id);
create index if not exists transactions_created_by_idx
  on public.transactions (created_by);
create index if not exists transactions_type_date_idx
  on public.transactions (transaction_type, transaction_date desc);
create index if not exists transactions_item_date_idx
  on public.transactions (item_id, transaction_date desc);
create index if not exists audit_logs_user_id_idx
  on public.audit_logs (user_id);
create index if not exists audit_logs_action_created_idx
  on public.audit_logs (action, created_at desc);
create index if not exists signatories_active_name_idx
  on public.signatories (is_active, full_name);
create index if not exists report_documents_modified_idx
  on public.report_documents (modified desc);

-- These tables are intentionally not consumed through the public Supabase
-- Data API. The FastAPI service is the authorization boundary.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users', 'categories', 'items', 'signatories', 'transactions',
    'audit_logs', 'app_settings', 'number_counters', 'report_documents'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    if not exists (
      select 1 from pg_policy
      where polrelid = format('public.%I', table_name)::regclass
        and polname = table_name || '_deny_public'
    ) then
      execute format(
        'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
        table_name || '_deny_public', table_name
      );
    end if;
  end loop;
end
$$;

