-- Enable RLS on all tables
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrients ENABLE ROW LEVEL SECURITY;
ALTER TABLE serving_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrient_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE yield_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_calculation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE resolved_nutrient_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_nutrient_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumption_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- PUBLIC READ TABLES
-- Authenticated users can SELECT; only admins can write
-- ============================================================

-- foods
CREATE POLICY "foods_select" ON foods FOR SELECT TO authenticated USING (true);
CREATE POLICY "foods_insert" ON foods FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "foods_update" ON foods FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "foods_delete" ON foods FOR DELETE TO authenticated USING (public.is_admin());

-- food_aliases
CREATE POLICY "food_aliases_select" ON food_aliases FOR SELECT TO authenticated USING (true);
CREATE POLICY "food_aliases_insert" ON food_aliases FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "food_aliases_update" ON food_aliases FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "food_aliases_delete" ON food_aliases FOR DELETE TO authenticated USING (public.is_admin());

-- food_variants
CREATE POLICY "food_variants_select" ON food_variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "food_variants_insert" ON food_variants FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "food_variants_update" ON food_variants FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "food_variants_delete" ON food_variants FOR DELETE TO authenticated USING (public.is_admin());

-- nutrients
CREATE POLICY "nutrients_select" ON nutrients FOR SELECT TO authenticated USING (true);
CREATE POLICY "nutrients_insert" ON nutrients FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "nutrients_update" ON nutrients FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "nutrients_delete" ON nutrients FOR DELETE TO authenticated USING (public.is_admin());

-- serving_measures
CREATE POLICY "serving_measures_select" ON serving_measures FOR SELECT TO authenticated USING (true);
CREATE POLICY "serving_measures_insert" ON serving_measures FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "serving_measures_update" ON serving_measures FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "serving_measures_delete" ON serving_measures FOR DELETE TO authenticated USING (public.is_admin());

-- resolved_nutrient_values
CREATE POLICY "resolved_nutrient_values_select" ON resolved_nutrient_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "resolved_nutrient_values_insert" ON resolved_nutrient_values FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "resolved_nutrient_values_update" ON resolved_nutrient_values FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "resolved_nutrient_values_delete" ON resolved_nutrient_values FOR DELETE TO authenticated USING (public.is_admin());

-- retention_profiles
CREATE POLICY "retention_profiles_select" ON retention_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "retention_profiles_insert" ON retention_profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "retention_profiles_update" ON retention_profiles FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "retention_profiles_delete" ON retention_profiles FOR DELETE TO authenticated USING (public.is_admin());

-- yield_profiles
CREATE POLICY "yield_profiles_select" ON yield_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "yield_profiles_insert" ON yield_profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "yield_profiles_update" ON yield_profiles FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "yield_profiles_delete" ON yield_profiles FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================
-- ADMIN-ONLY TABLES
-- Authenticated can SELECT; only admins can INSERT/UPDATE/DELETE
-- ============================================================

-- sources
CREATE POLICY "sources_select" ON sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "sources_insert" ON sources FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "sources_update" ON sources FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "sources_delete" ON sources FOR DELETE TO authenticated USING (public.is_admin());

-- source_records
CREATE POLICY "source_records_select" ON source_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "source_records_insert" ON source_records FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "source_records_update" ON source_records FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "source_records_delete" ON source_records FOR DELETE TO authenticated USING (public.is_admin());

-- nutrient_observations
CREATE POLICY "nutrient_observations_select" ON nutrient_observations FOR SELECT TO authenticated USING (true);
CREATE POLICY "nutrient_observations_insert" ON nutrient_observations FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "nutrient_observations_update" ON nutrient_observations FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "nutrient_observations_delete" ON nutrient_observations FOR DELETE TO authenticated USING (public.is_admin());

-- evidence_items
CREATE POLICY "evidence_items_select" ON evidence_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "evidence_items_insert" ON evidence_items FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "evidence_items_update" ON evidence_items FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "evidence_items_delete" ON evidence_items FOR DELETE TO authenticated USING (public.is_admin());

-- reviews
CREATE POLICY "reviews_select" ON reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "reviews_insert" ON reviews FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "reviews_update" ON reviews FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "reviews_delete" ON reviews FOR DELETE TO authenticated USING (public.is_admin());

-- variant_calculation_rules
CREATE POLICY "variant_calculation_rules_select" ON variant_calculation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "variant_calculation_rules_insert" ON variant_calculation_rules FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "variant_calculation_rules_update" ON variant_calculation_rules FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "variant_calculation_rules_delete" ON variant_calculation_rules FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================
-- USER-SCOPED TABLES
-- Users can only access their own rows
-- ============================================================

-- user_nutrient_limits
CREATE POLICY "user_nutrient_limits_select" ON user_nutrient_limits FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_nutrient_limits_insert" ON user_nutrient_limits FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_nutrient_limits_update" ON user_nutrient_limits FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_nutrient_limits_delete" ON user_nutrient_limits FOR DELETE TO authenticated USING (user_id = auth.uid());

-- consumption_logs
CREATE POLICY "consumption_logs_select" ON consumption_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "consumption_logs_insert" ON consumption_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "consumption_logs_update" ON consumption_logs FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "consumption_logs_delete" ON consumption_logs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- PROFILES
-- Users can read and update their own profile (except role)
-- ============================================================

CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));
