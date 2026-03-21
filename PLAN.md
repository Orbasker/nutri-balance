# NutriBalance — Implementation Plan

## Phase 0: Project Scaffold

> Set up Next.js + Supabase + Drizzle + shadcn, all wired together.

- [x] Initialize Next.js 15 with App Router, TypeScript, Tailwind CSS 4, ESLint
- [x] Install and configure shadcn/ui (init + base components: button, input, card, badge, progress, dialog, dropdown-menu, separator, sheet, tabs, command)
- [x] Initialize Supabase project locally: `supabase init`
- [x] Install `@supabase/supabase-js` + `@supabase/ssr`
- [x] Create Supabase client utilities:
  - `lib/supabase/server.ts` — server-side client (cookies-based)
  - `lib/supabase/client.ts` — browser client
  - `lib/supabase/middleware.ts` — session refresh middleware
- [x] Install and configure Drizzle ORM + drizzle-kit (driver: `postgres`)
  - `lib/db/index.ts` — drizzle client connecting via `DATABASE_URL`
  - `drizzle.config.ts`
- [x] Set up project structure:
  ```
  src/
    app/
      (auth)/
        login/
        register/
        callback/       ← Supabase auth callback route
      (app)/
        dashboard/
        search/
        food/[id]/
        log/
        settings/
      (admin)/
        review/
      layout.tsx
      page.tsx
    components/
      ui/              ← shadcn
      dashboard/
      food/
      log/
      settings/
      admin/
    lib/
      supabase/
        server.ts
        client.ts
        middleware.ts
      db/
        index.ts       ← drizzle client
        schema/
          foods.ts
          nutrients.ts
          observations.ts
          cooking.ts
          reviews.ts
          users.ts
      calculations.ts
      validators.ts
    types/
      index.ts
  middleware.ts           ← Next.js middleware (Supabase session refresh)
  supabase/
    config.toml
    migrations/
    seed.sql
  ```
- [x] Replace .gitignore with Node/Next.js version (include `.env.local`)
- [x] Add `.env.local.example` with:
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  DATABASE_URL=
  ```
- [x] Next.js middleware that refreshes Supabase session on every request
- [x] Verify `npm run dev` works
- [x] Verify `supabase start` works (local Postgres + Auth + Studio)
- [x] Verify Drizzle can connect to local Supabase DB

**Deliverable**: Running Next.js app with Supabase local dev, Drizzle connected, shadcn ready.

---

## Phase 1: Database Schema + RLS

> Define all tables in Drizzle, generate migrations, write RLS policies.

### Tables (Drizzle schema)

- [x] `foods` — id (uuid), name, category, description, created_at, updated_at
- [x] `food_aliases` — id, food_id (FK), alias, language, source
- [x] `food_variants` — id, food_id (FK), preparation_method (enum), description, is_default
- [x] `nutrients` — id, name, unit, display_name, sort_order
- [x] `serving_measures` — id, food_variant_id (FK), label, grams_equivalent
- [x] `sources` — id, name, url, type (enum), trust_level
- [x] `source_records` — id, source_id (FK), external_id, raw_data (jsonb), imported_at
- [x] `nutrient_observations` — id, food_variant_id (FK), nutrient_id (FK), value, unit, basis_amount, basis_unit, source_record_id (FK), derivation_type (enum), confidence_score, review_status (enum)
- [x] `evidence_items` — id, observation_id (FK), snippet, page_ref, row_locator, url
- [x] `retention_profiles` — id, nutrient_id (FK), preparation_method (enum), retention_factor, source_id (FK)
- [x] `yield_profiles` — id, food_id (FK), preparation_method (enum), yield_factor
- [x] `variant_calculation_rules` — id, food_variant_id (FK), base_variant_id (FK), retention_profile_id (FK), yield_profile_id (FK)
- [x] `reviews` — id, entity_type, entity_id, reviewer_id (references auth.users), status (enum), notes, reviewed_at
- [x] `resolved_nutrient_values` — id, food_variant_id (FK), nutrient_id (FK), value_per_100g, confidence_score, confidence_label, source_summary, resolved_at
- [x] `user_nutrient_limits` — id, user_id (references auth.users), nutrient_id (FK), daily_limit, mode (strict/stability), range_min, range_max
- [x] `consumption_logs` — id, user_id (references auth.users), food_variant_id (FK), serving_measure_id (FK), quantity, nutrient_snapshot (jsonb), logged_at, meal_label
- [x] `profiles` — id (references auth.users), display_name, role (user/admin), created_at

### RLS Policies (SQL migration)

- [x] Enable RLS on all tables
- [x] **Public read tables** (foods, food_aliases, food_variants, nutrients, serving_measures, resolved_nutrient_values, retention_profiles, yield_profiles):
  - `SELECT` for authenticated users (or anon if desired)
- [x] **User-scoped tables** (user_nutrient_limits, consumption_logs):
  - `SELECT` where `user_id = auth.uid()`
  - `INSERT` where `user_id = auth.uid()`
  - `UPDATE` where `user_id = auth.uid()`
  - `DELETE` where `user_id = auth.uid()`
- [x] **Admin-only tables** (sources, source_records, nutrient_observations, evidence_items, reviews, variant_calculation_rules):
  - `SELECT` for authenticated
  - `INSERT/UPDATE/DELETE` where user role = 'admin' (via profiles table or Supabase custom claims)
- [x] **Profiles**:
  - `SELECT` own profile
  - `UPDATE` own profile (except role)

### Seed Data

- [x] Seed ~10 common foods (spinach, broccoli, banana, chicken breast, salmon, rice, potato, tomato, egg, milk)
- [x] Seed variants (raw, boiled, steamed for vegetables; raw, grilled, baked for proteins)
- [x] Seed 6 core nutrients (Vitamin K, Vitamin A, Vitamin C, Potassium, Sodium, Iron)
- [x] Seed resolved_nutrient_values for all food+variant+nutrient combos
- [x] Seed serving_measures (per 100g, per cup, per piece where applicable)
- [x] Seed retention_profiles for common cooking methods

**Deliverable**: Complete schema, RLS policies, migration files, seed data.

---

## Phase 2: Auth (Supabase)

> Sign up, log in, session management, protected routes.

- [x] Auth callback route handler: `app/(auth)/callback/route.ts` — exchanges code for session
- [x] Login page (`/login`) — email/password with Supabase `signInWithPassword`
- [x] Register page (`/register`) — email/password with Supabase `signUp`
- [x] Logout action
- [x] Auto-create `profiles` row on signup (Supabase trigger or in callback)
- [x] Protected layout for `(app)` routes — check session server-side, redirect to `/login`
- [x] Protected layout for `(admin)` routes — check session + role = admin
- [x] Auth state in client components via `@supabase/ssr`

**Deliverable**: Working Supabase auth flow, protected routes, profile creation.

---

## Phase 3: Settings — Nutrient Limits

> Users configure which nutrients they track and their limits.

- [ ] Settings page UI: list of available nutrients, toggle tracking, set limit
- [ ] Add/remove tracked nutrients
- [ ] Mode selector per nutrient (strict vs stability — stability stores range_min/range_max)
- [ ] Server action to save/update `user_nutrient_limits` (RLS ensures user can only write own)
- [ ] Zod validation on inputs

**Deliverable**: Users can set and persist nutrient limits.

---

## Phase 4: Food Search

> Search foods by name/alias, show results with prep methods.

- [ ] Server action or API route for search
  - Query `foods` + `food_aliases` with ILIKE (or Supabase full-text search)
  - Join `food_variants` and `resolved_nutrient_values`
  - Return food name, variants, top nutrient indicator, confidence badge
- [ ] Search page with debounced input
- [ ] Autocomplete dropdown using shadcn Command component
- [ ] Result cards showing food name, prep type, nutrient level badge, confidence

**Deliverable**: Working food search with results.

---

## Phase 5: Food Details + "If You Eat This"

> Core decision screen: see nutrients, choose serving, see impact on daily limits.

- [ ] Food detail page: `/food/[id]`
- [ ] Variant selector (tabs or dropdown for prep methods)
- [ ] Serving selector (serving_measures for the variant + custom grams input)
- [ ] Nutrient breakdown table for selected serving
- [ ] "If you eat this" panel:
  - Current consumed today (from consumption_logs, scoped by RLS)
  - Added amount from this food
  - New total
  - Status per nutrient: safe / caution / exceed (color coded)
- [ ] Confidence/source section (collapsible)
- [ ] "Add to Today" button → server action → insert consumption_log (RLS handles user scoping)

**Deliverable**: Full food detail page with live calculation and logging.

---

## Phase 6: Dashboard

> Home screen showing today's nutrient status and recent foods.

- [ ] Fetch today's consumption_logs for user (RLS scoped)
- [ ] Aggregate nutrient totals from nutrient_snapshot
- [ ] Progress bars per tracked nutrient (consumed / limit)
  - Color coded: green (<80%), yellow (80-100%), red (>100%)
- [ ] Remaining allowance display
- [ ] Recent foods list (last 5 logged today)
- [ ] Quick action buttons: Search Food, View Log, Settings

**Deliverable**: Dashboard with live nutrient tracking.

---

## Phase 7: Daily Log

> View and manage today's food entries.

- [ ] Log page showing today's consumption_logs (RLS scoped)
- [ ] Group by meal_label or time
- [ ] Each entry: food name, variant, quantity, key nutrient amounts
- [ ] Delete entry (server action — RLS ensures own data only)
- [ ] Edit entry (change quantity → recalculate)
- [ ] Day selector to view past days
- [ ] Daily nutrient summary at top

**Deliverable**: Full daily log with CRUD.

---

## Phase 8: Admin Review Panel

> Admin interface for managing food data.

- [ ] Admin layout with role check (query profiles for role = 'admin')
- [ ] List of foods with CRUD
- [ ] Add/edit food + variants + nutrient values manually
- [ ] Review queue: list observations with `pending` status
- [ ] Approve/reject with notes
- [ ] View evidence items per observation
- [ ] Uses `SUPABASE_SERVICE_ROLE_KEY` for admin writes (bypasses RLS) or admin RLS policies

**Deliverable**: Admin can manage food data and review observations.

---

## Phase 9: Polish + Deploy

> Final cleanup and Vercel deployment.

- [ ] Loading states (Suspense boundaries, skeleton components)
- [ ] Error boundaries and error pages
- [ ] Empty states for no data / no results
- [ ] Mobile responsive pass on all pages
- [ ] SEO: metadata, og tags
- [ ] Create Supabase project on supabase.com (production)
- [ ] Link local project: `supabase link --project-ref <ref>`
- [ ] Push migrations to prod: `supabase db push`
- [ ] Seed prod with initial food data
- [ ] Vercel deployment config
- [ ] Environment variables in Vercel (Supabase URL, keys, DATABASE_URL)
- [ ] Verify auth flow works in production

**Deliverable**: Deployed, working MVP on Vercel + Supabase.

---

## Cross-Cutting: Langfuse Observability

> Integrate [Langfuse](https://langfuse.com) for tracing and observability of any LLM-powered features (e.g. food search suggestions, nutrient reasoning, confidence scoring).

- [x] Install `langfuse` SDK (`bun add langfuse`)
- [x] Configure Langfuse environment variables (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`) in `.env.local.example` and `.env.local`
- [x] Create `src/lib/langfuse.ts` — singleton Langfuse client
- [ ] Instrument LLM calls with Langfuse traces (generations, spans, scores)
- [ ] Add user feedback scores to traces where applicable
- [ ] Dashboard: Langfuse Cloud or self-hosted for monitoring latency, cost, and quality

**When**: Wire in as soon as the first LLM-backed feature is added. Langfuse tracing should wrap every LLM call from day one.

---

## Summary

| Phase | Focus           | Depends On |
| ----- | --------------- | ---------- |
| 0     | Scaffold        | —          |
| 1     | DB Schema + RLS | Phase 0    |
| 2     | Supabase Auth   | Phase 0    |
| 3     | Settings        | Phase 1, 2 |
| 4     | Food Search     | Phase 1    |
| 5     | Food Details    | Phase 4, 3 |
| 6     | Dashboard       | Phase 5    |
| 7     | Daily Log       | Phase 5    |
| 8     | Admin           | Phase 1, 2 |
| 9     | Polish + Deploy | All        |

Phases 4+8 can run in parallel. Phases 6+7 can run in parallel after Phase 5.
