CREATE TABLE IF NOT EXISTS "app_config" (
  "key" text PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "description" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- RLS: only admins can read/write app_config
ALTER TABLE "app_config" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_app_config" ON "app_config"
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_write_app_config" ON "app_config"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
