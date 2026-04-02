-- Add created_by column to nutrients (NULL = system nutrient, user_id = user-created)
ALTER TABLE nutrients ADD COLUMN created_by text REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop the unique constraint on name since users may create nutrients with duplicate names
ALTER TABLE nutrients DROP CONSTRAINT IF EXISTS nutrients_name_unique;

-- Add a unique constraint scoped to system nutrients only (no two system nutrients share a name)
CREATE UNIQUE INDEX nutrients_system_name_unique ON nutrients (name) WHERE created_by IS NULL;

-- Update RLS policies: users can manage their own custom nutrients
DROP POLICY IF EXISTS "nutrients_insert" ON nutrients;
DROP POLICY IF EXISTS "nutrients_update" ON nutrients;
DROP POLICY IF EXISTS "nutrients_delete" ON nutrients;

-- Admins can insert any nutrient; regular users can insert only with their own user ID
CREATE POLICY "nutrients_insert" ON nutrients FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (created_by = auth.uid()::text)
  );

-- Admins can update any nutrient; users can update only their own custom nutrients
CREATE POLICY "nutrients_update" ON nutrients FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (created_by = auth.uid()::text)
  );

-- Admins can delete any nutrient; users can delete only their own custom nutrients
CREATE POLICY "nutrients_delete" ON nutrients FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (created_by = auth.uid()::text)
  );

-- Update SELECT policy: users see system nutrients + their own custom nutrients
DROP POLICY IF EXISTS "nutrients_select" ON nutrients;
CREATE POLICY "nutrients_select" ON nutrients FOR SELECT TO authenticated
  USING (
    created_by IS NULL
    OR created_by = auth.uid()::text
    OR public.is_admin()
  );
