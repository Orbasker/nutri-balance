# User Feedback & Admin Food Review Implementation Plan

> **For Claude:** REQUIRED: Follow this plan task-by-task using TDD where applicable.
> **Design:** See `docs/plans/2026-03-22-feedback-and-food-review-design.md` for full specification.

**Goal:** Add user feedback on food nutrient data (flag/correction) and a card-based admin food review page for bulk-approving or hard-deleting foods.

**Architecture:** New `food_feedback` Drizzle table + `created_by` column on `foods`. FeedbackForm client component on `/food/[id]`. New `/admin/foods-review` page with FoodReviewCard/Grid components. Server actions for all mutations. Supabase RLS for authorization.

**Tech Stack:** Next.js App Router, Drizzle ORM, Supabase RLS, shadcn/ui, Tailwind CSS 4, Zod 4

**Prerequisites:** Local Supabase running (`supabase start`), existing schema migrations applied

---

## Human Layer

### Executive Summary

- Two features: user feedback on food data + admin card-based food review
- Straightforward additions following existing patterns (admin review queue, server actions, shadcn cards)
- New `food_feedback` table and `created_by` column on `foods` via Drizzle migration
- No architectural changes -- extends existing admin and food detail surfaces

### What I Verified vs What Still Needs Confirmation

- **Confident because:**
  - `foods` table schema confirmed at `src/lib/db/schema/foods.ts` -- no `created_by` column exists yet
  - Cascade deletes already set up: `food_variants.foodId` -> `foods.id` with `onDelete: "cascade"`, `nutrient_observations.foodVariantId` -> `foodVariants.id` with `onDelete: "cascade"`, `evidence_items.observationId` -> `nutrient_observations.id` with `onDelete: "cascade"`
  - Existing admin pattern: `requireAdmin()` in `src/app/(admin)/review/actions.ts:18-32` uses Supabase auth + profiles table role check
  - Admin layout at `src/app/(admin)/layout.tsx` handles auth guard and renders `AdminNav`
  - `AdminNav` at `src/components/admin/admin-nav.tsx:8-11` has a simple `navItems` array to extend
  - Existing review queue (`review-queue.tsx`) uses shadcn Card, Badge, Button -- same component set for new feature
  - Validators follow `uuidSchema` pattern in `src/lib/validators.ts`
  - Food detail page server component at `src/app/(app)/food/[id]/page.tsx` renders `FoodDetailClient`
  - `reviewObservation` action uses `createAdminClient()` to bypass RLS for admin writes
- **Still needs confirmation:** None -- all requirements are clear and grounded in code
- **Key risks:** Migration must add RLS policies via raw SQL in migration file (Drizzle schema defines structure, RLS is manual SQL in migration)

### Request Summary

Enable users to report incorrect food data and give admins a card-based view to approve or delete entire foods.

### Requirements Snapshot

1. New `food_feedback` table: id, food_id (FK cascade), nutrient_id (FK nullable), food_variant_id (FK nullable), user_id, type enum (flag/correction), message, suggested_value, suggested_unit, source_url, status enum (open/reviewed/dismissed), created_at, reviewed_at
2. Add `created_by` (uuid nullable) column to existing `foods` table
3. RLS: users insert own feedback, admins read all
4. Server actions: submitFeedback, getPendingFoods, approveFood, deleteFood, dismissFeedback
5. Zod validators for all actions
6. FeedbackForm component on food detail page
7. FoodReviewCard + FoodReviewGrid components for admin
8. New page at `/admin/foods-review`
9. Hard delete cascades through food_variants -> nutrient_observations -> evidence_items -> food_feedback
10. Keep existing `/admin/review` observation queue unchanged

### Constraints Snapshot

- Drizzle ORM only -- no raw SQL in application code (RLS policies go in migration SQL)
- Supabase RLS required for the new table
- shadcn/ui components (Card, Badge, Button, Dialog, Textarea, Input) for UI
- Server Actions for all mutations
- `"use client"` only where needed (forms with interactivity)

### In Scope

- `food_feedback` table schema + migration
- `created_by` column on `foods` + migration
- RLS policies for `food_feedback`
- Zod validators for feedback submission, food approval, food deletion, feedback dismissal
- `submitFeedback` server action
- `getPendingFoods`, `approveFood`, `deleteFood`, `dismissFeedback`, `getFoodFeedback` server actions
- FeedbackForm client component
- FoodReviewCard, FoodReviewGrid client components
- `/admin/foods-review` page
- AdminNav update to include "Food Review" link
- TypeScript interfaces for new types

### Out Of Scope

- Email/push notifications on feedback
- Feedback resolution workflow (admin replying)
- Inline food editing from review card
- Soft delete / undo
- User-facing feedback history
- Tests (no testing framework is set up in this project)

### Planning Mode

- Plan mode: `execution_plan`
- Verification rigor: `standard`

### Open Decisions

- None

### Differences From Agreement

- None

### Recommended Defaults

- None

---

## Execution Contract Layer

### Codebase Reality Check

- **Verified files / surfaces:**
  - `src/lib/db/schema/foods.ts` -- `foods`, `foodVariants`, `foodAliases`, `servingMeasures` tables + relations
  - `src/lib/db/schema/observations.ts` -- `nutrientObservations`, `evidenceItems`, `reviewStatusEnum`, `sourceTypeEnum`
  - `src/lib/db/schema/reviews.ts` -- `reviews`, `resolvedNutrientValues`
  - `src/lib/db/schema/users.ts` -- `profiles` with `userRoleEnum`, `consumptionLogs`
  - `src/lib/db/schema/nutrients.ts` -- `nutrients` table
  - `src/lib/db/index.ts` -- `db` Drizzle client
  - `src/lib/supabase/admin.ts` -- `createAdminClient()` bypasses RLS
  - `src/lib/validators.ts` -- `uuidSchema`, existing admin validators (`deleteFoodSchema` already exists)
  - `src/types/index.ts` -- existing interfaces including `PendingObservation`, `AdminFoodListItem`
  - `src/app/(admin)/review/actions.ts` -- `requireAdmin()` pattern, `reviewObservation()`
  - `src/app/(admin)/layout.tsx` -- admin auth guard layout
  - `src/components/admin/admin-nav.tsx` -- nav items array
  - `src/components/admin/review-queue.tsx` -- existing card-based review UI pattern
  - `src/app/(app)/food/[id]/page.tsx` -- food detail server page
  - `src/app/(app)/food/[id]/food-detail-client.tsx` -- food detail client component
  - `src/app/(app)/food/[id]/actions.ts` -- `getFoodDetail()`, `addToToday()`
  - Available shadcn components: badge, button, card, dialog, input, textarea, tabs, separator, sheet, dropdown-menu, input-group, command, progress

- **Existing patterns / constraints:**
  - Admin actions use `requireAdmin()` -> returns `adminId` string or `null`
  - Admin writes use `createAdminClient()` Supabase client to bypass RLS
  - User writes use `createClient()` from `@/lib/supabase/server` (respects RLS)
  - All Drizzle enums defined with `pgEnum()` -- e.g., `reviewStatusEnum`, `sourceTypeEnum`
  - Server action result pattern: `{ ok: true } | { error: string }`
  - `revalidatePath()` called after mutations
  - Client components use `useTransition` for async action calls
  - Food detail page passes `food: FoodDetail` prop to client component

- **Pressure points / contradictions:**
  - `deleteFoodSchema` already exists in validators (line 127-129) -- we must reuse it, not create a duplicate
  - The existing `reviewObservation` action uses `createAdminClient()` (Supabase client, not Drizzle) for updates -- `approveFood` should use Drizzle for the bulk update (more efficient for multi-row operations)
  - `food_feedback` needs cascade delete from `foods`, but also needs its own cascade from `food_variants` if a variant is deleted independently -- need FK on both `food_id` AND `food_variant_id`

### Plan-vs-Code Gaps

| Current code / behavior                                    | Planned change                                      | Gap / risk                                                 | Plan response                                                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `foods` table has no `created_by` column                   | Add `created_by: uuid nullable`                     | Existing rows get NULL -- acceptable per design            | Migration adds column with NULL default                                                                              |
| `deleteFoodSchema` already exists in `validators.ts`       | Need schema for food deletion in admin review       | Duplicate name collision                                   | Reuse existing `deleteFoodSchema` -- it already validates `{ foodId: uuidSchema }`                                   |
| No `food_feedback` table exists                            | New table with enums + FKs                          | Migration must create enums + table + RLS policies         | Phase 1 handles schema + migration together                                                                          |
| `AdminNav` has 2 items: Foods, Review Queue                | Add "Food Review" link                              | Simple array append                                        | Phase 4 adds entry to `navItems`                                                                                     |
| Food detail page has no feedback section                   | Add FeedbackForm below existing content             | Need to pass food ID + nutrients list to form              | Phase 3 modifies `page.tsx` to include FeedbackForm                                                                  |
| Admin review uses `createAdminClient()` for single-row ops | `approveFood` needs bulk update across observations | Drizzle `db` with admin-level access needed for efficiency | Use `db` (Drizzle) for bulk updates since it connects directly via `DATABASE_URL` (bypasses RLS at connection level) |

### Assumption Ledger

- **Proven by code:**
  - Cascade deletes are set up on `food_variants.foodId`, `nutrient_observations.foodVariantId`, `evidence_items.observationId` (confirmed in schema files)
  - `requireAdmin()` returns user ID string or null (confirmed in `review/actions.ts:18-32`)
  - `db` Drizzle client uses `DATABASE_URL` direct connection (confirmed in `src/lib/db/index.ts`) -- bypasses RLS
  - `nutrients` table has `id`, `name`, `displayName`, `unit` columns (confirmed in `src/lib/db/schema/nutrients.ts`)
- **Inferred:**
  - Drizzle `db` client has superuser/service-role access since it uses `DATABASE_URL` (standard Supabase local setup)
  - The `food_feedback` cascade delete through `foods` will also cascade through the new FK
- **Needs user confirmation:** None

### Phase Dependency Map

- Phase 1 (Schema): no dependencies, creates tables + enums + migration
- Phase 2 (Validators + Types): depends on Phase 1 (enum values), creates Zod schemas + TS interfaces
- Phase 3 (Feedback Feature): depends on Phase 1 + 2, creates server action + UI component
- Phase 4 (Admin Food Review): depends on Phase 1 + 2, creates server actions + UI components + page

### Phase Plan

---

## Phase 1: Database Schema & Migration

**Objective:** Add `food_feedback` table, new enums, and `created_by` column on `foods`.

**Exit Criteria:** `bunx drizzle-kit generate` produces a clean migration. `supabase db push` or `bunx drizzle-kit push` applies without errors.

### Task 1.1: Define Drizzle schema for `food_feedback`

**Files:**

- Create: `src/lib/db/schema/feedback.ts`
- Modify: `src/lib/db/schema/foods.ts` (add `created_by` column + update relations)

**Step 1: Create `src/lib/db/schema/feedback.ts`**

```typescript
import { relations } from "drizzle-orm";
import { numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { foods } from "./foods";
import { foodVariants } from "./foods";
import { nutrients } from "./nutrients";

export const feedbackTypeEnum = pgEnum("feedback_type", ["flag", "correction"]);

export const feedbackStatusEnum = pgEnum("feedback_status", ["open", "reviewed", "dismissed"]);

export const foodFeedback = pgTable("food_feedback", {
  id: uuid().defaultRandom().primaryKey(),
  foodId: uuid("food_id")
    .notNull()
    .references(() => foods.id, { onDelete: "cascade" }),
  nutrientId: uuid("nutrient_id").references(() => nutrients.id, {
    onDelete: "cascade",
  }),
  foodVariantId: uuid("food_variant_id").references(() => foodVariants.id, {
    onDelete: "cascade",
  }),
  userId: uuid("user_id").notNull(),
  type: feedbackTypeEnum().notNull(),
  message: text().notNull(),
  suggestedValue: numeric("suggested_value"),
  suggestedUnit: text("suggested_unit"),
  sourceUrl: text("source_url"),
  status: feedbackStatusEnum().default("open").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

// Relations
export const foodFeedbackRelations = relations(foodFeedback, ({ one }) => ({
  food: one(foods, {
    fields: [foodFeedback.foodId],
    references: [foods.id],
  }),
  nutrient: one(nutrients, {
    fields: [foodFeedback.nutrientId],
    references: [nutrients.id],
  }),
  foodVariant: one(foodVariants, {
    fields: [foodFeedback.foodVariantId],
    references: [foodVariants.id],
  }),
}));
```

**Step 2: Add `createdBy` column to `foods` table in `src/lib/db/schema/foods.ts`**

Add this column to the `foods` table definition, after `updatedAt`:

```typescript
createdBy: uuid("created_by"),
```

Also add a relation from `foods` to `foodFeedback`:

```typescript
// In foodsRelations, add:
feedback: many(foodFeedback),
```

Import `foodFeedback` from `./feedback` in the relations section. Note: to avoid circular imports, define the relation in `feedback.ts` only (food -> feedback direction), and add the `many` side in `foods.ts` importing from `./feedback`.

**Step 3: Generate the Drizzle migration**

Run: `bunx drizzle-kit generate`

This will produce a migration SQL file in `supabase/migrations/`.

**Step 4: Add RLS policies to the generated migration**

Open the generated migration file and append these SQL statements at the end:

```sql
-- Enable RLS on food_feedback
ALTER TABLE "food_feedback" ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON "food_feedback"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own feedback, admins can read all
CREATE POLICY "Users read own feedback, admins read all"
  ON "food_feedback"
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins can update feedback (status changes)
CREATE POLICY "Admins can update feedback"
  ON "food_feedback"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins can delete feedback
CREATE POLICY "Admins can delete feedback"
  ON "food_feedback"
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
```

**Step 5: Apply the migration**

Run: `supabase db push` (local dev) or `bunx drizzle-kit push`

**Step 6: Verify**

Run: `bun run typecheck`
Expected: No type errors related to schema changes.

**Step 7: Commit**

```bash
git add src/lib/db/schema/feedback.ts src/lib/db/schema/foods.ts supabase/migrations/
git commit -m "feat: add food_feedback table and created_by column on foods"
```

---

## Phase 2: Validators & TypeScript Types

**Objective:** Add Zod schemas and TypeScript interfaces for the new features.

**Exit Criteria:** `bun run typecheck` passes. All new validators importable.

### Task 2.1: Add Zod validators

**Files:**

- Modify: `src/lib/validators.ts`

**Step 1: Add feedback and admin review validators**

Append after the existing `reviewObservationSchema` (around line 158):

```typescript
// Food Feedback validators

export const submitFeedbackSchema = z.object({
  foodId: uuidSchema,
  nutrientId: uuidSchema.optional(),
  foodVariantId: uuidSchema.optional(),
  type: z.enum(["flag", "correction"]),
  message: z.string().min(10, "Message must be at least 10 characters").max(1000),
  suggestedValue: z.number().nonnegative().optional(),
  suggestedUnit: z.string().max(20).optional(),
  sourceUrl: z.string().url().max(500).optional(),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

// Admin food review validators
// Note: deleteFoodSchema already exists at line 127 -- reuse it

export const approveFoodSchema = z.object({
  foodId: uuidSchema,
});

export type ApproveFoodInput = z.infer<typeof approveFoodSchema>;

export const dismissFeedbackSchema = z.object({
  feedbackId: uuidSchema,
});

export type DismissFeedbackInput = z.infer<typeof dismissFeedbackSchema>;
```

**Step 2: Verify**

Run: `bun run typecheck`
Expected: PASS

### Task 2.2: Add TypeScript interfaces

**Files:**

- Modify: `src/types/index.ts`

**Step 1: Add new interfaces**

Append after existing interfaces:

```typescript
// Food Feedback types

export interface FoodFeedbackItem {
  id: string;
  foodId: string;
  nutrientId: string | null;
  foodVariantId: string | null;
  userId: string;
  type: "flag" | "correction";
  message: string;
  suggestedValue: number | null;
  suggestedUnit: string | null;
  sourceUrl: string | null;
  status: "open" | "reviewed" | "dismissed";
  createdAt: string;
  reviewedAt: string | null;
  // Joined fields
  nutrientDisplayName?: string;
  nutrientUnit?: string;
}

// Admin Food Review types

export interface FoodReviewItem {
  id: string;
  name: string;
  category: string | null;
  createdAt: string;
  createdBy: string | null;
  variantCount: number;
  pendingObservationCount: number;
  avgConfidence: number;
  feedbackCount: number;
  variants: FoodReviewVariant[];
}

export interface FoodReviewVariant {
  id: string;
  preparationMethod: string;
  nutrients: FoodReviewNutrient[];
}

export interface FoodReviewNutrient {
  nutrientDisplayName: string;
  value: number;
  unit: string;
  confidenceScore: number;
  reviewStatus: string;
}
```

**Step 2: Verify**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/validators.ts src/types/index.ts
git commit -m "feat: add validators and types for food feedback and admin review"
```

---

## Phase 3: User Feedback Feature

**Objective:** Users can submit feedback (flag or correction) on food data from the food detail page.

**Exit Criteria:** Logged-in user can open feedback form on `/food/[id]`, fill it out, submit, and see success toast. Data appears in `food_feedback` table.

### Task 3.1: Create feedback server action

**Files:**

- Create: `src/app/(app)/food/[id]/feedback-actions.ts`

**Step 1: Implement `submitFeedback` action**

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { submitFeedbackSchema } from "@/lib/validators";

export type FeedbackActionResult = { ok: true } | { error: string };

export async function submitFeedback(raw: unknown): Promise<FeedbackActionResult> {
  const parsed = submitFeedbackSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase.from("food_feedback").insert({
    food_id: parsed.data.foodId,
    nutrient_id: parsed.data.nutrientId ?? null,
    food_variant_id: parsed.data.foodVariantId ?? null,
    user_id: user.id,
    type: parsed.data.type,
    message: parsed.data.message,
    suggested_value: parsed.data.suggestedValue ? String(parsed.data.suggestedValue) : null,
    suggested_unit: parsed.data.suggestedUnit ?? null,
    source_url: parsed.data.sourceUrl ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/food/${parsed.data.foodId}`);
  return { ok: true };
}
```

**Step 2: Verify**

Run: `bun run typecheck`
Expected: PASS

### Task 3.2: Create FeedbackForm client component

**Files:**

- Create: `src/components/food/feedback-form.tsx`

**Step 1: Implement the form**

This is a `"use client"` component. It renders:

- A collapsible section with header "Report an Issue"
- Nutrient dropdown (options from `nutrients` prop + "General feedback" option)
- Radio group: "Flag an issue" / "Suggest a correction"
- Conditional fields when correction selected: numeric input for suggested value, unit display
- Textarea for message (min 10 chars)
- Optional source URL input
- Submit button calling `submitFeedback` server action
- Success/error feedback inline (not toast -- no toast component in shadcn setup)

**Props interface:**

```typescript
interface FeedbackFormProps {
  foodId: string;
  variants: Array<{
    id: string;
    preparationMethod: string;
    nutrients: Array<{
      nutrientId: string;
      displayName: string;
      unit: string;
    }>;
  }>;
}
```

**Key implementation details:**

- Use `useTransition` for the async submit (matches existing pattern in `food-detail-client.tsx`)
- Use shadcn `Card`, `CardContent` for the container
- Use shadcn `Button`, `Input`, `Textarea` for form controls
- Use native `<select>` styled with Tailwind (no shadcn Select component available)
- Use native `<input type="radio">` for type selection
- Show correction fields only when type is "correction"
- Reset form on success
- Show inline error/success messages (green/red text)
- `aria-invalid` on fields with errors
- `aria-describedby` linking error messages

**Step 2: Verify**

Run: `bun run typecheck`
Expected: PASS

### Task 3.3: Integrate FeedbackForm into food detail page

**Files:**

- Modify: `src/app/(app)/food/[id]/page.tsx`

**Step 1: Add FeedbackForm below FoodDetailClient**

Import `FeedbackForm` and render it after `<FoodDetailClient>`:

```tsx
import { FeedbackForm } from "@/components/food/feedback-form";

// Inside the return, after <FoodDetailClient ... />:
<FeedbackForm
  foodId={food.id}
  variants={food.variants.map((v) => ({
    id: v.id,
    preparationMethod: v.preparationMethod,
    nutrients: v.nutrients.map((n) => ({
      nutrientId: n.nutrientId,
      displayName: n.displayName,
      unit: n.unit,
    })),
  }))}
/>;
```

The `FeedbackForm` is a client component inside a server component page -- this is the standard Next.js pattern already used with `FoodDetailClient`.

**Step 2: Verify**

Run: `bun run typecheck`
Expected: PASS

Run: `bun run dev` and navigate to a food detail page. Verify the feedback form renders below the nutrient breakdown.

**Step 3: Commit**

```bash
git add src/app/(app)/food/[id]/feedback-actions.ts src/components/food/feedback-form.tsx src/app/(app)/food/[id]/page.tsx
git commit -m "feat: add user feedback form on food detail page"
```

---

## Phase 4: Admin Food Review Feature

**Objective:** Admins can view food cards with variants/nutrients/feedback, approve all pending observations, or hard-delete foods.

**Exit Criteria:** Admin can visit `/admin/foods-review`, see food cards, expand variants/feedback, approve a food (all pending observations become approved), or delete a food (cascade removes everything).

### Task 4.1: Create admin food review server actions

**Files:**

- Create: `src/app/(admin)/foods-review/actions.ts`

**Step 1: Implement server actions**

```typescript
"use server";

import { revalidatePath } from "next/cache";

import type { FoodFeedbackItem, FoodReviewItem } from "@/types";
import { and, avg, count, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { foodFeedback } from "@/lib/db/schema/feedback";
import { foodVariants, foods } from "@/lib/db/schema/foods";
import { nutrients } from "@/lib/db/schema/nutrients";
import { nutrientObservations } from "@/lib/db/schema/observations";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { approveFoodSchema, deleteFoodSchema, dismissFeedbackSchema } from "@/lib/validators";
```

**Actions to implement:**

1. **`requireAdmin()`** -- Copy the pattern from `src/app/(admin)/review/actions.ts:18-32`. Same implementation: check Supabase auth + profile role.

2. **`getPendingFoods(): Promise<FoodReviewItem[]>`**
   - Requires admin
   - Query foods that have at least one pending observation OR at least one open feedback item
   - For each food: count variants, count pending observations, calculate avg confidence, count feedback
   - Return as `FoodReviewItem[]` with nested `variants` containing their nutrients
   - Use Drizzle `db` for the query (direct DB connection, no RLS)
   - Query strategy: First get food IDs with pending observations, then batch-fetch variant/nutrient/feedback details

3. **`approveFood(raw: unknown): Promise<{ ok: true } | { error: string }>`**
   - Validate with `approveFoodSchema`
   - Requires admin
   - Get all `food_variant` IDs for this food
   - Bulk-update `nutrient_observations` SET `review_status = 'approved'` WHERE `food_variant_id IN (variant_ids)` AND `review_status = 'pending'`
   - Insert `reviews` records for each approved observation (use `createAdminClient()`)
   - `revalidatePath("/foods-review")`

4. **`deleteFood(raw: unknown): Promise<{ ok: true } | { error: string }>`**
   - Validate with `deleteFoodSchema`
   - Requires admin
   - Use `createAdminClient()` to delete: `DELETE FROM foods WHERE id = foodId`
   - Cascade handles all related data automatically
   - `revalidatePath("/foods-review")`

5. **`getFoodFeedback(foodId: string): Promise<FoodFeedbackItem[]>`**
   - Requires admin
   - Query `food_feedback` joined with `nutrients` for display names
   - Filter by `food_id = foodId`
   - Order by `created_at DESC`

6. **`dismissFeedback(raw: unknown): Promise<{ ok: true } | { error: string }>`**
   - Validate with `dismissFeedbackSchema`
   - Requires admin
   - Update feedback status to "dismissed" and set `reviewed_at`
   - Use `createAdminClient()`

**Step 2: Verify**

Run: `bun run typecheck`
Expected: PASS

### Task 4.2: Create FoodReviewCard component

**Files:**

- Create: `src/components/admin/food-review-card.tsx`

**Step 1: Implement the card**

`"use client"` component. Props: `food: FoodReviewItem`.

**Layout:**

- shadcn `Card` with `CardContent`
- Header: food name (bold), category badge, "AI-generated" badge if applicable, created date
- Stats row: "{N} variants", "{N} pending", "Avg conf: {X}%", "{N} feedback"
- Collapsible "Variants & Nutrients" section using state toggle (ChevronDown/ChevronUp icons from lucide-react, matching `review-queue.tsx` pattern)
  - Each variant: preparation method badge, then table/list of nutrients with value, unit, confidence, review status
- Collapsible "User Feedback ({N})" section
  - Lazy-loads feedback via `getFoodFeedback` when expanded (avoids loading all feedback upfront)
  - Each feedback item: type badge, message, suggested value if correction, source URL link, dismiss button
- Action buttons at bottom:
  - "Approve All" (green) -- calls `approveFood`, disabled during transition
  - "Delete Food" (red/destructive) -- opens confirmation dialog before calling `deleteFood`

**Key implementation details:**

- Use `useTransition` for async actions
- Use shadcn `Dialog` for delete confirmation ("This permanently deletes the food and all its data. This cannot be undone.")
- Use shadcn `Badge` for status/type indicators
- Use `cursor-pointer` on all clickable elements
- Handle loading state for feedback expansion
- Disable action buttons while any action is in progress (`pending` from `useTransition`)

**Step 2: Verify**

Run: `bun run typecheck`
Expected: PASS

### Task 4.3: Create FoodReviewGrid component

**Files:**

- Create: `src/components/admin/food-review-grid.tsx`

**Step 1: Implement the grid**

`"use client"` component. Props: `foods: FoodReviewItem[]`.

**Layout:**

- Filter bar at top with native `<select>` controls:
  - Filter: "All" / "Has feedback" / (future: "AI-generated only" -- skip for now since `created_by` alone cannot determine AI-generated status reliably)
  - Sort: "Newest first" / "Most pending" / "Lowest confidence"
- Responsive grid: `grid grid-cols-1 md:grid-cols-2 gap-4`
- Renders `FoodReviewCard` for each food
- Empty state if no foods match filter: "No foods pending review."

**Key implementation details:**

- Filter/sort with `useState` (client-side filtering since data set is manageable)
- Sort functions: by `createdAt` DESC, by `pendingObservationCount` DESC, by `avgConfidence` ASC

**Step 2: Verify**

Run: `bun run typecheck`
Expected: PASS

### Task 4.4: Create admin foods-review page

**Files:**

- Create: `src/app/(admin)/foods-review/page.tsx`

**Step 1: Implement the page**

Server component:

```typescript
import { getPendingFoods } from "./actions";
import { FoodReviewGrid } from "@/components/admin/food-review-grid";

export default async function FoodsReviewPage() {
  const foods = await getPendingFoods();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Food Review</h2>
        <p className="text-sm text-muted-foreground">
          Review, approve, or delete foods and their nutrient data.
        </p>
      </div>
      <FoodReviewGrid foods={foods} />
    </div>
  );
}
```

**Step 2: Verify page renders**

Run: `bun run dev`, navigate to `/admin/foods-review` as admin.
Expected: Page renders with food cards (or empty state if no pending foods).

### Task 4.5: Update AdminNav

**Files:**

- Modify: `src/components/admin/admin-nav.tsx`

**Step 1: Add "Food Review" nav item**

In the `navItems` array (line 9), add:

```typescript
{ href: "/foods-review", label: "Food Review" },
```

Place it after the existing "Review Queue" item.

**Step 2: Verify**

Run: `bun run dev`, navigate to any admin page.
Expected: "Food Review" link appears in admin nav, links to `/foods-review`.

**Step 3: Commit**

```bash
git add src/app/(admin)/foods-review/ src/components/admin/food-review-card.tsx src/components/admin/food-review-grid.tsx src/components/admin/admin-nav.tsx
git commit -m "feat: add admin food review page with card-based approve/delete"
```

---

## Phase 5: Integration Verification

**Objective:** Verify both features work end-to-end.

**Exit Criteria:** All checks pass.

### Task 5.1: Verify builds and types

**Step 1:** Run `bun run typecheck`
Expected: exit 0

**Step 2:** Run `bun run lint`
Expected: exit 0 (or only pre-existing warnings)

**Step 3:** Run `bun run build`
Expected: exit 0

### Task 5.2: Manual verification checklist

- [ ] Navigate to `/food/[id]` as logged-in user -- feedback form visible below nutrient data
- [ ] Submit a "flag" feedback -- success message shown, form resets
- [ ] Submit a "correction" feedback with suggested value -- success message shown
- [ ] Check `food_feedback` table in Supabase Studio -- records present with correct user_id
- [ ] Navigate to `/admin/foods-review` as admin -- food cards visible
- [ ] Expand "Variants & Nutrients" on a card -- nutrients listed with values/confidence
- [ ] Expand "User Feedback" on a card -- feedback items shown
- [ ] Click "Approve All" on a card -- pending observations become approved
- [ ] Click "Delete Food" on a card -- confirmation dialog appears, confirming deletes the food
- [ ] Verify cascade: deleted food's variants, observations, evidence, and feedback are all gone
- [ ] Verify `/admin/review` observation queue still works unchanged
- [ ] Verify admin nav shows "Food Review" link

**Step 4: Final commit (if any fixes needed)**

```bash
git commit -m "fix: address integration issues in feedback and food review features"
```

---

## Relevant Codebase Files

### Patterns to Follow

- `src/app/(admin)/review/actions.ts` (lines 18-32) -- `requireAdmin()` pattern
- `src/app/(admin)/review/actions.ts` (lines 104-134) -- Server action with Zod validation + admin client
- `src/components/admin/review-queue.tsx` -- Card-based review UI with expand/collapse, `useTransition`
- `src/app/(app)/food/[id]/actions.ts` (lines 201-229) -- `addToToday()` server action with Supabase client + RLS
- `src/lib/validators.ts` (lines 8-10) -- `uuidSchema` pattern
- `src/app/(app)/food/[id]/food-detail-client.tsx` (lines 99-118) -- `useTransition` for async action calls

### Configuration Files

- `drizzle.config.ts` -- Drizzle migration config
- `supabase/config.toml` -- Local Supabase config

### Schema Files

- `src/lib/db/schema/foods.ts` -- Foods, variants, serving measures
- `src/lib/db/schema/observations.ts` -- Observations, evidence, enums
- `src/lib/db/schema/reviews.ts` -- Reviews, resolved values
- `src/lib/db/schema/users.ts` -- Profiles with role enum
- `src/lib/db/schema/nutrients.ts` -- Nutrients table

---

## Acceptance Checks

1. `bun run typecheck` -- exit 0
2. `bun run lint` -- exit 0
3. `bun run build` -- exit 0
4. User can submit feedback on `/food/[id]` (both flag and correction types)
5. Admin can view food cards on `/admin/foods-review`
6. Admin can approve all pending observations for a food
7. Admin can hard-delete a food with cascade
8. Admin can dismiss user feedback
9. Existing `/admin/review` observation queue unchanged
10. AdminNav includes "Food Review" link

---

## Risks And Mitigations

| Risk                                                       | P   | I   | Score | Mitigation                                                                                   |
| ---------------------------------------------------------- | --- | --- | ----- | -------------------------------------------------------------------------------------------- |
| RLS policies not applied correctly (feedback insert fails) | 2   | 4   | 8     | Test feedback submission as non-admin user; verify RLS in Supabase Studio                    |
| Cascade delete removes more than expected                  | 1   | 5   | 5     | All FKs already use cascade -- well-tested pattern; confirmation dialog warns user           |
| Drizzle migration conflicts with existing migrations       | 2   | 3   | 6     | Run `drizzle-kit generate` cleanly; inspect generated SQL before applying                    |
| Circular import between `feedback.ts` and `foods.ts`       | 2   | 3   | 6     | Define `foods -> feedback` relation only in `feedback.ts` to keep dependency one-directional |
| Bulk approve performance with many observations            | 1   | 2   | 2     | Single UPDATE with WHERE IN clause -- efficient even for hundreds of rows                    |

---

## Critical-Path Verification Design

- Behavior contract: Not required (standard rigor)
- Edge-case catalog: Empty states (no feedback, no pending foods), food with no variants, feedback on deleted nutrient
- Provable properties: None
- Purity boundary map: Not required
- Verification strategy: Type checking + lint + build + manual verification checklist

---

## Summary

- Plan saved: `docs/plans/2026-03-22-feedback-and-food-review-plan.md`
- Phases: 5
- Risks: 5 identified
- Key decisions: Reuse existing `deleteFoodSchema`, use Drizzle `db` for bulk operations, RLS policies in migration SQL

## Recommended Skills for BUILD (SKILL_HINTS for Router)

- `cc10x:frontend-patterns` -- shadcn/ui + Tailwind CSS 4 component patterns

## Confidence Score: 88/100

- Context references included with file:line (+25)
- Edge cases documented (+15 partial -- no formal test suite)
- Build/lint/typecheck commands specific (+20)
- Risk mitigations defined (+20)
- File paths exact and verified (+15)
- Deduction: No automated tests possible (-7), relies on manual verification (-5)

**Key Assumptions:**

- `DATABASE_URL` Drizzle connection bypasses RLS (standard Supabase setup)
- Cascade deletes on existing FKs work correctly (verified in schema)
- `deleteFoodSchema` at validators.ts:127 can be reused without modification

## Findings

- The `deleteFoodSchema` already exists in validators -- no need to create a duplicate
- The existing admin review pattern mixes Supabase client (for single-row RLS-bypassed writes) and Drizzle (for reads) -- the new feature follows the same hybrid approach
- No toast component in the shadcn setup -- use inline success/error messages instead
- The `foods` table has `createdAt`/`updatedAt` but no `createdBy` -- migration adds it as nullable to avoid breaking existing data
