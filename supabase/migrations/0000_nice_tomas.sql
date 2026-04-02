CREATE TYPE "public"."preparation_method" AS ENUM('raw', 'boiled', 'steamed', 'grilled', 'baked', 'fried', 'roasted', 'sauteed', 'poached', 'blanched', 'drained');--> statement-breakpoint
CREATE TYPE "public"."derivation_type" AS ENUM('analytical', 'calculated', 'estimated', 'imputed', 'ai_extracted');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected', 'needs_revision');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('government_db', 'scientific_paper', 'industry', 'user_submission', 'ai_generated');--> statement-breakpoint
CREATE TYPE "public"."limit_mode" AS ENUM('strict', 'stability');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "retention_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"substance_id" uuid NOT NULL,
	"preparation_method" "preparation_method" NOT NULL,
	"retention_factor" numeric NOT NULL,
	"source_id" uuid
);
--> statement-breakpoint
CREATE TABLE "variant_calculation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_variant_id" uuid NOT NULL,
	"base_variant_id" uuid NOT NULL,
	"retention_profile_id" uuid,
	"yield_profile_id" uuid
);
--> statement-breakpoint
CREATE TABLE "yield_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_id" uuid NOT NULL,
	"preparation_method" "preparation_method" NOT NULL,
	"yield_factor" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"language" text DEFAULT 'en',
	"source" text
);
--> statement-breakpoint
CREATE TABLE "food_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_id" uuid NOT NULL,
	"preparation_method" "preparation_method" NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "serving_measures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_variant_id" uuid NOT NULL,
	"label" text NOT NULL,
	"grams_equivalent" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "substances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"display_name" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	CONSTRAINT "substances_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "evidence_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"observation_id" uuid NOT NULL,
	"snippet" text,
	"page_ref" text,
	"row_locator" text,
	"url" text
);
--> statement-breakpoint
CREATE TABLE "substance_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_variant_id" uuid NOT NULL,
	"substance_id" uuid NOT NULL,
	"value" numeric NOT NULL,
	"unit" text NOT NULL,
	"basis_amount" numeric DEFAULT '100',
	"basis_unit" text DEFAULT 'g',
	"source_record_id" uuid,
	"derivation_type" "derivation_type" NOT NULL,
	"confidence_score" integer DEFAULT 50,
	"review_status" "review_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text,
	"raw_data" jsonb,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"type" "source_type" NOT NULL,
	"trust_level" integer DEFAULT 50
);
--> statement-breakpoint
CREATE TABLE "resolved_substance_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_variant_id" uuid NOT NULL,
	"substance_id" uuid NOT NULL,
	"value_per_100g" numeric NOT NULL,
	"confidence_score" integer DEFAULT 50,
	"confidence_label" text,
	"source_summary" text,
	"resolved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"status" "review_status" NOT NULL,
	"notes" text,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumption_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"food_variant_id" uuid NOT NULL,
	"serving_measure_id" uuid,
	"quantity" numeric NOT NULL,
	"substance_snapshot" jsonb,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meal_label" text
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_substance_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"substance_id" uuid NOT NULL,
	"daily_limit" numeric NOT NULL,
	"mode" "limit_mode" DEFAULT 'strict' NOT NULL,
	"range_min" numeric,
	"range_max" numeric
);
--> statement-breakpoint
ALTER TABLE "retention_profiles" ADD CONSTRAINT "retention_profiles_substance_id_substances_id_fk" FOREIGN KEY ("substance_id") REFERENCES "public"."substances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_profiles" ADD CONSTRAINT "retention_profiles_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_calculation_rules" ADD CONSTRAINT "variant_calculation_rules_food_variant_id_food_variants_id_fk" FOREIGN KEY ("food_variant_id") REFERENCES "public"."food_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_calculation_rules" ADD CONSTRAINT "variant_calculation_rules_base_variant_id_food_variants_id_fk" FOREIGN KEY ("base_variant_id") REFERENCES "public"."food_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_calculation_rules" ADD CONSTRAINT "variant_calculation_rules_retention_profile_id_retention_profiles_id_fk" FOREIGN KEY ("retention_profile_id") REFERENCES "public"."retention_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_calculation_rules" ADD CONSTRAINT "variant_calculation_rules_yield_profile_id_yield_profiles_id_fk" FOREIGN KEY ("yield_profile_id") REFERENCES "public"."yield_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yield_profiles" ADD CONSTRAINT "yield_profiles_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_aliases" ADD CONSTRAINT "food_aliases_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_variants" ADD CONSTRAINT "food_variants_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serving_measures" ADD CONSTRAINT "serving_measures_food_variant_id_food_variants_id_fk" FOREIGN KEY ("food_variant_id") REFERENCES "public"."food_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_observation_id_substance_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."substance_observations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substance_observations" ADD CONSTRAINT "substance_observations_food_variant_id_food_variants_id_fk" FOREIGN KEY ("food_variant_id") REFERENCES "public"."food_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substance_observations" ADD CONSTRAINT "substance_observations_substance_id_substances_id_fk" FOREIGN KEY ("substance_id") REFERENCES "public"."substances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substance_observations" ADD CONSTRAINT "substance_observations_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resolved_substance_values" ADD CONSTRAINT "resolved_substance_values_food_variant_id_food_variants_id_fk" FOREIGN KEY ("food_variant_id") REFERENCES "public"."food_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resolved_substance_values" ADD CONSTRAINT "resolved_substance_values_substance_id_substances_id_fk" FOREIGN KEY ("substance_id") REFERENCES "public"."substances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption_logs" ADD CONSTRAINT "consumption_logs_food_variant_id_food_variants_id_fk" FOREIGN KEY ("food_variant_id") REFERENCES "public"."food_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption_logs" ADD CONSTRAINT "consumption_logs_serving_measure_id_serving_measures_id_fk" FOREIGN KEY ("serving_measure_id") REFERENCES "public"."serving_measures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_substance_limits" ADD CONSTRAINT "user_substance_limits_substance_id_substances_id_fk" FOREIGN KEY ("substance_id") REFERENCES "public"."substances"("id") ON DELETE cascade ON UPDATE no action;