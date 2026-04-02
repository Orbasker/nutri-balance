#!/usr/bin/env bash
# Generate a rollback migration that undoes a previous migration.
#
# Usage:
#   bun run db:revert 0020              # Revert migration 0020
#   bun run db:revert 0020_app_config   # Also accepts full prefix
#
# Creates a new migration (next sequence number) that:
#   - Drops tables created in the target migration
#   - Drops policies created in the target migration
#   - Drops triggers created in the target migration
#   - Drops functions created in the target migration
#   - Drops indexes created in the target migration
#
# IMPORTANT: Review the generated file — it's a starting point, not a finished revert.

set -euo pipefail

MIGRATIONS_DIR="supabase/migrations"

if [ -z "${1:-}" ]; then
  echo "Usage: bun run db:revert <migration_number_or_prefix>"
  echo "  Example: bun run db:revert 0020"
  exit 1
fi

# Find the target migration file
TARGET=$(ls "$MIGRATIONS_DIR"/${1}*.sql 2>/dev/null | head -1)
if [ -z "$TARGET" ]; then
  echo "ERROR: No migration found matching '$1' in $MIGRATIONS_DIR/"
  exit 1
fi

TARGET_NAME=$(basename "$TARGET" .sql)
echo "Reverting: $TARGET_NAME"

# Find next sequence number
LAST=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sed 's/.*\///' | sort -n | tail -1 | grep -o '^[0-9]*' || echo "-1")
NEXT=$(printf "%04d" $((10#$LAST + 1)))

REVERT_FILE="$MIGRATIONS_DIR/${NEXT}_revert_${TARGET_NAME}.sql"

# Start building the revert file
{
  echo "-- Revert: $TARGET_NAME"
  echo "-- Created: $(date +%Y-%m-%d)"
  echo "-- Source: $(basename "$TARGET")"
  echo "--"
  echo "-- REVIEW THIS FILE before applying. Auto-generated reverts may need manual edits."
  echo "-- In particular, check for data loss implications (DROP TABLE removes all rows)."
  echo ""

  # Extract and reverse policies
  POLICIES=$(grep -i '^\s*CREATE POLICY' "$TARGET" | sed -n 's/.*CREATE POLICY[[:space:]]*"\([^"]*\)".*ON[[:space:]]*"\{0,1\}\([^"[:space:]]*\)"\{0,1\}.*/\1|\2/p' || true)
  if [ -n "$POLICIES" ]; then
    echo "-- Drop policies"
    while IFS='|' read -r pname ptable; do
      echo "DROP POLICY IF EXISTS \"$pname\" ON \"$ptable\";"
    done <<< "$POLICIES"
    echo ""
  fi

  # Extract and reverse triggers
  TRIGGERS=$(grep -i '^\s*CREATE TRIGGER\|^\s*CREATE OR REPLACE TRIGGER' "$TARGET" | sed -n 's/.*TRIGGER[[:space:]]*"\([^"]*\)".*ON[[:space:]]*"\{0,1\}\([^"[:space:]]*\)"\{0,1\}.*/\1|\2/p' || true)
  if [ -n "$TRIGGERS" ]; then
    echo "-- Drop triggers"
    while IFS='|' read -r tname ttable; do
      echo "DROP TRIGGER IF EXISTS \"$tname\" ON \"$ttable\";"
    done <<< "$TRIGGERS"
    echo ""
  fi

  # Extract and reverse indexes
  INDEXES=$(grep -i '^\s*CREATE.*INDEX' "$TARGET" | sed -n 's/.*INDEX[[:space:]]*\(IF NOT EXISTS[[:space:]]*\)\{0,1\}"\{0,1\}\([^"[:space:]]*\)"\{0,1\}.*/\2/p' || true)
  if [ -n "$INDEXES" ]; then
    echo "-- Drop indexes"
    while IFS= read -r iname; do
      echo "DROP INDEX IF EXISTS \"$iname\";"
    done <<< "$INDEXES"
    echo ""
  fi

  # Extract and reverse functions
  FUNCTIONS=$(grep -i '^\s*CREATE.*FUNCTION' "$TARGET" | sed -n 's/.*FUNCTION[[:space:]]*"\{0,1\}\([^"([:space:]]*\).*/\1/p' || true)
  if [ -n "$FUNCTIONS" ]; then
    echo "-- Drop functions (verify argument types match)"
    while IFS= read -r fname; do
      echo "DROP FUNCTION IF EXISTS \"$fname\";"
    done <<< "$FUNCTIONS"
    echo ""
  fi

  # Extract and reverse tables (last — most destructive)
  TABLES=$(grep -i '^\s*CREATE TABLE' "$TARGET" | sed -n 's/.*CREATE TABLE[[:space:]]*\(IF NOT EXISTS[[:space:]]*\)\{0,1\}"\{0,1\}\([^"([:space:]]*\)"\{0,1\}.*/\2/p' || true)
  if [ -n "$TABLES" ]; then
    echo "-- Drop tables (WARNING: destroys all data in these tables)"
    while IFS= read -r tbl; do
      echo "DROP TABLE IF EXISTS \"$tbl\" CASCADE;"
    done <<< "$TABLES"
    echo ""
  fi

  # Extract and reverse columns
  COLUMNS=$(grep -i 'ADD COLUMN' "$TARGET" | sed -n 's/.*ALTER TABLE[[:space:]]*"\{0,1\}\([^"[:space:]]*\)"\{0,1\}.*ADD COLUMN[[:space:]]*\(IF NOT EXISTS[[:space:]]*\)\{0,1\}"\{0,1\}\([^"[:space:]]*\)"\{0,1\}.*/\1|\3/p' || true)
  if [ -n "$COLUMNS" ]; then
    echo "-- Drop columns (WARNING: destroys data in these columns)"
    while IFS='|' read -r ctable ccol; do
      echo "ALTER TABLE \"$ctable\" DROP COLUMN IF EXISTS \"$ccol\";"
    done <<< "$COLUMNS"
    echo ""
  fi

} > "$REVERT_FILE"

echo "Created: $REVERT_FILE"
echo ""
echo "IMPORTANT: Review the generated file before applying!"
echo "  - Check for data loss implications"
echo "  - Verify column/function argument types"
echo "  - Add any RLS disable statements if needed"
