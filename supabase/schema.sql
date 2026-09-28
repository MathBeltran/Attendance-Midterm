-- QR Attendance schema
-- Run this complete file in the Supabase SQL editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student' check (role in ('student', 'teacher')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_code text not null unique,
  title text not null,
  start_time timestamptz,
  end_time timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  scanned_at timestamptz not null default now()
);

-- Attendance is a scan history. Keep every valid scan instead of rejecting
-- repeat scans for the same student and event. The explicit drop also migrates
-- projects that ran an older version of this schema.
alter table public.attendance
  drop constraint if exists attendance_student_id_event_id_key;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when new.raw_user_meta_data ->> 'role' = 'teacher' then 'teacher'
      else 'student'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS helper functions run as the schema owner so policy checks do not invoke
-- another table's policies and recurse back into the original table.
create or replace function public.current_user_has_role(requested_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = requested_role
  );
$$;

create or replace function public.teacher_can_view_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.attendance a
    join public.events e on e.id = a.event_id
    where a.student_id = target_profile_id
      and e.created_by = (select auth.uid())
  );
$$;

revoke all on function public.current_user_has_role(text) from public;
revoke all on function public.teacher_can_view_profile(uuid) from public;
grant execute on function public.current_user_has_role(text) to authenticated;
grant execute on function public.teacher_can_view_profile(uuid) to authenticated;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Events are readable by authenticated users" on public.events;
create policy "Events are readable by authenticated users"
  on public.events for select
  using (auth.role() = 'authenticated');

drop policy if exists "Teachers can insert events" on public.events;
create policy "Teachers can insert events"
  on public.events for insert
  with check (
    created_by = (select auth.uid())
    and public.current_user_has_role('teacher')
  );

drop policy if exists "Teachers can update their own events" on public.events;
create policy "Teachers can update their own events"
  on public.events for update
  using (
    created_by = (select auth.uid())
    and public.current_user_has_role('teacher')
  )
  with check (
    created_by = (select auth.uid())
    and public.current_user_has_role('teacher')
  );

drop policy if exists "Students can view their own attendance" on public.attendance;
create policy "Students can view their own attendance"
  on public.attendance for select
  using (auth.uid() = student_id);

drop policy if exists "Students can insert their own attendance" on public.attendance;
create policy "Students can insert their own attendance"
  on public.attendance for insert
  with check (
    (select auth.uid()) = student_id
    and public.current_user_has_role('student')
  );

drop policy if exists "Teachers can view attendance for their events" on public.attendance;
create policy "Teachers can view attendance for their events"
  on public.attendance for select
  using (
    exists (
      select 1 from public.events e
      where e.id = attendance.event_id
        and e.created_by = auth.uid()
    )
  );

drop policy if exists "Teachers can view profiles of their attendees" on public.profiles;
create policy "Teachers can view profiles of their attendees"
  on public.profiles for select
  using (public.teacher_can_view_profile(id));

create index if not exists events_created_by_idx on public.events (created_by);
create index if not exists attendance_event_id_idx on public.attendance (event_id);
create index if not exists attendance_student_id_idx on public.attendance (student_id);
create index if not exists attendance_student_event_scanned_idx
  on public.attendance (student_id, event_id, scanned_at desc);
