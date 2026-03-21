#!/bin/bash
set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

# Ensure bun is available
command -v bun >/dev/null 2>&1 || { echo "ERROR: bun required. Install: curl -fsSL https://bun.sh/install | bash"; exit 1; }

echo "[nutri-balance] Installing dependencies..."
bun install

echo "[nutri-balance] Setting up husky hooks..."
bun run prepare

# Copy .env.local from main worktree if missing
if [ ! -f .env.local ] && [ -f .env.local.example ]; then
  MAIN_PATH=$(git worktree list | awk '/\[main\]$/ { print $1; exit }')
  if [ -n "$MAIN_PATH" ] && [ "$MAIN_PATH" != "$(pwd)" ] && [ -f "$MAIN_PATH/.env.local" ]; then
    cp "$MAIN_PATH/.env.local" .env.local
    echo "Copied .env.local from main worktree"
    cp "$MAIN_PATH/.env" .env
    echo "Copied .env from main worktree"
  else
    cp .env.local.example .env.local
    echo "Created .env.local from example — fill in your Supabase credentials"
    cp .env .env
    echo "Created .env from example — fill in your Supabase credentials"
  fi
fi

echo "Setup complete."
