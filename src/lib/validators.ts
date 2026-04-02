import { z } from "zod";

/**
 * Permissive UUID format check — accepts any 8-4-4-4-12 hex string.
 * PostgreSQL stores UUIDs without enforcing RFC 4122 version/variant bits,
 * so we must not reject valid DB values that Zod 4's strict `.uuid()` would.
 */
const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID");

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

/** Payload for creating or updating a row in `user_substance_limits` (validated server-side). */
export const saveUserSubstanceLimitSchema = z
  .object({
    substanceId: uuidSchema,
    limitId: uuidSchema.optional(),
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

export type SaveUserSubstanceLimitInput = z.infer<typeof saveUserSubstanceLimitSchema>;

export const deleteUserSubstanceLimitSchema = z.object({
  limitId: uuidSchema,
});

export type DeleteUserSubstanceLimitInput = z.infer<typeof deleteUserSubstanceLimitSchema>;

export const addConsumptionLogSchema = z.object({
  foodVariantId: uuidSchema,
  servingMeasureId: uuidSchema.nullable(),
  quantity: z.number().positive("Quantity must be positive"),
  gramsAmount: z.number().positive("Grams must be positive"),
  substanceSnapshot: z.record(z.string(), z.number()),
  mealLabel: z.string().optional(),
});

export type AddConsumptionLogInput = z.infer<typeof addConsumptionLogSchema>;

export const deleteConsumptionLogSchema = z.object({
  logId: uuidSchema,
});

export type DeleteConsumptionLogInput = z.infer<typeof deleteConsumptionLogSchema>;

export const updateConsumptionLogSchema = z.object({
  logId: uuidSchema,
  quantity: z.number().positive("Quantity must be positive"),
  substanceSnapshot: z.record(z.string(), z.number()),
});

// Custom substance validators

export const createCustomSubstanceSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be under 100 characters"),
  unit: z.string().trim().min(1, "Unit is required").max(20, "Unit must be under 20 characters"),
  category: z
    .enum(["macronutrient", "lipid", "vitamin", "mineral", "other"])
    .optional()
    .default("other"),
});

export type CreateCustomSubstanceInput = z.infer<typeof createCustomSubstanceSchema>;

export const deleteCustomSubstanceSchema = z.object({
  substanceId: uuidSchema,
});

export type DeleteCustomSubstanceInput = z.infer<typeof deleteCustomSubstanceSchema>;

// Admin validators

export const createFoodSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  category: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
});

export const updateFoodSchema = z.object({
  foodId: uuidSchema,
  name: z.string().min(1, "Name is required").max(200),
  category: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
});

export const deleteFoodSchema = z.object({
  foodId: uuidSchema,
});

export const addVariantSchema = z.object({
  foodId: uuidSchema,
  preparationMethod: z.string().min(1),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().default(false),
});

export const deleteVariantSchema = z.object({
  variantId: uuidSchema,
});

export const saveSubstanceValueSchema = z.object({
  foodVariantId: uuidSchema,
  substanceId: uuidSchema,
  valuePer100g: z.number().nonnegative("Value must be non-negative"),
  confidenceScore: z.number().int().min(0).max(100).default(50),
  resolvedId: uuidSchema.optional(),
});

export const deleteSubstanceValueSchema = z.object({
  resolvedId: uuidSchema,
});

export const reviewObservationSchema = z.object({
  observationId: uuidSchema,
  status: z.enum(["approved", "rejected", "needs_revision"]),
  notes: z.string().max(1000).optional(),
});

// Food Feedback validators

export const submitFeedbackSchema = z.object({
  foodId: uuidSchema,
  substanceId: uuidSchema.optional(),
  foodVariantId: uuidSchema.optional(),
  type: z.enum(["flag", "correction"]),
  message: z.string().min(10, "Message must be at least 10 characters").max(1000),
  suggestedValue: z.number().nonnegative().optional(),
  suggestedUnit: z.string().max(20).optional(),
  sourceUrl: z.string().url().max(500).optional(),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

// Admin food review validators
// Note: deleteFoodSchema already exists above -- reuse it

export const approveFoodSchema = z.object({
  foodId: uuidSchema,
});

export type ApproveFoodInput = z.infer<typeof approveFoodSchema>;

export const dismissFeedbackSchema = z.object({
  feedbackId: uuidSchema,
});

export type DismissFeedbackInput = z.infer<typeof dismissFeedbackSchema>;

/**
 * Turns validated input into DB-ready numeric strings.
 * For stability mode, `daily_limit` is set to `range_max` so existing strict-style consumers stay consistent until the app reads ranges.
 */
export function toUserSubstanceLimitRow(input: SaveUserSubstanceLimitInput): {
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
