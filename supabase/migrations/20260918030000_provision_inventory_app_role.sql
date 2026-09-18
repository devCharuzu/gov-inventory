-- Provision the least-privileged runtime role for the FastAPI service.
-- The role password is provisioned out-of-band and is intentionally absent
-- from this committed migration.

create role inventory_app
  login
  nosuperuser
  nocreatedb
  nocreaterole
  noreplication
  nobypassrls;

grant connect on database postgres to inventory_app;

revoke all privileges on schema public from inventory_app;
grant usage on schema public to inventory_app;

grant select, insert, update, delete on table
  public.users,
  public.categories,
  public.items,
  public.signatories,
  public.transactions,
  public.audit_logs,
  public.app_settings,
  public.number_counters,
  public.report_documents
to inventory_app;

create policy users_inventory_app_access
  on public.users
  for all
  to inventory_app
  using (true)
  with check (true);

create policy categories_inventory_app_access
  on public.categories
  for all
  to inventory_app
  using (true)
  with check (true);

create policy items_inventory_app_access
  on public.items
  for all
  to inventory_app
  using (true)
  with check (true);

create policy signatories_inventory_app_access
  on public.signatories
  for all
  to inventory_app
  using (true)
  with check (true);

create policy transactions_inventory_app_access
  on public.transactions
  for all
  to inventory_app
  using (true)
  with check (true);

create policy audit_logs_inventory_app_access
  on public.audit_logs
  for all
  to inventory_app
  using (true)
  with check (true);

create policy app_settings_inventory_app_access
  on public.app_settings
  for all
  to inventory_app
  using (true)
  with check (true);

create policy number_counters_inventory_app_access
  on public.number_counters
  for all
  to inventory_app
  using (true)
  with check (true);

create policy report_documents_inventory_app_access
  on public.report_documents
  for all
  to inventory_app
  using (true)
  with check (true);
