import { z } from "zod";

export const searchInputSchema = z.object({
  query: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(2).max(100)),
});
