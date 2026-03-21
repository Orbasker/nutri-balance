@AGENTS.md

# NutriBalance

Nutrient intake tracker for people with medical/dietary constraints. Answers "Can I eat this today?" with confidence scores, cooking adjustments, and daily tracking.

## Quick Reference

- **Framework**: Next.js 16.2.1 (App Router) — NOT the version you know. Read `node_modules/next/dist/docs/` before writing any Next.js code.
- **Package manager**: Bun
- **UI**: shadcn/ui (base-nova style) + Tailwind CSS 4
- **Database**: Supabase (PostgreSQL v17) + Drizzle ORM
- **Auth**: Supabase Auth via `@supabase/ssr`
- **Validation**: Zod 4
- **Path alias**: `@/*` → `./src/*`

## Commands

```bash
bun run dev          # Start Next.js dev server
bun run build        # Production build
bun run lint         # ESLint check
bun run lint:fix     # ESLint auto-fix
bun run format       # Prettier format
bun run format:check # Prettier check
bun run typecheck    # tsc --noEmit

supabase start       # Local Postgres + Auth + Studio (port 54323)
supabase stop        # Stop local services
supabase db diff     # Generate migration from schema changes
supabase db push     # Apply migrations

bunx drizzle-kit generate  # Generate migrations from Drizzle schema
bunx drizzle-kit push      # Push schema directly (dev only)
```

## Pre-commit Hook

Husky runs `bunx lint-staged` on commit, which checks formatting and linting on staged files.

## Code Style

- Double quotes, semicolons, 2-space indent, trailing commas
- Print width: 100
- Import order (enforced by prettier plugin): react → next → third-party → `@/components` → `@/lib` → `@/types` → relative
- Blank line between import groups
- Use `cn()` from `@/lib/utils` for conditional class merging

## Project Structure

```
src/
  app/
    (auth)/          # Login, register, auth callback
    (app)/           # Protected routes: dashboard, search, food/[id], log, settings
    (admin)/         # Admin-only: review
  components/
    ui/              # shadcn components (do not edit directly)
  lib/
    supabase/        # server.ts (SSR client), client.ts (browser), middleware.ts (session refresh)
    db/
      index.ts       # Drizzle client (DATABASE_URL)
      schema/        # Drizzle table definitions (foods, nutrients, observations, cooking, reviews, users)
    calculations.ts  # Nutrient math
    validators.ts    # Zod schemas
  types/
    index.ts
proxy.ts             # Next.js proxy — refreshes Supabase session, protects routes
supabase/
  config.toml        # Local dev config (project: "bucharest")
  migrations/        # Drizzle-generated SQL migrations
  seed.sql           # Seed data
```

## Database

- **ORM**: Drizzle. Schema lives in `src/lib/db/schema/`. Migrations output to `supabase/migrations/`.
- **Config**: `drizzle.config.ts` — dialect: postgresql, schema glob: `./src/lib/db/schema/*`
- **RLS**: All tables use Supabase Row Level Security. User-scoped tables filter by `auth.uid()`. Admin tables require role check.
- **16 core tables**: foods, food_aliases, food_variants, nutrients, serving_measures, sources, source_records, nutrient_observations, evidence_items, retention_profiles, yield_profiles, variant_calculation_rules, reviews, resolved_nutrient_values, user_nutrient_limits, consumption_logs, profiles

## Supabase Clients

- **Server components/actions**: `import { createClient } from "@/lib/supabase/server"` — async, uses cookies
- **Client components**: `import { createClient } from "@/lib/supabase/client"` — browser client
- **Proxy**: `src/lib/supabase/middleware.ts` exports `updateSession()`, called from `src/proxy.ts`
- **Admin writes**: Use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS

## Environment Variables

See `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=       # Supabase API URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anon key (safe for browser)
SUPABASE_SERVICE_ROLE_KEY=      # Admin key (server-only, bypasses RLS)
DATABASE_URL=                   # Direct Postgres connection for Drizzle
```

## Key Patterns

- **Server Actions** for mutations (not API routes) — RLS handles authorization
- **React Server Components** by default; use `"use client"` only when needed
- **Nutrient calculation**: `amount = (base_per_100g) × (portion_g / 100) × retention_factor`
- **Status thresholds**: safe (<80% limit), caution (80-100%), exceed (>100%)
- **Confidence model**: High (90-100), Good (80-89), Moderate (60-79), Low (<60)

## Implementation Status

Phases 0–2 are complete. See `PLAN.md` for the full 10-phase roadmap and `PRODUCT.md` for product context.
