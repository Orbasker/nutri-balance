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
