-- Run once in the Supabase SQL editor. Safe to run again: it only creates
-- what is missing. Sets up the three things the site writes:
--
--   subscribers         emails left for updates, with what the student was looking for
--   scholarship_reports problems students flag on a listing
--   search_misses       schools and searches we had nothing for
--
-- All three are closed to the public keys; only the server's secret key writes them.

-- What students looked for that we could not give them, so the backend knows
-- which schools to collect next.

create table if not exists public.search_misses (
  id bigint generated always as identity primary key,
  -- 'no_school_match': typed a school name we have no row for
  -- 'school_no_data':  picked a school we hold no scholarships for
  -- 'no_scholarship_match': filtered a school's list and got nothing
  kind text not null,
  query text,
  school_unitid integer references public.schools (unitid),
  created_at timestamptz not null default now()
);

create index if not exists search_misses_kind_idx on public.search_misses (kind, created_at desc);

alter table public.search_misses enable row level security;
revoke all on public.search_misses from anon, authenticated;

-- What to collect next: most-requested schools we hold nothing for.
create or replace view public.most_wanted_schools
with (security_invoker = true) as
select s.unitid, s.name, s.state, count(*)::int as requests, max(m.created_at) as last_requested
from public.search_misses m
join public.schools s on s.unitid = m.school_unitid
where m.kind = 'school_no_data'
group by s.unitid, s.name, s.state
order by requests desc;

revoke all on public.most_wanted_schools from anon, authenticated;

-- Students who left an email for updates, with what they were looking for.
create table if not exists public.subscribers (
  id bigint generated always as identity primary key,
  email text not null unique,
  -- The school they were browsing; null for the any-school list.
  school_unitid integer references public.schools (unitid),
  -- Their answers, as the short codes in src/lib/profile.ts.
  grade text,
  field text,
  gpa_band text,
  need text,
  -- One readable line of everything they told us, to open an email with, e.g.
  -- "College junior · Engineering · GPA 3.0 to 3.49 · Has financial need · at
  -- The University of Alabama · 142 matches · saved 3: ...".
  summary text,
  -- "About you" picks, as the codes in src/lib/profile.ts (w, b, fg, ...).
  about text[] not null default '{}',
  -- Everything else at the moment they signed up: every filter in codes and in
  -- words, the scholarships they starred and the first ones they were shown
  -- (with names), how many results they saw, the page, the referrer, and
  -- their analytics id (to line up with PostHog).
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- For a table created from an earlier version of this file.
alter table public.subscribers add column if not exists summary text;
alter table public.subscribers add column if not exists about text[] not null default '{}';

create index if not exists subscribers_school_idx on public.subscribers (school_unitid);

alter table public.subscribers enable row level security;
revoke all on public.subscribers from anon, authenticated;

-- Problems students flag on a listing: a dead link, a wrong date, and so on.
create table if not exists public.scholarship_reports (
  id bigint generated always as identity primary key,
  -- The listing's id in public.scholarships. Not a foreign key, so a report
  -- survives the listing being removed or re-collected under a new id.
  scholarship_id text not null,
  -- The name as the student saw it, for reading reports without a join.
  scholarship_name text,
  -- The list it was reported from; null for the any-school list.
  school_unitid integer references public.schools (unitid),
  kind text not null check (kind in ('broken_link', 'closed', 'wrong_info', 'not_scholarship', 'other')),
  -- Optional, in the student's words.
  note text,
  -- The page it was sent from, and the PostHog id to line up with a session.
  page text,
  analytics_id text,
  -- For working through them: 'new', 'fixed', 'ignored'.
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists scholarship_reports_scholarship_idx on public.scholarship_reports (scholarship_id);
create index if not exists scholarship_reports_status_idx on public.scholarship_reports (status, created_at desc);

alter table public.scholarship_reports enable row level security;
revoke all on public.scholarship_reports from anon, authenticated;

-- What to fix first: listings with the most open reports.
create or replace view public.most_reported_scholarships
with (security_invoker = true) as
select
  r.scholarship_id,
  max(r.scholarship_name) as name,
  max(s.url) as url,
  count(*)::int as reports,
  array_agg(distinct r.kind) as kinds,
  max(r.created_at) as last_reported
from public.scholarship_reports r
left join public.scholarships s on s.id = r.scholarship_id
where r.status = 'new'
group by r.scholarship_id
order by reports desc, last_reported desc;

revoke all on public.most_reported_scholarships from anon, authenticated;
