alter table public.transactions
  alter column reference_number drop not null;

alter table public.transactions
  drop constraint if exists transactions_region_id_reference_number_key,
  drop constraint if exists transactions_reference_number_key,
  drop constraint if exists uq_transactions_region_reference;

create unique index if not exists uq_transactions_region_out_reference
  on public.transactions (region_id, reference_number)
  where transaction_type = 'OUT' and reference_number is not null;
