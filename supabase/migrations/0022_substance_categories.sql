-- Migration: substance_categories
-- Created: 2026-04-02
--
-- IMPORTANT: All statements must be idempotent.

-- Add category column to substances for grouping (macronutrient, vitamin, mineral, etc.)
ALTER TABLE "substances" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'other';

-- Set categories for existing substances (idempotent UPDATEs)
UPDATE "substances" SET "category" = 'vitamin' WHERE "name" IN ('vitamin_k', 'vitamin_a', 'vitamin_c') AND "category" = 'other';
UPDATE "substances" SET "category" = 'mineral' WHERE "name" IN ('potassium', 'sodium', 'iron') AND "category" = 'other';
