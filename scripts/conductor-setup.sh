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

# Copy env files from main worktree if missing
MAIN_PATH=$(git worktree list | awk 'NR==1 { print $1; exit }')

for envfile in .env .env.local; do
  if [ ! -f "$envfile" ]; then
    if [ -n "$MAIN_PATH" ] && [ "$MAIN_PATH" != "$(pwd)" ] && [ -f "$MAIN_PATH/$envfile" ]; then
      cp "$MAIN_PATH/$envfile" "$envfile"
      echo "Copied $envfile from main worktree"
    elif [ -f "$envfile.example" ]; then
      cp "$envfile.example" "$envfile"
      echo "Created $envfile from example — fill in your credentials"
    fi
  fi
done

echo "Setup complete."
