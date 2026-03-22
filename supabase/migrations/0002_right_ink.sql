CREATE TYPE "public"."feedback_status" AS ENUM('open', 'reviewed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."feedback_type" AS ENUM('flag', 'correction');--> statement-breakpoint
CREATE TABLE "food_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_id" uuid NOT NULL,
	"nutrient_id" uuid,
	"food_variant_id" uuid,
	"user_id" uuid NOT NULL,
	"type" "feedback_type" NOT NULL,
	"message" text NOT NULL,
	"suggested_value" numeric,
	"suggested_unit" text,
	"source_url" text,
	"status" "feedback_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "food_feedback" ADD CONSTRAINT "food_feedback_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_feedback" ADD CONSTRAINT "food_feedback_nutrient_id_nutrients_id_fk" FOREIGN KEY ("nutrient_id") REFERENCES "public"."nutrients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_feedback" ADD CONSTRAINT "food_feedback_food_variant_id_food_variants_id_fk" FOREIGN KEY ("food_variant_id") REFERENCES "public"."food_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Enable RLS on food_feedback
ALTER TABLE "food_feedback" ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON "food_feedback"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own feedback, admins can read all
CREATE POLICY "Users read own feedback, admins read all"
  ON "food_feedback"
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins can update feedback (status changes)
CREATE POLICY "Admins can update feedback"
  ON "food_feedback"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins can delete feedback
CREATE POLICY "Admins can delete feedback"
  ON "food_feedback"
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );