-- ═══════════════════════════════════════════════════════════════════════════
-- AgentHub Database Schema
-- Run this in Supabase SQL Editor → New Query → Run All
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- Drop existing tables (clean slate)
drop table if exists agent_runs cascade;
drop table if exists api_keys cascade;
drop table if exists guardrails cascade;
drop table if exists memory_configs cascade;
drop table if exists prompts cascade;
drop table if exists models cascade;
drop table if exists tools cascade;
drop table if exists agents cascade;

-- ─── Agents ───────────────────────────────────────────────────────────────────
create table agents (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete cascade,
  name         text        not null,
  description  text        default '',
  version      integer     default 1,
  schema       jsonb       not null default '{"nodes":[],"edges":[]}',
  is_public    boolean     default false,
  run_count    integer     default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ─── Tools ────────────────────────────────────────────────────────────────────
create table tools (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete cascade,
  name         text        not null,
  description  text        default '',
  type         text        default 'http',
  endpoint     text,
  method       text        default 'POST',
  headers      jsonb       default '{}',
  input_schema jsonb       default '{}',
  timeout      integer     default 5000,
  created_at   timestamptz default now()
);

-- ─── Models ───────────────────────────────────────────────────────────────────
create table models (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete cascade,
  name         text        not null,
  provider     text        default 'google',
  model_id     text        default 'gemini-2.5-flash',
  temperature  float       default 0.7,
  max_tokens   integer     default 4096,
  top_p        float       default 1.0,
  stream       boolean     default true,
  api_key      text,
  base_url     text,
  created_at   timestamptz default now()
);

-- ─── Prompts ──────────────────────────────────────────────────────────────────
create table prompts (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete cascade,
  name         text        not null,
  content      text        not null,
  variables    text[]      default '{}',
  created_at   timestamptz default now()
);

-- ─── Memory configs ───────────────────────────────────────────────────────────
create table memory_configs (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete cascade,
  name         text        not null,
  type         text        default 'sliding',
  window_size  integer     default 10,
  ttl_hours    integer     default 24,
  scope        text        default 'session',
  created_at   timestamptz default now()
);

-- ─── Guardrails ───────────────────────────────────────────────────────────────
create table guardrails (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references auth.users(id) on delete cascade,
  name           text        not null,
  input_rules    jsonb       default '[]',
  output_rules   jsonb       default '[]',
  log_violations boolean     default true,
  created_at     timestamptz default now()
);

-- ─── API Keys ─────────────────────────────────────────────────────────────────
create table api_keys (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete cascade,
  name         text        not null,
  key_prefix   text        not null,
  key_hash     text        not null unique,
  is_active    boolean     default true,
  total_calls  integer     default 0,
  last_used    timestamptz,
  created_at   timestamptz default now()
);

-- ─── Agent Runs ───────────────────────────────────────────────────────────────
create table agent_runs (
  id             uuid        primary key default gen_random_uuid(),
  agent_id       uuid        references agents(id) on delete set null,
  agent_name     text        not null,
  api_key_id     uuid        references api_keys(id) on delete set null,
  api_key_prefix text,
  input          jsonb       default '{}',
  output         jsonb,
  status         text        default 'running',
  tokens         integer     default 0,
  latency_ms     integer     default 0,
  error          text,
  trace          jsonb       default '[]',
  created_at     timestamptz default now()
);

-- ─── updated_at trigger ───────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger agents_updated_at before update on agents
  for each row execute function update_updated_at();

-- ─── Enable RLS on all user-owned tables ─────────────────────────────────────
alter table agents enable row level security;
alter table tools enable row level security;
alter table models enable row level security;
alter table prompts enable row level security;
alter table memory_configs enable row level security;
alter table guardrails enable row level security;
alter table api_keys enable row level security;

-- ─── Policies: users can only see their own data ──────────────────────────────
create policy "users_own_agents" on agents for all using (auth.uid() = user_id);
create policy "users_own_tools" on tools for all using (auth.uid() = user_id);
create policy "users_own_models" on models for all using (auth.uid() = user_id);
create policy "users_own_prompts" on prompts for all using (auth.uid() = user_id);
create policy "users_own_memory" on memory_configs for all using (auth.uid() = user_id);
create policy "users_own_guardrails" on guardrails for all using (auth.uid() = user_id);
create policy "users_own_keys" on api_keys for all using (auth.uid() = user_id);

-- ─── Seed default model config ────────────────────────────────────────────────
-- Note: after adding user_id, seed data should be inserted with a real user_id
-- These inserts are left as examples (they will fail without a valid user_id):
-- insert into models (name, provider, model_id, temperature, max_tokens) values
--   ('Gemini 2.5 Flash', 'google', 'gemini-2.5-flash', 0.7, 4096),
--   ('Gemini 2.5 Flash Precise', 'google', 'gemini-2.5-flash', 0.2, 4096),
--   ('Gemini 2.0 Flash', 'google', 'gemini-2.0-flash', 0.7, 8192);

-- Use POST /api/seed after signing in to seed sample data for your account.
