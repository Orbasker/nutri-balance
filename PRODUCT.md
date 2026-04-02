# NutriBalance — Product Context

## What It Is

A web app for people who need to monitor daily substance intake due to medical, dietary, or medication constraints (e.g., Vitamin K with blood thinners, potassium with kidney disease, sodium with hypertension).

## Core Value Proposition

Answer the question: **"Can I eat this today?"** — with confidence scores, cooking method adjustments, and real-time daily tracking.

## Tech Stack

| Layer         | Technology                                  |
| ------------- | ------------------------------------------- |
| Framework     | Next.js 15 (App Router)                     |
| UI            | shadcn/ui + Tailwind CSS 4                  |
| Database      | Supabase (PostgreSQL)                       |
| ORM           | Drizzle ORM (for schema/migrations/queries) |
| Auth          | Supabase Auth (@supabase/ssr)               |
| Authorization | Supabase RLS (Row Level Security)           |
| Deployment    | Vercel                                      |
| Validation    | Zod                                         |
| State         | React Server Components + Server Actions    |
| CLI           | Supabase CLI (local dev, migrations, seed)  |

### Supabase Architecture Notes

- **Auth**: Supabase Auth handles signup/login/sessions. `auth.users` is the source of truth for user identity.
- **RLS**: All user-facing tables have RLS enabled. Policies use `auth.uid()` to scope reads/writes.
- **Drizzle**: Used for schema definition, type-safe queries, and migration generation. Connects via Supabase connection string.
- **Supabase Client**: `@supabase/ssr` for server-side client creation in Next.js (handles cookies/sessions).
- **Local Dev**: `supabase start` for local Postgres + Auth + Studio. Migrations managed via `supabase db diff` or `drizzle-kit generate`.

## Screens

1. **Dashboard** — Today's substance progress bars (consumed/remaining/limit), recent food log, quick actions
2. **Food Search** — Autocomplete search with aliases, prep method badges, nutrient level indicators
3. **Food Details** — Serving selector, nutrient breakdown, "if you eat this" projection (current + added = total → safe/caution/exceed), confidence badge
4. **Daily Log** — Foods consumed today grouped by meal/time, edit/delete entries, daily substance totals
5. **Settings** — Personal nutrient limits, strict vs stability mode, medication notes
6. **Missing Food** — Request enrichment, submit manual data, "under verification" status
7. **Admin Review** — Approve/reject AI-generated candidates, inspect evidence & confidence

## Data Model (16 Core Tables)

### Food Domain

- **foods** — Canonical food entities (spinach, broccoli, olive oil)
- **food_aliases** — Alternative names, languages, slang, spelling variants → links to food
- **food_variants** — Preparation states (raw, boiled, steamed, fried, drained) → links to food
- **substances** — Nutrient definitions (vitamin K, potassium, sodium, iron...)
- **serving_measures** — Per 100g, per cup, per tablespoon, per piece

### Evidence & Observations

- **sources** — Trusted references (USDA, FoodData Central, scientific papers)
- **source_records** — Raw imported entries from each source
- **substance_observations** — Core data: nutrient value + food variant + unit + basis + source + derivation + confidence + review status
- **evidence_items** — Traceable snippets, page refs, row locators linked to observations

### Cooking Science

- **retention_profiles** — How much nutrient remains after cooking method X
- **yield_profiles** — Weight change from raw to cooked
- **variant_calculation_rules** — Rules to derive cooked values from raw using retention + yield

### Trust & Review

- **reviews** — Approval workflow for observations, variants, aliases, candidates
- **resolved_substance_values** — Final trusted, app-ready values (materialized/cached for fast lookup)

### User Domain

- **user_substance_limits** — Per-user daily limits with mode (strict/stability) and range
- **consumption_logs** — What the user ate, when, how much, which variant

### Enrichment Pipeline (future)

- **user_submissions** — Corrections, missing food requests
- **ingestion_jobs** — Background enrichment pipeline tasks
- **agent_candidates** — AI-generated candidate records pending review

## Calculation Logic

```
substance_amount = (base_per_100g) × (portion_g / 100) × retention_factor
remaining = daily_limit - consumed_today
post_meal = consumed_today + substance_amount
status = post_meal <= 80% limit → safe
         post_meal <= 100% limit → caution
         post_meal > limit → exceed
```

**Stability mode**: target a consistent range (e.g., 80-120μg Vitamin K) rather than just staying under a max.

## Confidence Model

| Score  | Label           | UX Display                                |
| ------ | --------------- | ----------------------------------------- |
| 90-100 | High confidence | "Verified" badge                          |
| 80-89  | Good confidence | "High Confidence" badge                   |
| 60-79  | Moderate        | "Estimated" badge                         |
| <60    | Low             | "Under Review" — not for medical guidance |

## Color System

- 🟢 Green = safe (within limit)
- 🟡 Yellow = caution (approaching limit)
- 🔴 Red = exceeds limit

## Two System Paths

### A. Read Path (user-facing, fast)

User searches → resolved_substance_values → apply serving + prep + limits → return status

### B. Enrichment Path (background, grows DB)

Missing food → ingestion job → AI agent normalizes/searches/extracts → candidate records → confidence scoring → review queue → approved → resolved values

## MVP Scope

- Auth + user profiles
- Nutrient limit settings (strict mode only)
- Food search against seeded data
- Food details with serving selector + "if you eat this"
- Daily consumption logging
- Dashboard with progress bars
- Basic admin for managing food data

## Future Scope

- AI enrichment pipeline
- Stability mode
- Barcode scanning
- Image-based food recognition
- Meal suggestions / lower-nutrient alternatives
- Multilingual support
- Clinician/dietitian portal
- Wearable integrations
