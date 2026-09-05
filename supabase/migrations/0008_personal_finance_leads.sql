do $$ begin
  create type lead_stage as enum ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost');
exception when duplicate_object then null;
end $$;

create table if not exists personal_transactions (
  id uuid primary key default gen_random_uuid(),
  person person not null,
  date date not null,
  direction tx_direction not null default 'out',
  amount numeric not null check (amount > 0),
  currency currency not null default 'INR',
  category text not null,
  description text not null,
  created_by person not null,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text,
  stage lead_stage not null default 'new',
  owner person not null,
  source text,
  next_action text not null,
  follow_up_date date,
  estimated_value numeric check (estimated_value >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table personal_transactions enable row level security;
alter table leads enable row level security;

drop policy if exists "authenticated full access" on personal_transactions;
drop policy if exists "authenticated full access" on leads;
create policy "authenticated full access" on personal_transactions for all to authenticated using (true) with check (true);
create policy "authenticated full access" on leads for all to authenticated using (true) with check (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'personal_transactions') then
      alter publication supabase_realtime add table public.personal_transactions;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leads') then
      alter publication supabase_realtime add table public.leads;
    end if;
  end if;
end $$;
