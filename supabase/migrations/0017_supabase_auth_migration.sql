-- ============================================================
-- Migration: Better Auth → Supabase Auth
--
-- 1. Migrate users from public.user to auth.users
-- 2. Migrate Google OAuth identities to auth.identities
-- 3. Drop Better Auth tables (session, account, verification)
-- 4. Replace public.user table with a view over auth.users
-- 5. Re-point FK constraints to auth.users
-- 6. Re-enable RLS on all tables with comprehensive policies
-- 7. Update the handle_new_user trigger for Google metadata
-- ============================================================

-- ============================================================
-- STEP 1: Create ID mapping table (Better Auth text IDs → new UUIDs)
-- ============================================================

-- Better Auth IDs are random strings (not UUIDs), but auth.users.id is uuid.
-- Generate new UUIDs and keep a mapping so we can update all FK references.
CREATE TEMP TABLE user_id_map (
  old_id text PRIMARY KEY,
  new_id uuid NOT NULL DEFAULT gen_random_uuid()
);

INSERT INTO user_id_map (old_id)
SELECT id FROM public."user";

-- ============================================================
-- STEP 2: Migrate existing users to auth.users (with new UUIDs)
-- ============================================================

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  m.new_id,
  'authenticated',
  'authenticated',
  u.email,
  COALESCE(a.password, ''),
  CASE WHEN u.email_verified THEN now() ELSE NULL END,
  jsonb_build_object(
    'display_name', u.name,
    'first_name', u.first_name,
    'last_name', u.last_name
  ),
  jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
  u.created_at,
  u.updated_at,
  '',
  ''
FROM public."user" u
JOIN user_id_map m ON m.old_id = u.id
LEFT JOIN public.account a ON a.user_id = u.id AND a.provider_id = 'credential'
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users au WHERE au.email = u.email
);

-- ============================================================
-- STEP 3: Drop FK constraints from public.user (must happen before ID updates)
-- ============================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_user_id_fk;
ALTER TABLE consumption_logs DROP CONSTRAINT IF EXISTS consumption_logs_user_id_user_id_fk;
ALTER TABLE user_nutrient_limits DROP CONSTRAINT IF EXISTS user_nutrient_limits_user_id_user_id_fk;
ALTER TABLE chat_conversations DROP CONSTRAINT IF EXISTS chat_conversations_user_id_user_id_fk;
ALTER TABLE food_feedback DROP CONSTRAINT IF EXISTS food_feedback_user_id_user_id_fk;

-- Also drop Better Auth internal table FKs
ALTER TABLE account DROP CONSTRAINT IF EXISTS account_user_id_user_id_fk;
ALTER TABLE session DROP CONSTRAINT IF EXISTS session_user_id_user_id_fk;

-- ============================================================
-- STEP 4: Update all FK references from old text IDs to new UUID text IDs
-- ============================================================

UPDATE profiles SET id = m.new_id::text
FROM user_id_map m WHERE profiles.id = m.old_id;

UPDATE consumption_logs SET user_id = m.new_id::text
FROM user_id_map m WHERE consumption_logs.user_id = m.old_id;

UPDATE user_nutrient_limits SET user_id = m.new_id::text
FROM user_id_map m WHERE user_nutrient_limits.user_id = m.old_id;

UPDATE chat_conversations SET user_id = m.new_id::text
FROM user_id_map m WHERE chat_conversations.user_id = m.old_id;

UPDATE food_feedback SET user_id = m.new_id::text
FROM user_id_map m WHERE food_feedback.user_id = m.old_id;

UPDATE platform_accounts SET user_id = m.new_id::text
FROM user_id_map m WHERE platform_accounts.user_id = m.old_id;

UPDATE ai_tasks SET user_id = m.new_id::text
FROM user_id_map m WHERE ai_tasks.user_id = m.old_id;

UPDATE ai_runs SET trigger_user_id = m.new_id::text
FROM user_id_map m WHERE ai_runs.trigger_user_id = m.old_id;

-- ============================================================
-- STEP 5: Migrate Google OAuth identities
-- ============================================================

INSERT INTO auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  a.account_id,
  m.new_id,
  jsonb_build_object('sub', a.account_id, 'email', u.email),
  'google',
  now(),
  a.created_at,
  a.updated_at
FROM public.account a
JOIN public."user" u ON u.id = a.user_id
JOIN user_id_map m ON m.old_id = a.user_id
WHERE a.provider_id = 'google'
AND NOT EXISTS (
  SELECT 1 FROM auth.identities ai
  WHERE ai.user_id = m.new_id AND ai.provider = 'google'
);

-- Also add email identities for password users
INSERT INTO auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  au.id::text,
  au.id,
  jsonb_build_object('sub', au.id::text, 'email', au.email),
  'email',
  now(),
  au.created_at,
  au.updated_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities ai
  WHERE ai.user_id = au.id AND ai.provider = 'email'
);

-- ============================================================
-- STEP 6: Drop Better Auth tables and replace user table with view
-- ============================================================

DROP TABLE IF EXISTS public.session CASCADE;
DROP TABLE IF EXISTS public.account CASCADE;
DROP TABLE IF EXISTS public.verification CASCADE;
DROP TABLE IF EXISTS public."user" CASCADE;

-- Create a view over auth.users for Drizzle read compatibility
CREATE VIEW public."user" AS
SELECT
  id::text AS id,
  COALESCE(raw_user_meta_data->>'display_name', raw_user_meta_data->>'full_name', email) AS name,
  email,
  (email_confirmed_at IS NOT NULL) AS email_verified,
  raw_user_meta_data->>'avatar_url' AS image,
  created_at,
  updated_at,
  raw_user_meta_data->>'first_name' AS first_name,
  raw_user_meta_data->>'last_name' AS last_name
FROM auth.users;

-- ============================================================
-- STEP 7: Re-add FK constraints pointing to auth.users
-- Note: user_id columns are text, auth.users.id is uuid
-- We create a helper function to enable text→uuid FK validation
-- ============================================================

-- Since we can't FK text columns to uuid columns directly,
-- and we can't alter all user_id columns to uuid without major schema changes,
-- we rely on:
-- 1. RLS policies for access control (the main goal)
-- 2. Application-layer integrity (Supabase Auth manages user lifecycle)
-- 3. ON DELETE CASCADE via a trigger instead of FK constraints

-- Create a cleanup trigger that cascades user deletion
CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = OLD.id::text;
  DELETE FROM public.consumption_logs WHERE user_id = OLD.id::text;
  DELETE FROM public.user_nutrient_limits WHERE user_id = OLD.id::text;
  DELETE FROM public.chat_conversations WHERE user_id = OLD.id::text;
  DELETE FROM public.food_feedback WHERE user_id = OLD.id::text;
  DELETE FROM public.platform_accounts WHERE user_id = OLD.id::text;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_deleted();

-- ============================================================
-- STEP 8: Update handle_new_user trigger to handle Google metadata
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    NEW.id::text,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      ''
    ),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 9: Update is_admin() to cast auth.uid() to text
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role = 'admin'
  );
$$;

-- ============================================================
-- STEP 10: Re-enable RLS on all tables with comprehensive policies
-- ============================================================

-- First, drop all existing policies to start fresh
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ---- PUBLIC READ TABLES (all authenticated can SELECT; admins write) ----

ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "foods_select" ON foods FOR SELECT TO authenticated USING (true);
CREATE POLICY "foods_insert" ON foods FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "foods_update" ON foods FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "foods_delete" ON foods FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE food_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food_aliases_select" ON food_aliases FOR SELECT TO authenticated USING (true);
CREATE POLICY "food_aliases_insert" ON food_aliases FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "food_aliases_update" ON food_aliases FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "food_aliases_delete" ON food_aliases FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE food_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food_variants_select" ON food_variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "food_variants_insert" ON food_variants FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "food_variants_update" ON food_variants FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "food_variants_delete" ON food_variants FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE nutrients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nutrients_select" ON nutrients FOR SELECT TO authenticated USING (true);
CREATE POLICY "nutrients_insert" ON nutrients FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "nutrients_update" ON nutrients FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "nutrients_delete" ON nutrients FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE serving_measures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "serving_measures_select" ON serving_measures FOR SELECT TO authenticated USING (true);
CREATE POLICY "serving_measures_insert" ON serving_measures FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "serving_measures_update" ON serving_measures FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "serving_measures_delete" ON serving_measures FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE resolved_nutrient_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resolved_nutrient_values_select" ON resolved_nutrient_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "resolved_nutrient_values_insert" ON resolved_nutrient_values FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "resolved_nutrient_values_update" ON resolved_nutrient_values FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "resolved_nutrient_values_delete" ON resolved_nutrient_values FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE retention_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "retention_profiles_select" ON retention_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "retention_profiles_insert" ON retention_profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "retention_profiles_update" ON retention_profiles FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "retention_profiles_delete" ON retention_profiles FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE yield_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "yield_profiles_select" ON yield_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "yield_profiles_insert" ON yield_profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "yield_profiles_update" ON yield_profiles FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "yield_profiles_delete" ON yield_profiles FOR DELETE TO authenticated USING (public.is_admin());

-- ---- ADMIN-ONLY TABLES (authenticated can SELECT; admins write) ----

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sources_select" ON sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "sources_insert" ON sources FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "sources_update" ON sources FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "sources_delete" ON sources FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE source_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "source_records_select" ON source_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "source_records_insert" ON source_records FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "source_records_update" ON source_records FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "source_records_delete" ON source_records FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE nutrient_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nutrient_observations_select" ON nutrient_observations FOR SELECT TO authenticated USING (true);
CREATE POLICY "nutrient_observations_insert" ON nutrient_observations FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "nutrient_observations_update" ON nutrient_observations FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "nutrient_observations_delete" ON nutrient_observations FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence_items_select" ON evidence_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "evidence_items_insert" ON evidence_items FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "evidence_items_update" ON evidence_items FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "evidence_items_delete" ON evidence_items FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select" ON reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "reviews_insert" ON reviews FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "reviews_update" ON reviews FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "reviews_delete" ON reviews FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE variant_calculation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variant_calculation_rules_select" ON variant_calculation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "variant_calculation_rules_insert" ON variant_calculation_rules FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "variant_calculation_rules_update" ON variant_calculation_rules FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "variant_calculation_rules_delete" ON variant_calculation_rules FOR DELETE TO authenticated USING (public.is_admin());

-- ---- USER-SCOPED TABLES (users access only own rows) ----

ALTER TABLE user_nutrient_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_nutrient_limits_select" ON user_nutrient_limits FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
CREATE POLICY "user_nutrient_limits_insert" ON user_nutrient_limits FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "user_nutrient_limits_update" ON user_nutrient_limits FOR UPDATE TO authenticated USING (user_id = auth.uid()::text);
CREATE POLICY "user_nutrient_limits_delete" ON user_nutrient_limits FOR DELETE TO authenticated USING (user_id = auth.uid()::text);

ALTER TABLE consumption_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consumption_logs_select" ON consumption_logs FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
CREATE POLICY "consumption_logs_insert" ON consumption_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "consumption_logs_update" ON consumption_logs FOR UPDATE TO authenticated USING (user_id = auth.uid()::text);
CREATE POLICY "consumption_logs_delete" ON consumption_logs FOR DELETE TO authenticated USING (user_id = auth.uid()::text);

-- ---- PROFILES (users read/update own, can't change role) ----

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (id = auth.uid()::text);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid()::text);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text AND role = (SELECT role FROM profiles WHERE id = auth.uid()::text));

-- ---- CHAT (user-scoped conversations and messages) ----

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_conversations_select" ON chat_conversations FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
CREATE POLICY "chat_conversations_insert" ON chat_conversations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "chat_conversations_update" ON chat_conversations FOR UPDATE TO authenticated USING (user_id = auth.uid()::text);
CREATE POLICY "chat_conversations_delete" ON chat_conversations FOR DELETE TO authenticated USING (user_id = auth.uid()::text);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_messages_select" ON chat_messages FOR SELECT TO authenticated
  USING (conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = auth.uid()::text));
CREATE POLICY "chat_messages_insert" ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = auth.uid()::text));
CREATE POLICY "chat_messages_delete" ON chat_messages FOR DELETE TO authenticated
  USING (conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = auth.uid()::text));

-- ---- FOOD FEEDBACK (users create own, admins manage all) ----

ALTER TABLE food_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food_feedback_select" ON food_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR public.is_admin());
CREATE POLICY "food_feedback_insert" ON food_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "food_feedback_update" ON food_feedback FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY "food_feedback_delete" ON food_feedback FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---- AI TASKS (user can see own, admins see all) ----

ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_tasks_select" ON ai_tasks FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR public.is_admin());
CREATE POLICY "ai_tasks_insert" ON ai_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "ai_tasks_update" ON ai_tasks FOR UPDATE TO authenticated
  USING (public.is_admin());

-- ---- AI RUNS (admin-only) ----

ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_runs_select" ON ai_runs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "ai_runs_insert" ON ai_runs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "ai_runs_update" ON ai_runs FOR UPDATE TO authenticated USING (public.is_admin());

-- ---- PLATFORM ACCOUNTS (user-scoped + service role) ----

ALTER TABLE platform_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_accounts_select" ON platform_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);
CREATE POLICY "platform_accounts_service" ON platform_accounts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ---- ACCOUNT LINK TOKENS (service-role only) ----

ALTER TABLE account_link_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account_link_tokens_service" ON account_link_tokens FOR ALL TO service_role
  USING (true) WITH CHECK (true);
