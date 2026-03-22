# User Feedback & Admin Food Review Design

## Purpose

1. **User feedback on food data** — Let any logged-in user flag incorrect nutrient values or suggest corrections on food detail pages. This crowd-sources data quality improvement.
2. **Admin food card review** — Give admins a card-based view of entire food items (with all variants/nutrients grouped) to approve or hard-delete foods, especially AI-generated ones.

## Users

- **End users**: Submit feedback on food data from the food detail page
- **Admins**: Review food cards, approve/delete foods, view user feedback

## Success Criteria

- [ ] Any logged-in user can flag or suggest a correction on a nutrient from the food detail page
- [ ] Feedback submissions are stored with the user, food, nutrient, and optional suggested value
- [ ] Admins see a card-based food review page at `/admin/foods-review`
- [ ] Each card shows the food name, all variants with their nutrients, pending observation count, confidence, and creation source
- [ ] Admins can approve (mark all pending observations as approved) or delete (cascade hard-delete) a food from the card
- [ ] Admins can view feedback submitted by users on each food card
- [ ] The existing `/admin/review` observation-level queue remains unchanged

## Constraints

- Supabase RLS — feedback table needs user-scoped insert policy, admin-scoped read policy
- Drizzle ORM — all schema changes via Drizzle, no raw SQL
- `foods` table currently has no `createdBy` column — need a migration to add it
- Hard delete on food cascades through `food_variants` → `nutrient_observations` → `evidence_items` (already set up via `onDelete: "cascade"` in schema)

## Out of Scope

- Email/push notifications when feedback is submitted
- Feedback resolution workflow (admin responding to feedback)
- Editing food data inline from the review card (use existing admin food editor)
- Soft delete / undo functionality
- User-facing feedback history ("my submitted feedback")

## Approach Chosen

**Option A: Lightweight Feedback Table + Separate Admin Food Review Page**

New `food_feedback` table for user submissions. New `/admin/foods-review` page with card-based UI. Add `createdBy` to `foods` table for attribution.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Food Detail Page (/food/[id])                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │ [existing content]                                  │  │
│  │                                                     │  │
│  │ ── Feedback Section ──                              │  │
│  │ [Flag an issue] or [Suggest correction] per nutrient│  │
│  │ → Server Action → food_feedback table               │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Admin Food Review (/admin/foods-review)                 │
│  ┌──────────────────────┐ ┌──────────────────────┐      │
│  │ 🥦 Quinoa            │ │ 🥩 Chicken Breast     │      │
│  │ AI-generated · 3 var │ │ AI-generated · 4 var  │      │
│  │ 12 pending obs       │ │ 8 pending obs         │      │
│  │ Avg confidence: 72%  │ │ Avg confidence: 78%   │      │
│  │ 2 user feedback      │ │ 0 user feedback       │      │
│  │                      │ │                        │      │
│  │ ▼ Expand nutrients   │ │ ▼ Expand nutrients     │      │
│  │                      │ │                        │      │
│  │ [Approve] [Delete]   │ │ [Approve] [Delete]     │      │
│  └──────────────────────┘ └──────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

## Components

### 1. Database Schema

**New table: `food_feedback`**

```
food_feedback
├── id: uuid (PK)
├── food_id: uuid (FK → foods.id, CASCADE)
├── nutrient_id: uuid (FK → nutrients.id, CASCADE, nullable)
├── food_variant_id: uuid (FK → food_variants.id, CASCADE, nullable)
├── user_id: uuid (not FK — Supabase auth)
├── type: enum('flag', 'correction')
├── message: text (required — description of issue)
├── suggested_value: numeric (nullable — only for corrections)
├── suggested_unit: text (nullable — only for corrections)
├── source_url: text (nullable — supporting evidence)
├── status: enum('open', 'reviewed', 'dismissed') default 'open'
├── created_at: timestamptz
└── reviewed_at: timestamptz (nullable)
```

**Alter table: `foods`**

```
+ created_by: uuid (nullable — null for pre-existing/seed data)
```

**New enums:**

- `feedback_type`: ['flag', 'correction']
- `feedback_status`: ['open', 'reviewed', 'dismissed']

### 2. RLS Policies (via migration)

```sql
-- food_feedback: users can insert their own, admins can read all
INSERT: auth.uid() = user_id
SELECT: auth.uid() = user_id OR role = 'admin'
UPDATE: role = 'admin' (status changes only)
DELETE: role = 'admin'
```

### 3. Server Actions

**`src/app/(app)/food/[id]/feedback-actions.ts`**

- `submitFeedback(data)` — validates with Zod, inserts into `food_feedback`
- Requires authenticated user (not admin)

**`src/app/(admin)/foods-review/actions.ts`**

- `getPendingFoods()` — returns foods with pending observations, grouped with variants/nutrients/feedback counts
- `approveFood(foodId)` — bulk-updates all pending observations to "approved", creates review records
- `deleteFood(foodId)` — hard-deletes the food (cascades through variants, observations, evidence, feedback)
- `getFoodFeedback(foodId)` — returns user feedback for a specific food
- `dismissFeedback(feedbackId)` — marks feedback as reviewed/dismissed

### 4. UI Components

**`src/components/food/feedback-form.tsx`** (client component)

- Appears on food detail page below nutrient breakdown
- Dropdown to select nutrient (or "General feedback")
- Radio: "Flag an issue" or "Suggest a correction"
- If correction: numeric input for suggested value + unit display
- Text area for message
- Optional source URL field
- Submit button → calls `submitFeedback` server action
- Success/error toast feedback

**`src/components/admin/food-review-card.tsx`** (client component)

- Card showing: food name, category, creation source (AI/manual), created_by info
- Summary stats: variant count, pending observation count, avg confidence, feedback count
- Expandable section showing all variants with their nutrients
- Expandable section showing user feedback items
- Action buttons: Approve All (green), Delete Food (red with confirmation dialog)

**`src/components/admin/food-review-grid.tsx`** (client component)

- Grid/list of `FoodReviewCard` components
- Filter: all / AI-generated only / has feedback
- Sort: newest first / most pending / lowest confidence

### 5. Pages

**`src/app/(admin)/foods-review/page.tsx`**

- Server component fetching pending foods
- Renders `FoodReviewGrid`

### 6. Validators (add to `src/lib/validators.ts`)

```ts
submitFeedbackSchema = z.object({
  foodId: uuidSchema,
  nutrientId: uuidSchema.optional(),
  foodVariantId: uuidSchema.optional(),
  type: z.enum(["flag", "correction"]),
  message: z.string().min(10).max(1000),
  suggestedValue: z.number().nonnegative().optional(),
  suggestedUnit: z.string().max(20).optional(),
  sourceUrl: z.string().url().max(500).optional(),
});

approveFoodSchema = z.object({ foodId: uuidSchema });
deleteFoodSchema = z.object({ foodId: uuidSchema });
dismissFeedbackSchema = z.object({ feedbackId: uuidSchema });
```

## Data Flow

### Feedback Submission

```
User on /food/[id] → clicks "Report issue" on a nutrient
  → FeedbackForm renders with nutrient pre-selected
  → User fills form → submitFeedback() server action
  → Zod validation → Supabase insert (RLS: auth.uid() = user_id)
  → Revalidate food page → show success toast
```

### Admin Food Review

```
Admin visits /admin/foods-review
  → getPendingFoods() server action
  → Drizzle query: foods LEFT JOIN food_variants LEFT JOIN nutrient_observations
    WHERE any observation has review_status = 'pending'
    + count of food_feedback per food
  → Render cards

Admin clicks "Approve All" on a card
  → approveFood(foodId) server action
  → requireAdmin() check
  → UPDATE nutrient_observations SET review_status = 'approved'
    WHERE food_variant_id IN (variants of this food) AND review_status = 'pending'
  → INSERT review records for each observation
  → Revalidate page

Admin clicks "Delete" on a card
  → Confirmation dialog ("This permanently deletes the food and all its data")
  → deleteFood(foodId) server action
  → requireAdmin() check
  → DELETE FROM foods WHERE id = foodId (cascades everything)
  → Revalidate page
```

## Error Handling

- **Unauthenticated feedback**: Server action checks `auth.getUser()`, returns error
- **Admin-only actions**: `requireAdmin()` guard on all admin actions
- **Delete confirmation**: Client-side confirmation dialog before calling delete action
- **Concurrent modifications**: Optimistic UI with error toast on server failure
- **Cascade delete safety**: PostgreSQL cascade handles referential integrity

## Testing Strategy

- Server actions: test Zod validation with valid/invalid inputs
- RLS: verify users can only insert own feedback, admins can read all
- Cascade delete: verify deleting a food removes variants, observations, evidence, and feedback
- UI: verify feedback form shows/hides correction fields based on type selection
- Admin card: verify approve updates all pending observations, delete removes food

## UI Mockup — Feedback Form (on food detail page)

```
┌─────────────────────────────────────────────┐
│  Report an Issue                            │
├─────────────────────────────────────────────┤
│  Nutrient: [▼ Sodium (mg)            ]      │
│                                             │
│  Type:  ○ Flag an issue                     │
│         ● Suggest a correction              │
│                                             │
│  Suggested value: [  142  ] mg              │
│                                             │
│  What's wrong?                              │
│  ┌─────────────────────────────────────┐    │
│  │ The sodium value for raw quinoa     │    │
│  │ seems too high compared to USDA...  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Source URL (optional):                     │
│  ┌─────────────────────────────────────┐    │
│  │ https://fdc.nal.usda.gov/...        │    │
│  └─────────────────────────────────────┘    │
│                                             │
│              [Submit Feedback]               │
└─────────────────────────────────────────────┘
```

## UI Mockup — Admin Food Review Card

```
┌─────────────────────────────────────────────┐
│  Quinoa                          AI-generated│
│  Category: grain                             │
│  Created: 2026-03-20                         │
├─────────────────────────────────────────────┤
│  3 variants · 12 pending · Avg conf: 72%    │
│  2 user feedback items                       │
├─────────────────────────────────────────────┤
│  ▶ Variants & Nutrients                      │
│  ▶ User Feedback (2)                         │
├─────────────────────────────────────────────┤
│  [✓ Approve All]          [🗑 Delete Food]   │
└─────────────────────────────────────────────┘
```

## Questions Resolved

- Q: What kind of feedback can users leave?
  A: Both flag incorrect data AND suggest corrections with new values

- Q: What happens on admin delete?
  A: Hard delete — cascade remove food + all variants, observations, evidence

- Q: Where does the card review live?
  A: Separate new page `/admin/foods-review` — existing observation queue stays
