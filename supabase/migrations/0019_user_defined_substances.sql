-- Add created_by column to substances (NULL = system substance, user_id = user-created)
-- No FK constraint: public.user is a view (cannot be FK target) and auth.users.id
-- is uuid while our user IDs are stored as text. Drizzle ORM has the reference for
-- relation mapping; RLS policies enforce ownership at the DB level.
ALTER TABLE substances ADD COLUMN IF NOT EXISTS created_by text;

-- Drop the unique constraint on name since users may create substances with duplicate names
ALTER TABLE substances DROP CONSTRAINT IF EXISTS substances_name_unique;

-- Add a unique constraint scoped to system substances only (no two system substances share a name)
CREATE UNIQUE INDEX IF NOT EXISTS substances_system_name_unique
  ON substances (name)
  WHERE created_by IS NULL;

-- Update RLS policies: users can manage their own custom substances
DROP POLICY IF EXISTS "substances_insert" ON substances;
DROP POLICY IF EXISTS "substances_update" ON substances;
DROP POLICY IF EXISTS "substances_delete" ON substances;

-- Admins can insert any substance; regular users can insert only with their own user ID
CREATE POLICY "substances_insert" ON substances FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (created_by = auth.uid()::text)
  );

-- Admins can update any substance; users can update only their own custom substances
CREATE POLICY "substances_update" ON substances FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (created_by = auth.uid()::text)
  )
  WITH CHECK (
    public.is_admin()
    OR (created_by = auth.uid()::text)
  );

-- Admins can delete any substance; users can delete only their own custom substances
CREATE POLICY "substances_delete" ON substances FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (created_by = auth.uid()::text)
  );

-- Update SELECT policy: users see system substances + their own custom substances
DROP POLICY IF EXISTS "substances_select" ON substances;
CREATE POLICY "substances_select" ON substances FOR SELECT TO authenticated
  USING (
    created_by IS NULL
    OR created_by = auth.uid()::text
    OR public.is_admin()
  );
