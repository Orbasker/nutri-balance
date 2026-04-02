#!/usr/bin/env bash
# Lint SQL migrations for non-idempotent statements.
# PostgreSQL lacks CREATE POLICY IF NOT EXISTS, so every CREATE POLICY
# must be preceded by DROP POLICY IF EXISTS on the same name/table.
# Same for CREATE TRIGGER. CREATE FUNCTION should use OR REPLACE.
#
# Usage:
#   ./scripts/lint-migrations.sh                    # Lint all migrations
#   ./scripts/lint-migrations.sh --changed-only     # Lint only files changed vs main (for CI)
#   ./scripts/lint-migrations.sh path/to/file.sql   # Lint specific file(s)

set -euo pipefail

MIGRATIONS_DIR="supabase/migrations"
EXIT_CODE=0
FILES=()

if [ "${1:-}" = "--changed-only" ]; then
  # In CI: only check migration files changed compared to main
  BASE_BRANCH="${2:-origin/main}"
  while IFS= read -r f; do
    FILES+=("$f")
  done < <(git diff --name-only --diff-filter=ACMR "$BASE_BRANCH" -- "$MIGRATIONS_DIR"/*.sql 2>/dev/null || true)

  if [ ${#FILES[@]} -eq 0 ]; then
    echo "No new/changed migrations to lint"
    exit 0
  fi
elif [ $# -gt 0 ] && [ -f "$1" ]; then
  # Lint specific files passed as arguments
  FILES=("$@")
else
  # Lint all migrations
  for f in "$MIGRATIONS_DIR"/*.sql; do
    [ -f "$f" ] && FILES+=("$f")
  done
fi

lint_file() {
  local file="$1"
  local filename
  filename=$(basename "$file")
  local lineno=0
  local file_ok=true

  while IFS= read -r line; do
    lineno=$((lineno + 1))

    # --- CHECK: CREATE POLICY without preceding DROP POLICY IF EXISTS ---
    if echo "$line" | grep -qi '^[[:space:]]*CREATE POLICY'; then
      policy_name=$(echo "$line" | sed -n 's/.*CREATE POLICY[[:space:]]*"\([^"]*\)".*/\1/p')
      if [ -z "$policy_name" ]; then
        policy_name=$(echo "$line" | sed -n 's/.*CREATE POLICY[[:space:]]*\([^[:space:]]*\)[[:space:]].*/\1/p')
      fi

      if [ -n "$policy_name" ]; then
        if ! head -n "$((lineno - 1))" "$file" | grep -qi "DROP POLICY IF EXISTS.*${policy_name}"; then
          echo "  ERROR: $filename:$lineno — CREATE POLICY \"$policy_name\" needs preceding DROP POLICY IF EXISTS"
          file_ok=false
        fi
      fi
    fi

    # --- CHECK: CREATE TRIGGER without OR REPLACE or preceding DROP ---
    if echo "$line" | grep -qi '^[[:space:]]*CREATE TRIGGER'; then
      if ! echo "$line" | grep -qi 'CREATE OR REPLACE TRIGGER'; then
        trigger_name=$(echo "$line" | sed -n 's/.*CREATE TRIGGER[[:space:]]*"\([^"]*\)".*/\1/p')
        if [ -z "$trigger_name" ]; then
          trigger_name=$(echo "$line" | sed -n 's/.*CREATE TRIGGER[[:space:]]*\([^[:space:]]*\)[[:space:]].*/\1/p')
        fi

        if [ -n "$trigger_name" ]; then
          if ! head -n "$((lineno - 1))" "$file" | grep -qi "DROP TRIGGER IF EXISTS.*${trigger_name}"; then
            echo "  ERROR: $filename:$lineno — CREATE TRIGGER \"$trigger_name\" needs preceding DROP TRIGGER IF EXISTS"
            file_ok=false
          fi
        fi
      fi
    fi

    # --- CHECK: CREATE FUNCTION without OR REPLACE ---
    if echo "$line" | grep -qi '^[[:space:]]*CREATE FUNCTION'; then
      if ! echo "$line" | grep -qi 'CREATE OR REPLACE'; then
        func_name=$(echo "$line" | sed -n 's/.*CREATE FUNCTION[[:space:]]*"\{0,1\}\([^"([:space:]]*\).*/\1/p')
        if [ -n "$func_name" ]; then
          echo "  ERROR: $filename:$lineno — CREATE FUNCTION \"$func_name\" should use CREATE OR REPLACE FUNCTION"
          file_ok=false
        fi
      fi
    fi

  done < "$file"

  if [ "$file_ok" = false ]; then
    return 1
  fi
  return 0
}

echo "Linting ${#FILES[@]} migration file(s)..."
for file in "${FILES[@]}"; do
  if ! lint_file "$file"; then
    EXIT_CODE=1
  fi
done

if [ $EXIT_CODE -eq 0 ]; then
  echo "All checked migrations are idempotent"
else
  echo ""
  echo "Migrations must be idempotent. Fix by adding guards before non-idempotent statements:"
  echo "  - DROP POLICY IF EXISTS \"name\" ON \"table\"; before CREATE POLICY"
  echo "  - DROP TRIGGER IF EXISTS \"name\" ON \"table\"; before CREATE TRIGGER"
  echo "  - Use CREATE OR REPLACE FUNCTION instead of CREATE FUNCTION"
fi

exit $EXIT_CODE
