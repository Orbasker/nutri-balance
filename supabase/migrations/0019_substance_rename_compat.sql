DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'ai_task_type' AND e.enumlabel = 'nutrient_research'
  ) THEN
    ALTER TYPE public.ai_task_type RENAME VALUE 'nutrient_research' TO 'substance_research';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'ai_run_type' AND e.enumlabel = 'nutrient_research_task'
  ) THEN
    ALTER TYPE public.ai_run_type RENAME VALUE 'nutrient_research_task' TO 'substance_research_task';
  END IF;
END
$$;

ALTER TABLE IF EXISTS public.nutrients RENAME TO substances;
ALTER TABLE IF EXISTS public.nutrient_observations RENAME TO substance_observations;
ALTER TABLE IF EXISTS public.resolved_nutrient_values RENAME TO resolved_substance_values;
ALTER TABLE IF EXISTS public.user_nutrient_limits RENAME TO user_substance_limits;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'retention_profiles' AND column_name = 'nutrient_id'
  ) THEN
    ALTER TABLE public.retention_profiles RENAME COLUMN nutrient_id TO substance_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'food_feedback' AND column_name = 'nutrient_id'
  ) THEN
    ALTER TABLE public.food_feedback RENAME COLUMN nutrient_id TO substance_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_tasks' AND column_name = 'target_nutrient_id'
  ) THEN
    ALTER TABLE public.ai_tasks RENAME COLUMN target_nutrient_id TO target_substance_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'substance_observations' AND column_name = 'nutrient_id'
  ) THEN
    ALTER TABLE public.substance_observations RENAME COLUMN nutrient_id TO substance_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resolved_substance_values' AND column_name = 'nutrient_id'
  ) THEN
    ALTER TABLE public.resolved_substance_values RENAME COLUMN nutrient_id TO substance_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_substance_limits' AND column_name = 'nutrient_id'
  ) THEN
    ALTER TABLE public.user_substance_limits RENAME COLUMN nutrient_id TO substance_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'consumption_logs' AND column_name = 'nutrient_snapshot'
  ) THEN
    ALTER TABLE public.consumption_logs RENAME COLUMN nutrient_snapshot TO substance_snapshot;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'retention_profiles_nutrient_id_nutrients_id_fk') THEN
    ALTER TABLE public.retention_profiles
      RENAME CONSTRAINT retention_profiles_nutrient_id_nutrients_id_fk
      TO retention_profiles_substance_id_substances_id_fk;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_items_observation_id_nutrient_observations_id_fk') THEN
    ALTER TABLE public.evidence_items
      RENAME CONSTRAINT evidence_items_observation_id_nutrient_observations_id_fk
      TO evidence_items_observation_id_substance_observations_id_fk;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nutrient_observations_food_variant_id_food_variants_id_fk') THEN
    ALTER TABLE public.substance_observations
      RENAME CONSTRAINT nutrient_observations_food_variant_id_food_variants_id_fk
      TO substance_observations_food_variant_id_food_variants_id_fk;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nutrient_observations_nutrient_id_nutrients_id_fk') THEN
    ALTER TABLE public.substance_observations
      RENAME CONSTRAINT nutrient_observations_nutrient_id_nutrients_id_fk
      TO substance_observations_substance_id_substances_id_fk;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nutrient_observations_source_record_id_source_records_id_fk') THEN
    ALTER TABLE public.substance_observations
      RENAME CONSTRAINT nutrient_observations_source_record_id_source_records_id_fk
      TO substance_observations_source_record_id_source_records_id_fk;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resolved_nutrient_values_food_variant_id_food_variants_id_fk') THEN
    ALTER TABLE public.resolved_substance_values
      RENAME CONSTRAINT resolved_nutrient_values_food_variant_id_food_variants_id_fk
      TO resolved_substance_values_food_variant_id_food_variants_id_fk;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resolved_nutrient_values_nutrient_id_nutrients_id_fk') THEN
    ALTER TABLE public.resolved_substance_values
      RENAME CONSTRAINT resolved_nutrient_values_nutrient_id_nutrients_id_fk
      TO resolved_substance_values_substance_id_substances_id_fk;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_nutrient_limits_nutrient_id_nutrients_id_fk') THEN
    ALTER TABLE public.user_substance_limits
      RENAME CONSTRAINT user_nutrient_limits_nutrient_id_nutrients_id_fk
      TO user_substance_limits_substance_id_substances_id_fk;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_nutrient_limits_user_id_user_id_fk') THEN
    ALTER TABLE public.user_substance_limits
      RENAME CONSTRAINT user_nutrient_limits_user_id_user_id_fk
      TO user_substance_limits_user_id_user_id_fk;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_tasks_target_nutrient_id_nutrients_id_fk') THEN
    ALTER TABLE public.ai_tasks
      RENAME CONSTRAINT ai_tasks_target_nutrient_id_nutrients_id_fk
      TO ai_tasks_target_substance_id_substances_id_fk;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_feedback_nutrient_id_nutrients_id_fk') THEN
    ALTER TABLE public.food_feedback
      RENAME CONSTRAINT food_feedback_nutrient_id_nutrients_id_fk
      TO food_feedback_substance_id_substances_id_fk;
  END IF;
END
$$;

ALTER INDEX IF EXISTS public.nutrients_name_unique RENAME TO substances_name_unique;
ALTER INDEX IF EXISTS public.nutrients_system_name_unique RENAME TO substances_system_name_unique;
