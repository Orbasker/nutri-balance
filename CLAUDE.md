@AGENTS.md

# NutriBalance

Nutrient intake tracker for people with medical/dietary constraints. Answers "Can I eat this today?" with confidence scores, cooking adjustments, and daily tracking.

## Quick Reference

- **Framework**: Next.js 16.2.1 (App Router) — NOT the version you know. Read `node_modules/next/dist/docs/` before writing any Next.js code.
- **Package manager**: Bun
- **UI**: shadcn/ui (base-nova style) + Tailwind CSS 4
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Better Auth (`better-auth`) — email/password + Google OAuth, session-based
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
    api/auth/[...all]/ # Better Auth API route handler
  components/
    ui/              # shadcn components (do not edit directly)
  lib/
    auth.ts          # Better Auth server config
    auth-client.ts   # Better Auth browser client
    auth-session.ts  # getSession() / requireSession() helpers for server components/actions
    auth-admin.ts    # requireAdmin() helper
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
- **Auth tables**: `user`, `session`, `account`, `verification` — managed by Better Auth (schema in `src/lib/db/schema/auth.ts`)
- **App tables**: profiles, user_nutrient_limits, consumption_logs, foods, food_variants, nutrients, etc.
- **Authorization**: Application-layer checks via `getSession()` and `requireAdmin()`. No RLS.

## Auth (Better Auth)

- **Server config**: `src/lib/auth.ts` — betterAuth instance with Drizzle adapter, email/password, Google OAuth
- **Client**: `src/lib/auth-client.ts` — `authClient` for browser-side sign-in/up/out
- **Server session**: `import { getSession } from "@/lib/auth-session"` — returns session or null
- **Admin check**: `import { requireAdmin } from "@/lib/auth-admin"` — returns userId or null
- **API handler**: `src/app/api/auth/[...all]/route.ts`
- **Proxy**: Cookie-based optimistic check in `src/proxy.ts`, full validation in layouts/actions

## Environment Variables

See `.env.local.example`:

```
DATABASE_URL=              # Direct Postgres connection for Drizzle + Better Auth
BETTER_AUTH_SECRET=        # Random secret for session encryption
BETTER_AUTH_URL=           # App URL (http://localhost:3000 in dev)
GOOGLE_CLIENT_ID=          # Google OAuth (optional)
GOOGLE_CLIENT_SECRET=      # Google OAuth (optional)
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
