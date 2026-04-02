create type ai_run_type as enum (
  'food_generation',
  'nutrient_research_task',
  'ai_review'
);

create type ai_run_status as enum (
  'running',
  'completed',
  'failed'
);

create table ai_runs (
  id uuid primary key default gen_random_uuid(),
  type ai_run_type not null,
  status ai_run_status not null default 'running',
  goal text not null,
  source text not null,
  trigger_user_id text references "user"(id) on delete set null,
  ai_task_id uuid references ai_tasks(id) on delete set null,
  food_id uuid references foods(id) on delete set null,
  item_count integer,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 6),
  result_summary text,
  error_message text,
  metadata jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer
);

create index ai_runs_started_at_idx on ai_runs (started_at desc);
create index ai_runs_type_idx on ai_runs (type);
create index ai_runs_status_idx on ai_runs (status);
