-- Add the Camp task category requested for internal learning work.
alter type task_category add value if not exists 'upskilling';
