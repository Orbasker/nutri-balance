#!/bin/bash
set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

echo "Cleaning up..."
rm -rf node_modules .next out

echo "Archive cleanup complete."
