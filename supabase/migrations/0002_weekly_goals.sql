create table if not exists weekly_goals (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references sprints(id) on delete cascade,
  person person not null,
  title text not null,
  description text,
  color text not null default 'mint',
  target numeric,
  value numeric not null default 0,
  week_start date,
  created_at timestamptz not null default now()
);

alter table weekly_goals enable row level security;
drop policy if exists "authenticated full access" on weekly_goals;
create policy "authenticated full access" on weekly_goals for all to authenticated using (true) with check (true);
