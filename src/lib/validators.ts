import { z } from "zod";

export const searchInputSchema = z.object({
  query: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(2).max(100)),
});

export const limitModeSchema = z.enum(["strict", "stability"]);

export type LimitMode = z.infer<typeof limitModeSchema>;

function parsePositiveNumber(val: unknown): number | null {
  if (val === "" || val === null || val === undefined) {
    return null;
  }
  const n = typeof val === "number" ? val : Number(String(val).trim());
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

/** Payload for creating or updating a row in `user_nutrient_limits` (validated server-side). */
export const saveUserNutrientLimitSchema = z
  .object({
    nutrientId: z.string().uuid(),
    limitId: z.string().uuid().optional(),
    mode: limitModeSchema,
    dailyLimit: z.union([z.string(), z.number()]).optional(),
    rangeMin: z.union([z.string(), z.number()]).optional(),
    rangeMax: z.union([z.string(), z.number()]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "strict") {
      const d = parsePositiveNumber(data.dailyLimit);
      if (d === null) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a positive daily limit.",
          path: ["dailyLimit"],
        });
      }
    } else {
      const min = parsePositiveNumber(data.rangeMin);
      const max = parsePositiveNumber(data.rangeMax);
      if (min === null) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a positive range minimum.",
          path: ["rangeMin"],
        });
      }
      if (max === null) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a positive range maximum.",
          path: ["rangeMax"],
        });
      }
      if (min !== null && max !== null && min >= max) {
        ctx.addIssue({
          code: "custom",
          message: "Range minimum must be less than range maximum.",
          path: ["rangeMax"],
        });
      }
    }
  });

export type SaveUserNutrientLimitInput = z.infer<typeof saveUserNutrientLimitSchema>;

export const deleteUserNutrientLimitSchema = z.object({
  limitId: z.string().uuid(),
});

export type DeleteUserNutrientLimitInput = z.infer<typeof deleteUserNutrientLimitSchema>;

export const addConsumptionLogSchema = z.object({
  foodVariantId: z.string().uuid(),
  servingMeasureId: z.string().uuid().nullable(),
  quantity: z.number().positive("Quantity must be positive"),
  gramsAmount: z.number().positive("Grams must be positive"),
  nutrientSnapshot: z.record(z.string(), z.number()),
  mealLabel: z.string().optional(),
});

export type AddConsumptionLogInput = z.infer<typeof addConsumptionLogSchema>;

export const deleteConsumptionLogSchema = z.object({
  logId: z.string().uuid(),
});

export type DeleteConsumptionLogInput = z.infer<typeof deleteConsumptionLogSchema>;

export const updateConsumptionLogSchema = z.object({
  logId: z.string().uuid(),
  quantity: z.number().positive("Quantity must be positive"),
  nutrientSnapshot: z.record(z.string(), z.number()),
});

// Admin validators

export const createFoodSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  category: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
});

export const updateFoodSchema = z.object({
  foodId: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(200),
  category: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
});

export const deleteFoodSchema = z.object({
  foodId: z.string().uuid(),
});

export const addVariantSchema = z.object({
  foodId: z.string().uuid(),
  preparationMethod: z.string().min(1),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().default(false),
});

export const deleteVariantSchema = z.object({
  variantId: z.string().uuid(),
});

export const saveNutrientValueSchema = z.object({
  foodVariantId: z.string().uuid(),
  nutrientId: z.string().uuid(),
  valuePer100g: z.number().nonnegative("Value must be non-negative"),
  confidenceScore: z.number().int().min(0).max(100).default(50),
  resolvedId: z.string().uuid().optional(),
});

export const deleteNutrientValueSchema = z.object({
  resolvedId: z.string().uuid(),
});

export const reviewObservationSchema = z.object({
  observationId: z.string().uuid(),
  status: z.enum(["approved", "rejected", "needs_revision"]),
  notes: z.string().max(1000).optional(),
});

/**
 * Turns validated input into DB-ready numeric strings.
 * For stability mode, `daily_limit` is set to `range_max` so existing strict-style consumers stay consistent until the app reads ranges.
 */
export function toUserNutrientLimitRow(input: SaveUserNutrientLimitInput): {
  daily_limit: string;
  mode: LimitMode;
  range_min: string | null;
  range_max: string | null;
} {
  if (input.mode === "strict") {
    const d = parsePositiveNumber(input.dailyLimit)!;
    return {
      daily_limit: String(d),
      mode: "strict",
      range_min: null,
      range_max: null,
    };
  }
  const min = parsePositiveNumber(input.rangeMin)!;
  const max = parsePositiveNumber(input.rangeMax)!;
  return {
    daily_limit: String(max),
    mode: "stability",
    range_min: String(min),
    range_max: String(max),
  };
}
