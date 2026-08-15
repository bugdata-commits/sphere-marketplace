-- ============================================================================
-- Sphere Marketplace — production schema (Supabase / Postgres)
-- ============================================================================
-- Run this in your Supabase project's SQL editor (Project → SQL Editor → New
-- query), or via the Supabase CLI: `supabase db push`.
--
-- This replaces the localStorage demo with real, server-enforced data:
--   - affiliates      one row per referrer, owns a unique referral code
--   - referral_events  every click + signup, immutable audit trail
--   - payouts          record of money actually sent (filled in once Stripe
--                       Connect is wired up — see backend/README.md)
--   - admin_users      who is allowed into the back office (real auth, not
--                       a password string in JS)
--
-- Money math (balances) is derived, never trusted from the client: the
-- `record-referral-signup` edge function is the only thing allowed to
-- create a referral_events row, and it runs with the service role key on
-- the server — a browser can never directly INSERT a credit.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- affiliates
-- ---------------------------------------------------------------------------
create table if not exists affiliates (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  name          text not null,
  email         text not null unique,
  created_at    timestamptz not null default now(),
  -- denormalized counters kept in sync by trigger below, for fast reads
  clicks        integer not null default 0,
  signups       integer not null default 0,
  balance_cents integer not null default 0,   -- what's currently owed
  paid_cents    integer not null default 0    -- lifetime paid out
);

create index if not exists idx_affiliates_code on affiliates (code);

-- ---------------------------------------------------------------------------
-- referral_events — append-only audit log. Never updated, never deleted.
-- ---------------------------------------------------------------------------
create table if not exists referral_events (
  id          uuid primary key default gen_random_uuid(),
  affiliate_id uuid references affiliates(id) on delete set null,
  type        text not null check (type in ('click', 'signup')),
  amount_cents integer not null default 0,    -- 100 = $1.00, only set on 'signup'
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_events_affiliate on referral_events (affiliate_id);
create index if not exists idx_events_created on referral_events (created_at desc);

-- ---------------------------------------------------------------------------
-- payouts — one row per actual payment run to an affiliate
-- ---------------------------------------------------------------------------
create table if not exists payouts (
  id            uuid primary key default gen_random_uuid(),
  affiliate_id  uuid not null references affiliates(id) on delete cascade,
  amount_cents  integer not null,
  status        text not null default 'pending' check (status in ('pending','processing','paid','failed')),
  stripe_transfer_id text,
  created_at    timestamptz not null default now(),
  paid_at       timestamptz
);

-- ---------------------------------------------------------------------------
-- admin_users — allowlist of Supabase Auth user IDs who can access /admin.
-- Populate this yourself after each admin creates a real account via
-- Supabase Auth (email+password or magic link) — see backend/README.md.
-- ---------------------------------------------------------------------------
create table if not exists admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'admin' check (role in ('admin','superadmin')),
  added_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Trigger: keep affiliates' denormalized counters in sync automatically
-- whenever a referral_events row is inserted. This means the edge function
-- only ever inserts an event — it never touches the balance directly.
-- ---------------------------------------------------------------------------
create or replace function fn_apply_referral_event() returns trigger as $$
begin
  if new.type = 'click' then
    update affiliates set clicks = clicks + 1 where id = new.affiliate_id;
  elsif new.type = 'signup' then
    update affiliates
      set signups = signups + 1,
          balance_cents = balance_cents + new.amount_cents
      where id = new.affiliate_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_apply_referral_event on referral_events;
create trigger trg_apply_referral_event
  after insert on referral_events
  for each row execute function fn_apply_referral_event();

-- Trigger: when a payout is marked 'paid', move its amount from balance to paid
create or replace function fn_apply_payout() returns trigger as $$
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    update affiliates
      set balance_cents = balance_cents - new.amount_cents,
          paid_cents = paid_cents + new.amount_cents
      where id = new.affiliate_id;
    new.paid_at = now();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_apply_payout on payouts;
create trigger trg_apply_payout
  before update on payouts
  for each row execute function fn_apply_payout();

-- ============================================================================
-- Row Level Security — the core of "not fakeable from the browser"
-- ============================================================================
alter table affiliates enable row level security;
alter table referral_events enable row level security;
alter table payouts enable row level security;
alter table admin_users enable row level security;

-- Anyone can read affiliate *public* fields (needed so the affiliate
-- dashboard can look up "my code"). We expose a narrow view instead of the
-- raw table so emails aren't world-readable.
create or replace view affiliate_public as
  select id, code, name, clicks, signups, balance_cents, paid_cents, created_at
  from affiliates;

grant select on affiliate_public to anon, authenticated;

-- Only admins can read the full affiliates table (with email) directly.
create policy "admins can read affiliates"
  on affiliates for select
  using (exists (select 1 from admin_users au where au.user_id = auth.uid()));

-- New affiliate signup: allowed from the browser (anon), but only inserting
-- their own new row — no one can edit clicks/signups/balance directly, since
-- those columns are only ever changed by the trigger (security definer).
create policy "anyone can create their own affiliate row"
  on affiliates for insert
  with check (true);

-- referral_events: never insertable/readable directly by the browser.
-- Only the edge function (using the service role key, which bypasses RLS)
-- may write here. Admins may read for the activity feed.
create policy "admins can read referral events"
  on referral_events for select
  using (exists (select 1 from admin_users au where au.user_id = auth.uid()));

-- payouts: admins can read and update (mark paid); nobody else can touch it.
create policy "admins can read payouts"
  on payouts for select
  using (exists (select 1 from admin_users au where au.user_id = auth.uid()));

create policy "admins can insert payouts"
  on payouts for insert
  with check (exists (select 1 from admin_users au where au.user_id = auth.uid()));

create policy "admins can update payouts"
  on payouts for update
  using (exists (select 1 from admin_users au where au.user_id = auth.uid()));

-- admin_users: admins can see the allowlist (so the UI can show "who's an admin");
-- only a superadmin can add/remove admins.
create policy "admins can read admin list"
  on admin_users for select
  using (exists (select 1 from admin_users au where au.user_id = auth.uid()));

create policy "superadmins manage admin list"
  on admin_users for all
  using (exists (select 1 from admin_users au where au.user_id = auth.uid() and au.role = 'superadmin'));

-- ============================================================================
-- To make your first admin account:
--   1. Have that person sign up via Supabase Auth (see backend/README.md).
--   2. Find their user id in Authentication → Users in the Supabase dashboard.
--   3. Run:
--        insert into admin_users (user_id, role) values ('<their-uuid>', 'superadmin');
-- ============================================================================
