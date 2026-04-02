-- Migration: ai_run_substance_discovery
-- Created: 2026-04-02
--
-- IMPORTANT: All statements must be idempotent.
-- - Enums:     DO $$ BEGIN ... EXCEPTION WHEN ... END $$;
--
-- Run `bash scripts/lint-migrations.sh <this-file>` to verify idempotency.

ALTER TYPE "ai_run_type" ADD VALUE IF NOT EXISTS 'substance_discovery';
