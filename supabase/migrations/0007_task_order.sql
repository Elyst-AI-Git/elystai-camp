alter table tasks add column if not exists sort_order integer not null default 0;

with ranked as (
  select id,
         row_number() over (partition by sprint_id, day, owner, tier order by created_at, id) - 1 as next_order
  from tasks
)
update tasks
set sort_order = ranked.next_order
from ranked
where tasks.id = ranked.id;
