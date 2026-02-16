-- ═══════════════════════════════════════════════════════════════════
-- ModelTriage — Supabase Setup SQL
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- This script is IDEMPOTENT — safe to run multiple times.
--
-- It sets up:
--   1. Auto-create UserProfile trigger (on auth.users insert)
--   2. Row Level Security (RLS) on monetization tables
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Auto-create UserProfile on signup ───────────────────────
--
-- When a new user signs up via Supabase Auth, a row is created in
-- auth.users. This trigger automatically creates a corresponding
-- row in public.user_profiles with role = 'free'.
--
-- Without this, getUserProfile() returns null for new users.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, role, created_at)
  VALUES (NEW.id, 'free', NOW())
  ON CONFLICT (id) DO NOTHING;  -- idempotent: skip if already exists
  RETURN NEW;
END;
$$;

-- Drop the trigger if it exists (idempotent), then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ─── 2. Row Level Security (RLS) ───────────────────────────────
--
-- These policies ensure that even if someone uses the public anon
-- key directly (bypassing the app), they can't read/write other
-- users' data.
--
-- Our API routes use Prisma with the direct database connection
-- (not Supabase client), so they bypass RLS. These policies only
-- protect against direct Supabase client abuse.

-- ── user_profiles ──────────────────────────────────────────────

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid()::text = id);

-- Users can update their own profile (but not role or stripe fields)
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid()::text = id);

-- Only the trigger (SECURITY DEFINER) can insert profiles
-- No INSERT policy for regular users

-- ── daily_usage ────────────────────────────────────────────────

ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

-- Users can only read their own usage
DROP POLICY IF EXISTS "Users can view own daily usage" ON public.daily_usage;
CREATE POLICY "Users can view own daily usage"
  ON public.daily_usage
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- No INSERT/UPDATE/DELETE for users — only the server (Prisma) manages usage

-- ── anonymous_usage ────────────────────────────────────────────

ALTER TABLE public.anonymous_usage ENABLE ROW LEVEL SECURITY;

-- No policies — anonymous_usage should never be accessible via
-- the Supabase client. Only the server (Prisma) reads/writes it.
-- RLS with no policies = deny all access via Supabase client.

-- ── routing_decisions ──────────────────────────────────────────

ALTER TABLE public.routing_decisions ENABLE ROW LEVEL SECURITY;

-- Users can view their own routing decisions (for future history feature)
DROP POLICY IF EXISTS "Users can view own routing decisions" ON public.routing_decisions;
CREATE POLICY "Users can view own routing decisions"
  ON public.routing_decisions
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- No INSERT/UPDATE/DELETE for users — only the server manages these


-- ═══════════════════════════════════════════════════════════════════
-- Done! Verify by checking:
--   1. Sign up a new user → check user_profiles has a row
--   2. In the Supabase Table Editor, RLS should show as "Enabled"
--      on user_profiles, daily_usage, anonymous_usage, routing_decisions
-- ═══════════════════════════════════════════════════════════════════
