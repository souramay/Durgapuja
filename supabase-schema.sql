-- ==============================================================================
-- Sharodiya (Durgapuja) — Supabase Schema for Ads & Analytics
-- ==============================================================================
-- Run this SQL in your Supabase Project -> SQL Editor to initialize the tables.

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. ADS TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.ads (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  subtitle text default '',
  badge text default 'SPONSORED',
  destination_url text not null,
  image_url text default '',
  client_name text default 'Direct Sponsor',
  client_email text default '',
  duration_seconds integer not null default 7 check (duration_seconds >= 2),
  priority integer not null default 1,
  is_active boolean not null default true,
  start_at timestamptz default null,
  end_at timestamptz default null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Index for querying active ads quickly
create index if not exists idx_ads_active_schedule on public.ads (is_active, priority desc, created_at desc);

-- ------------------------------------------------------------------------------
-- 2. AD ANALYTICS TABLE (Event Log for Impressions & Clicks)
-- ------------------------------------------------------------------------------
create table if not exists public.ad_analytics (
  id bigint generated always as identity primary key,
  ad_id uuid not null references public.ads(id) on delete cascade,
  client_name text default '',
  event_type text not null check (event_type in ('impression', 'click')),
  device_type text default 'desktop',
  referrer text default '',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Indexes for lightning-fast analytics aggregation
create index if not exists idx_analytics_ad_event on public.ad_analytics (ad_id, event_type);
create index if not exists idx_analytics_client on public.ad_analytics (client_name);
create index if not exists idx_analytics_created on public.ad_analytics (created_at desc);

-- ------------------------------------------------------------------------------
-- 3. ANALYTICS SUMMARY VIEW
-- ------------------------------------------------------------------------------
create or replace view public.ad_analytics_summary as
select
  a.id as ad_id,
  a.title,
  a.client_name,
  a.is_active,
  a.priority,
  a.duration_seconds,
  a.start_at,
  a.end_at,
  a.created_at,
  coalesce(sum(case when ev.event_type = 'impression' then 1 else 0 end), 0) as total_impressions,
  coalesce(sum(case when ev.event_type = 'click' then 1 else 0 end), 0) as total_clicks,
  case
    when coalesce(sum(case when ev.event_type = 'impression' then 1 else 0 end), 0) > 0
    then round(
      (coalesce(sum(case when ev.event_type = 'click' then 1 else 0 end), 0)::numeric /
       coalesce(sum(case when ev.event_type = 'impression' then 1 else 0 end), 0)::numeric) * 100.0,
      2
    )
    else 0.00
  end as ctr_percentage
from public.ads a
left join public.ad_analytics ev on a.id = ev.ad_id
group by a.id, a.title, a.client_name, a.is_active, a.priority, a.duration_seconds, a.start_at, a.end_at, a.created_at;

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
alter table public.ads enable row level security;
alter table public.ad_analytics enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Public can view active scheduled ads" on public.ads;
drop policy if exists "Admins have full access to ads" on public.ads;
drop policy if exists "Public can record impressions and clicks" on public.ad_analytics;
drop policy if exists "Admins have full access to analytics" on public.ad_analytics;

-- Policy: Public anon visitors can read active ads that are in their scheduled window
create policy "Public can view active scheduled ads" on public.ads
  for select
  using (
    is_active = true
    and (start_at is null or start_at <= now())
    and (end_at is null or end_at >= now())
  );

-- Policy: Authenticated users (admin) or service role can perform full CRUD on ads
create policy "Admins have full access to ads" on public.ads
  for all
  to authenticated
  using (true)
  with check (true);

-- Policy: Public anon visitors can log impressions and clicks
create policy "Public can record impressions and clicks" on public.ad_analytics
  for insert
  to anon, authenticated
  with check (true);

-- Policy: Authenticated admin can read all analytics events
create policy "Admins have full access to analytics" on public.ad_analytics
  for select
  to authenticated
  using (true);

-- ------------------------------------------------------------------------------
-- 5. INITIAL SAMPLE SEED DATA (Durga Puja festive sponsors)
-- ------------------------------------------------------------------------------
insert into public.ads (id, title, subtitle, badge, destination_url, image_url, client_name, duration_seconds, priority, is_active)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'বাঙালির পুজোর সেরা গান শুনুন',
    'Special festive puja playlist collection by SVF Music',
    'SPONSORED',
    'https://www.youtube.com/',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=120&auto=format&fit=crop&q=80',
    'SVF Music',
    8,
    10,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'উৎসবের আনন্দ ও সাজপোশাক',
    'Durga Puja festive ethnic collection — Up to 40% Off',
    'OFFER',
    'https://www.myntra.com/',
    'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=120&auto=format&fit=crop&q=80',
    'Pujo Fashion House',
    7,
    5,
    true
  )
on conflict (id) do nothing;
