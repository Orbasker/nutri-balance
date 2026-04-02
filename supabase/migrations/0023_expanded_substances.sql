-- Migration: expanded_substances
-- Created: 2026-04-02
--
-- IMPORTANT: All statements must be idempotent.
-- INSERTs use ON CONFLICT DO NOTHING (covered by substances_system_name_unique index).
-- UPDATEs are naturally idempotent.
--
-- Expand substances to cover full nutritional range
-- Categories: macronutrient, vitamin, mineral, lipid, other

-- ============================================================
-- Macronutrients (sort_order 100-199)
-- ============================================================
INSERT INTO "substances" ("name", "unit", "display_name", "category", "sort_order")
VALUES
  ('energy', 'kcal', 'Calories', 'macronutrient', 100),
  ('protein', 'g', 'Protein', 'macronutrient', 110),
  ('total_fat', 'g', 'Total Fat', 'macronutrient', 120),
  ('carbohydrates', 'g', 'Carbohydrates', 'macronutrient', 130),
  ('dietary_fiber', 'g', 'Dietary Fiber', 'macronutrient', 140),
  ('total_sugars', 'g', 'Total Sugars', 'macronutrient', 150),
  ('added_sugars', 'g', 'Added Sugars', 'macronutrient', 155),
  ('water', 'g', 'Water', 'macronutrient', 190)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Lipids / Fatty Acids (sort_order 200-299)
-- ============================================================
INSERT INTO "substances" ("name", "unit", "display_name", "category", "sort_order")
VALUES
  ('saturated_fat', 'g', 'Saturated Fat', 'lipid', 200),
  ('monounsaturated_fat', 'g', 'Monounsaturated Fat', 'lipid', 210),
  ('polyunsaturated_fat', 'g', 'Polyunsaturated Fat', 'lipid', 220),
  ('trans_fat', 'g', 'Trans Fat', 'lipid', 230),
  ('cholesterol', 'mg', 'Cholesterol', 'lipid', 240),
  ('omega_3', 'mg', 'Omega-3 (ALA+EPA+DHA)', 'lipid', 250),
  ('omega_6', 'mg', 'Omega-6', 'lipid', 260)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Vitamins (sort_order 300-499)
-- ============================================================
-- Update existing vitamins with proper categories and sort orders
UPDATE "substances" SET "category" = 'vitamin', "sort_order" = 300 WHERE "name" = 'vitamin_a';
UPDATE "substances" SET "category" = 'vitamin', "sort_order" = 380 WHERE "name" = 'vitamin_c';
UPDATE "substances" SET "category" = 'vitamin', "sort_order" = 400 WHERE "name" = 'vitamin_k';

INSERT INTO "substances" ("name", "unit", "display_name", "category", "sort_order")
VALUES
  ('vitamin_b1', 'mg', 'Vitamin B1 (Thiamin)', 'vitamin', 310),
  ('vitamin_b2', 'mg', 'Vitamin B2 (Riboflavin)', 'vitamin', 320),
  ('vitamin_b3', 'mg', 'Vitamin B3 (Niacin)', 'vitamin', 330),
  ('vitamin_b5', 'mg', 'Vitamin B5 (Pantothenic Acid)', 'vitamin', 340),
  ('vitamin_b6', 'mg', 'Vitamin B6', 'vitamin', 350),
  ('vitamin_b7', 'mcg', 'Vitamin B7 (Biotin)', 'vitamin', 355),
  ('vitamin_b9', 'mcg', 'Folate (B9)', 'vitamin', 360),
  ('vitamin_b12', 'mcg', 'Vitamin B12', 'vitamin', 370),
  ('vitamin_d', 'mcg', 'Vitamin D', 'vitamin', 390),
  ('vitamin_e', 'mg', 'Vitamin E', 'vitamin', 395)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Minerals (sort_order 500-699)
-- ============================================================
-- Update existing minerals with proper categories and sort orders
UPDATE "substances" SET "category" = 'mineral', "sort_order" = 560 WHERE "name" = 'potassium';
UPDATE "substances" SET "category" = 'mineral', "sort_order" = 570 WHERE "name" = 'sodium';
UPDATE "substances" SET "category" = 'mineral', "sort_order" = 520 WHERE "name" = 'iron';

INSERT INTO "substances" ("name", "unit", "display_name", "category", "sort_order")
VALUES
  ('calcium', 'mg', 'Calcium', 'mineral', 500),
  ('magnesium', 'mg', 'Magnesium', 'mineral', 510),
  ('phosphorus', 'mg', 'Phosphorus', 'mineral', 530),
  ('zinc', 'mg', 'Zinc', 'mineral', 540),
  ('copper', 'mg', 'Copper', 'mineral', 550),
  ('manganese', 'mg', 'Manganese', 'mineral', 580),
  ('selenium', 'mcg', 'Selenium', 'mineral', 590),
  ('chromium', 'mcg', 'Chromium', 'mineral', 600),
  ('molybdenum', 'mcg', 'Molybdenum', 'mineral', 610),
  ('iodine', 'mcg', 'Iodine', 'mineral', 620),
  ('fluoride', 'mg', 'Fluoride', 'mineral', 630)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Other (sort_order 700+)
-- ============================================================
INSERT INTO "substances" ("name", "unit", "display_name", "category", "sort_order")
VALUES
  ('caffeine', 'mg', 'Caffeine', 'other', 700),
  ('alcohol', 'g', 'Alcohol', 'other', 710)
ON CONFLICT DO NOTHING;
