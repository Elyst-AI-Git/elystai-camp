create table if not exists workday_logs (
  id uuid primary key default gen_random_uuid(),
  person person not null,
  date date not null,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person, date),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

alter table workday_logs enable row level security;
drop policy if exists "authenticated full access" on workday_logs;
create policy "authenticated full access" on workday_logs for all to authenticated using (true) with check (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workday_logs') then
      alter publication supabase_realtime add table public.workday_logs;
    end if;
  end if;
end $$;
