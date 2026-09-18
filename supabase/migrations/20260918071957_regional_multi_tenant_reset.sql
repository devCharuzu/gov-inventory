-- Destructive application reset and regional multi-tenancy.
-- This intentionally removes the old single-region tables and accounts.
-- The Supabase project/database itself is not deleted.

create extension if not exists pgcrypto;

drop table if exists public.transactions cascade;
drop table if exists public.report_documents cascade;
drop table if exists public.audit_logs cascade;
drop table if exists public.number_counters cascade;
drop table if exists public.app_settings cascade;
drop table if exists public.items cascade;
drop table if exists public.categories cascade;
drop table if exists public.signatories cascade;
drop table if exists public.users cascade;
drop table if exists public.regions cascade;
drop type if exists public.transactiontype cascade;
drop type if exists public.userrole cascade;

create type public.userrole as enum ('admin', 'encoder', 'viewer');
create type public.transactiontype as enum ('IN', 'OUT');

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  admin_username text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on delete restrict,
  username text not null unique,
  full_name text not null,
  position text,
  email text not null unique,
  hashed_password text not null,
  role public.userrole not null default 'viewer',
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on delete restrict,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (region_id, name)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on delete restrict,
  code text not null,
  name text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  unit text,
  quantity integer not null default 0 check (quantity >= 0),
  minimum_quantity integer not null default 0 check (minimum_quantity >= 0),
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (region_id, code)
);

create table public.signatories (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on delete restrict,
  full_name text not null,
  designation text not null,
  unit text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on delete restrict,
  transaction_type public.transactiontype not null,
  reference_number text not null,
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
  updated_at timestamptz not null default now(),
  unique (region_id, reference_number)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on delete restrict,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  region_id uuid not null references public.regions(id) on delete restrict,
  key text not null,
  value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (region_id, key)
);

create table public.number_counters (
  region_id uuid not null references public.regions(id) on delete restrict,
  key text not null,
  next_value integer not null check (next_value > 0),
  primary key (region_id, key)
);

create table public.report_documents (
  region_id uuid not null references public.regions(id) on delete restrict,
  name text not null,
  content bytea not null,
  size integer not null check (size >= 0),
  modified timestamptz not null default now(),
  primary key (region_id, name)
);

create index items_region_category_idx on public.items (region_id, category_id);
create index items_region_active_code_idx on public.items (region_id, is_active, code);
create index transactions_region_item_idx on public.transactions (region_id, item_id);
create index transactions_region_creator_idx on public.transactions (region_id, created_by);
create index transactions_region_type_date_idx on public.transactions (region_id, transaction_type, transaction_date desc);
create index audit_logs_region_user_idx on public.audit_logs (region_id, user_id);
create index audit_logs_region_created_idx on public.audit_logs (region_id, created_at desc);
create index signatories_region_active_name_idx on public.signatories (region_id, is_active, full_name);
create index report_documents_region_modified_idx on public.report_documents (region_id, modified desc);

-- Tenants requested by the developer. Passwords are stored only as bcrypt
-- hashes; every issued account is forced to change it after first login.
insert into public.regions (code, name, admin_username) values
  ('r1', 'Regional Office I', 'admin_r1'),
  ('r4', 'Regional Office IV', 'admin_r4'),
  ('r5', 'Regional Office V', 'admin_r5'),
  ('r6', 'Regional Satellite Office VI', 'admin_r6'),
  ('r7', 'Regional Office VII', 'admin_r7'),
  ('r8', 'Regional Office VIII', 'admin_r8'),
  ('r9', 'Regional Office IX', 'admin_r9'),
  ('r10', 'Regional Office X', 'admin_r10'),
  ('r11', 'Regional Office XI', 'admin_r11'),
  ('r13', 'Regional Office XIII', 'admin_r13');

insert into public.users (
  region_id, username, full_name, email, hashed_password, role, must_change_password
)
select
  id,
  admin_username,
  name || ' Administrator',
  admin_username || '@philfida.local',
  '$2b$12$EtUXevlXlonFoWMsrmcOUes5pMe7/vSbq/GLvqv/ahn.lYRoh407m',
  'admin',
  true
from public.regions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'inventory_app') then
    create role inventory_app login nosuperuser nocreatedb nocreaterole
      noreplication nobypassrls;
  end if;
end
$$;

grant connect on database postgres to inventory_app;
revoke all privileges on schema public from inventory_app;
grant usage on schema public to inventory_app;
grant select on table public.regions to inventory_app;
grant select, insert, update, delete on table
  public.users, public.categories, public.items, public.signatories,
  public.transactions, public.audit_logs, public.app_settings,
  public.number_counters, public.report_documents
to inventory_app;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'regions', 'users', 'categories', 'items', 'signatories', 'transactions',
    'audit_logs', 'app_settings', 'number_counters', 'report_documents'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      table_name || '_deny_public', table_name
    );
  end loop;
end
$$;

create policy regions_inventory_app_read on public.regions
  for select to inventory_app using (true);

-- Login must be able to find the username before the region context exists.
-- Every authenticated request sets app.region_id immediately afterwards.
create policy users_inventory_app_region on public.users
  for all to inventory_app
  using (
    nullif(current_setting('app.region_id', true), '') is null
    or region_id = nullif(current_setting('app.region_id', true), '')::uuid
  )
  with check (
    region_id = nullif(current_setting('app.region_id', true), '')::uuid
  );

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'categories', 'items', 'signatories', 'transactions', 'audit_logs',
    'app_settings', 'number_counters', 'report_documents'
  ] loop
    execute format(
      'create policy %I on public.%I for all to inventory_app using (region_id = nullif(current_setting(''app.region_id'', true), '''')::uuid) with check (region_id = nullif(current_setting(''app.region_id'', true), '''')::uuid)',
      table_name || '_inventory_app_region', table_name
    );
  end loop;
end
$$;
