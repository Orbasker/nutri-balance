@AGENTS.md

# NutriBalance

Nutrient intake tracker for people with medical/dietary constraints. Answers "Can I eat this today?" with confidence scores, cooking adjustments, and daily tracking.

## Quick Reference

- **Framework**: Next.js 16.2.1 (App Router) — NOT the version you know. Read `node_modules/next/dist/docs/` before writing any Next.js code.
- **Package manager**: Bun
- **UI**: shadcn/ui (base-nova style) + Tailwind CSS 4
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Supabase Auth (`@supabase/ssr`) — email/password + Google OAuth, JWT-based with RLS
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
    (auth)/          # Login, register pages
    (app)/           # Protected routes: dashboard, search, food/[id], log, settings
    (admin)/         # Admin-only: review
    api/auth/callback/ # Supabase OAuth callback handler
  components/
    ui/              # shadcn components (do not edit directly)
  lib/
    auth.ts          # Session type definition
    auth-client.ts   # Re-exports Supabase browser client
    auth-session.ts  # getSession() / requireSession() helpers for server components/actions
    auth-admin.ts    # requireAdmin() helper
    supabase/
      server.ts      # Supabase server client (cookie-based, RLS-enforced)
      client.ts      # Supabase browser client
      admin.ts       # Supabase service-role client (bypasses RLS)
      middleware.ts   # Session refresh for proxy.ts
    db/
      index.ts       # Drizzle client (DATABASE_URL)
      schema/        # Drizzle table definitions (auth, foods, nutrients, observations, cooking, reviews, users)
    calculations.ts  # Nutrient math
    validators.ts    # Zod schemas
  types/
    index.ts
proxy.ts             # Next.js proxy — optimistic cookie check, protects routes
supabase/
  migrations/        # Drizzle-generated SQL migrations
  seed.sql           # Seed data
```

## Database

- **ORM**: Drizzle. Schema lives in `src/lib/db/schema/`. Migrations output to `supabase/migrations/`.
- **Config**: `drizzle.config.ts` — dialect: postgresql, schema glob: `./src/lib/db/schema/*`
- **Auth tables**: Managed by Supabase Auth in the `auth` schema. `public.user` is a **read-only view** over `auth.users` for Drizzle compatibility — do NOT insert/update via Drizzle.
- **App tables**: profiles, user_nutrient_limits, consumption_logs, foods, food_variants, nutrients, etc.
- **Authorization**: Row Level Security (RLS) enforced at database layer via `auth.uid()`. Application-layer checks via `getSession()` and `requireAdmin()` remain as defense-in-depth.

## Auth (Supabase Auth)

- **Server client**: `import { createClient } from "@/lib/supabase/server"` — cookie-based, RLS-enforced
- **Browser client**: `import { createClient } from "@/lib/supabase/client"` — for client components
- **Admin client**: `import { supabaseAdmin } from "@/lib/supabase/admin"` — service-role, bypasses RLS (server-only)
- **Server session**: `import { getSession } from "@/lib/auth-session"` — returns session or null
- **Admin check**: `import { requireAdmin } from "@/lib/auth-admin"` — returns userId or null
- **OAuth callback**: `src/app/api/auth/callback/route.ts` — handles PKCE code exchange
- **Proxy**: Supabase session refresh + auth check in `src/proxy.ts`
- **RLS**: All tables have row-level security policies. User-scoped tables use `auth.uid()::text`. Admin tables use `is_admin()`. See migration `0016_supabase_auth_migration.sql`.

## Environment Variables

See `.env.local.example`:

```
DATABASE_URL=                      # Direct Postgres connection for Drizzle ORM (admin/migration use)
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon key (safe for browser)
SUPABASE_SERVICE_ROLE_KEY=         # Supabase service role key (server-only, bypasses RLS)
GOOGLE_CLIENT_ID=                  # Google OAuth (configured in Supabase Dashboard)
GOOGLE_CLIENT_SECRET=              # Google OAuth (configured in Supabase Dashboard)
```

## Key Patterns

- **Server Actions** for mutations (not API routes) — auth checked via `getSession()`
- **React Server Components** by default; use `"use client"` only when needed
- **All DB queries use Drizzle ORM** — no raw SQL or PostgREST
- **Nutrient calculation**: `amount = (base_per_100g) × (portion_g / 100) × retention_factor`
- **Status thresholds**: safe (<80% limit), caution (80-100%), exceed (>100%)
- **Confidence model**: High (90-100), Good (80-89), Moderate (60-79), Low (<60)

## Implementation Status

Phases 0–2 are complete. See `PLAN.md` for the full 10-phase roadmap and `PRODUCT.md` for product context.
