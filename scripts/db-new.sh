#!/usr/bin/env bash
# Create a new idempotent migration file with the next sequence number.
#
# Usage:
#   bun run db:new "add_user_preferences"
#   bun run db:new "fix_rls_policies"
#
# Creates: supabase/migrations/NNNN_<name>.sql with an idempotent template.

set -euo pipefail

MIGRATIONS_DIR="supabase/migrations"

if [ -z "${1:-}" ]; then
  echo "Usage: bun run db:new <migration_name>"
  echo "  Example: bun run db:new add_user_preferences"
  exit 1
fi

# Sanitize name: lowercase, replace spaces/hyphens with underscores, strip non-alphanumeric
NAME=$(echo "$1" | tr '[:upper:]' '[:lower:]' | tr ' -' '_' | sed 's/[^a-z0-9_]//g')

# Find next sequence number
LAST=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sed 's/.*\///' | sort -n | tail -1 | grep -o '^[0-9]*' || echo "-1")
NEXT=$(printf "%04d" $((10#$LAST + 1)))

FILEPATH="$MIGRATIONS_DIR/${NEXT}_${NAME}.sql"

cat > "$FILEPATH" << 'TEMPLATE'
-- Migration: MIGRATION_NAME
-- Created: MIGRATION_DATE
--
-- IMPORTANT: All statements must be idempotent.
-- - Tables:    CREATE TABLE IF NOT EXISTS
-- - Columns:   ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- - Indexes:   CREATE INDEX IF NOT EXISTS
-- - Policies:  DROP POLICY IF EXISTS ... ; CREATE POLICY ...
-- - Triggers:  DROP TRIGGER IF EXISTS ... ; CREATE TRIGGER ...
-- - Functions: CREATE OR REPLACE FUNCTION
-- - Enums:     DO $$ BEGIN ... EXCEPTION WHEN ... END $$;
--
-- Run `bash scripts/lint-migrations.sh <this-file>` to verify idempotency.


TEMPLATE

# Fill in the placeholders
sed -i '' "s/MIGRATION_NAME/${NAME}/g" "$FILEPATH"
sed -i '' "s/MIGRATION_DATE/$(date +%Y-%m-%d)/g" "$FILEPATH"

echo "Created: $FILEPATH"
echo ""
echo "Remember:"
echo "  - Use DROP ... IF EXISTS before CREATE POLICY/TRIGGER"
echo "  - Use IF NOT EXISTS for tables, columns, indexes"
echo "  - Run: bash scripts/lint-migrations.sh $FILEPATH"
