create table if not exists public.fitness_users (
  id uuid primary key,
  login text not null,
  login_key text not null unique,
  password_salt text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  stats jsonb not null default '{"days":0,"minutes":0,"lastWorkoutDate":"","streakDays":0,"lastStreakDate":"","streakDeadlineAt":0}'::jsonb
);

create table if not exists public.fitness_sessions (
  token text primary key,
  user_id uuid not null references public.fitness_users(id) on delete cascade,
  created_at bigint not null,
  expires_at bigint not null
);

create index if not exists fitness_sessions_user_id_idx on public.fitness_sessions(user_id);
create index if not exists fitness_sessions_expires_at_idx on public.fitness_sessions(expires_at);

create table if not exists public.food_scan_history (
  id uuid primary key,
  user_id uuid not null references public.fitness_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  goal text not null default '',
  food_name text not null,
  confidence text not null,
  calories integer not null default 0,
  protein integer not null default 0,
  carbs integer not null default 0,
  fat integer not null default 0,
  portion text not null default '',
  advice text not null default '',
  is_food boolean not null default true,
  needs_review boolean not null default false
);

create index if not exists food_scan_history_user_created_idx on public.food_scan_history(user_id, created_at desc);
