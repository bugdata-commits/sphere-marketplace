-- ============================================================
-- Trade Sphere Marketplace — Supabase schema
-- Run this once in Supabase: Project → SQL Editor → New query → Run
-- ============================================================

-- 1. PROFILES (extends auth.users) ----------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  business_name text,
  location text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "Users can create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 2. CATEGORIES -------------------------------------------------
create table if not exists public.categories (
  id serial primary key,
  slug text unique not null,
  name text not null,
  icon text,
  sort_order int default 0
);

alter table public.categories enable row level security;

create policy "Categories are publicly readable"
  on public.categories for select
  using (true);

insert into public.categories (slug, name, icon, sort_order) values
  ('tech-software', 'Tech & Software', '💻', 1),
  ('fashion-crafts', 'Fashion & Crafts', '🧵', 2),
  ('agriculture', 'Agriculture', '🌾', 3),
  ('business-services', 'Business Services', '📋', 4),
  ('investment', 'Investment', '💰', 5),
  ('logistics', 'Logistics', '🚚', 6)
on conflict (slug) do nothing;

-- 3. LISTINGS -----------------------------------------------------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  category_id int references public.categories(id),
  title text not null,
  description text,
  price numeric(12,2),
  currency text not null default 'USD',
  location text,
  image_url text,
  status text not null default 'active' check (status in ('draft', 'active', 'sold', 'removed')),
  rating numeric(2,1) default 0,
  review_count int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.listings enable row level security;

create policy "Active listings are publicly readable"
  on public.listings for select
  using (status = 'active' or seller_id = auth.uid());

create policy "Sellers can create their own listings"
  on public.listings for insert
  with check (seller_id = auth.uid());

create policy "Sellers can update their own listings"
  on public.listings for update
  using (seller_id = auth.uid());

create policy "Sellers can delete their own listings"
  on public.listings for delete
  using (seller_id = auth.uid());

create index if not exists listings_status_idx on public.listings(status);
create index if not exists listings_category_idx on public.listings(category_id);

-- 4. AFFILIATE REFERRALS -------------------------------------------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_email text,
  referred_user_id uuid references public.profiles(id),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'paid')),
  payout_amount numeric(6,2) default 1.00,
  created_at timestamptz not null default now()
);

alter table public.referrals enable row level security;

create policy "Referrers can see their own referrals"
  on public.referrals for select
  using (referrer_id = auth.uid());

create policy "Anyone can record a referral"
  on public.referrals for insert
  with check (true);

-- 5. AUTO-CREATE PROFILE ON SIGNUP ----------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New user'),
    coalesce(new.raw_user_meta_data->>'role', 'buyer')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Done. Next: Project Settings → API → copy your Project URL and
-- anon public key into assets/supabase-client.js
