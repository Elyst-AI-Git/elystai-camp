-- Keep the live panels in sync across both accounts.
-- These tables were added after the initial realtime publication list.
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['metrics', 'task_slip_reasons', 'weekly_goals'] loop
      if to_regclass(format('public.%I', table_name)) is not null
        and not exists (
          select 1
          from pg_publication_tables
          where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = table_name
        ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;
