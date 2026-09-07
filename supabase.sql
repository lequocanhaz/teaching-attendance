-- Teaching Attendance V3
-- Chạy toàn bộ file này trong Supabase > SQL Editor.
-- V3 lưu lịch học/kiến tập theo NGÀY CỤ THỂ để mỗi tuần có thể khác nhau và vẫn xem lại tuần cũ.

create extension if not exists pgcrypto;

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  schedule_type text not null default 'teaching',
  student_name text not null,
  subject text not null default '',
  location text not null default '',
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  start_date date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.schedules add column if not exists schedule_type text not null default 'teaching';
alter table public.schedules add column if not exists location text not null default '';
alter table public.schedules add column if not exists start_date date;
alter table public.schedules add column if not exists end_date date;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  schedule_id uuid references public.schedules(id) on delete set null,
  original_date date not null,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  student_name text not null,
  subject text not null,
  status text not null default 'pending' check (status in ('pending','taught','student_absent','teacher_absent','makeup','cancelled')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, schedule_id, original_date)
);

create table if not exists public.weekly_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  event_type text not null check (event_type in ('university','practicum')),
  event_date date not null,
  title text not null,
  details text not null default '',
  location text not null default '',
  start_time time not null,
  end_time time not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.schedules enable row level security;
alter table public.sessions enable row level security;
alter table public.weekly_events enable row level security;

drop policy if exists "own schedules select" on public.schedules;
drop policy if exists "own schedules insert" on public.schedules;
drop policy if exists "own schedules update" on public.schedules;
drop policy if exists "own schedules delete" on public.schedules;
create policy "own schedules select" on public.schedules for select using (auth.uid() = user_id);
create policy "own schedules insert" on public.schedules for insert with check (auth.uid() = user_id);
create policy "own schedules update" on public.schedules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own schedules delete" on public.schedules for delete using (auth.uid() = user_id);

drop policy if exists "own sessions select" on public.sessions;
drop policy if exists "own sessions insert" on public.sessions;
drop policy if exists "own sessions update" on public.sessions;
drop policy if exists "own sessions delete" on public.sessions;
create policy "own sessions select" on public.sessions for select using (auth.uid() = user_id);
create policy "own sessions insert" on public.sessions for insert with check (auth.uid() = user_id);
create policy "own sessions update" on public.sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sessions delete" on public.sessions for delete using (auth.uid() = user_id);

drop policy if exists "own weekly events select" on public.weekly_events;
drop policy if exists "own weekly events insert" on public.weekly_events;
drop policy if exists "own weekly events update" on public.weekly_events;
drop policy if exists "own weekly events delete" on public.weekly_events;
create policy "own weekly events select" on public.weekly_events for select using (auth.uid() = user_id);
create policy "own weekly events insert" on public.weekly_events for insert with check (auth.uid() = user_id);
create policy "own weekly events update" on public.weekly_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own weekly events delete" on public.weekly_events for delete using (auth.uid() = user_id);

create index if not exists idx_schedules_user_weekday on public.schedules(user_id, weekday);
create index if not exists idx_sessions_user_date on public.sessions(user_id, session_date);
create index if not exists idx_weekly_events_user_date on public.weekly_events(user_id, event_date);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='schedules') then
    alter publication supabase_realtime add table public.schedules;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='sessions') then
    alter publication supabase_realtime add table public.sessions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='weekly_events') then
    alter publication supabase_realtime add table public.weekly_events;
  end if;
end $$;
