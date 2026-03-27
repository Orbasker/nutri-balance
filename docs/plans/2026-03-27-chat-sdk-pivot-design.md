# Chat-SDK Pivot Design

## Purpose

Pivot NutriBalance from a web-first app to a chat-first experience using chat-sdk.dev. Users interact with a Telegram or Discord bot as their primary interface for nutrition tracking — "Can I eat this today?", meal logging, daily summaries. Web pages become secondary detail views linked from the bot. Inspired by HeySally's zero-friction WhatsApp shopping assistant pattern.

## Users

End users with medical/dietary constraints who want quick, conversational nutrition tracking without opening a web app.

## Success Criteria

- [ ] Telegram bot responds to messages with AI nutrition assistance (all 6 existing tools working)
- [ ] Discord bot works with the same logic via adapter swap
- [ ] New users can onboard entirely through chat (set name, goals, nutrient limits)
- [ ] Platform user IDs are linked to Supabase users (one user can have multiple platforms)
- [ ] Rich responses: nutrient cards, status indicators, action buttons, web links
- [ ] Existing web UI continues working unchanged for users who prefer it

## Constraints

- Keep existing web UI and all routes functional
- Reuse existing 6 AI tool functions and DB schema
- Use chat-sdk.dev (`npm install chat`) with `@chat-adapter/telegram` and `@chat-adapter/discord`
- Bun, Next.js 16.2.1, Drizzle ORM, Supabase Auth + RLS
- Bot operations bypass RLS using existing `createAdminClient()` (service role key)

## Out of Scope

- WhatsApp integration (requires Meta Business API approval — future phase)
- Migrating existing web users to bot
- Real-time push notifications from bot (only responds to user messages)
- Voice messages or image recognition (text-only for v1)

## Approach Chosen

**Shared tool module + platform adapters + service role auth**

The key insight: the 6 AI tool functions already contain all the nutrition logic. We extract them into a shared module, then wire them into both the existing web chat API and the new bot handlers. The bot uses `createAdminClient()` to bypass RLS, explicitly passing the linked `userId` for all operations.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                     Next.js App                       │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Webhook Routes (API)              Web Chat Route     │
│  ┌─────────────────┐              ┌──────────────┐   │
│  │ /api/bot/telegram│              │ /api/chat    │   │
│  │ /api/bot/discord │              │ (existing)   │   │
│  └────────┬────────┘              └──────┬───────┘   │
│           │                               │           │
│           ▼                               ▼           │
│  ┌─────────────────┐              ┌──────────────┐   │
│  │  Bot Handler     │              │ Supabase     │   │
│  │  (chat-sdk)      │              │ Session Auth │   │
│  │  + onboarding    │              └──────┬───────┘   │
│  └────────┬────────┘                      │           │
│           │                               │           │
│           ▼                               ▼           │
│  ┌─────────────────────────────────────────────┐     │
│  │         Shared Tool Module                   │     │
│  │  src/lib/bot/tools.ts                        │     │
│  │  searchFood | getFoodNutrients | checkCanIEat│     │
│  │  recordMeal | getDailySummary | aiResearch   │     │
│  │                                              │     │
│  │  Takes: (params, { userId, supabase })       │     │
│  └──────────────────┬──────────────────────────┘     │
│                     │                                 │
│                     ▼                                 │
│  ┌─────────────────────────────────────────────┐     │
│  │  Database (Supabase PostgreSQL)              │     │
│  │  foods | nutrients | profiles | consumption  │     │
│  │  + NEW: platform_accounts                    │     │
│  └─────────────────────────────────────────────┘     │
│                                                       │
│  Web Pages (existing, linked from bot)                │
│  /dashboard | /food/[id] | /settings | /log           │
└──────────────────────────────────────────────────────┘
```

## Components

### 1. New Database Table: `platform_accounts`

```sql
CREATE TABLE platform_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,          -- 'telegram' | 'discord'
  platform_user_id TEXT NOT NULL,  -- Telegram user ID or Discord user ID
  platform_username TEXT,          -- @username for display
  onboarding_state TEXT NOT NULL DEFAULT 'new',
    -- 'new' | 'awaiting_name' | 'awaiting_goals' | 'awaiting_nutrients' | 'awaiting_limits' | 'complete'
  onboarding_data JSONB,           -- Temp storage for partial onboarding answers
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(platform, platform_user_id)
);
```

Drizzle schema in `src/lib/db/schema/platform-accounts.ts`.

### 2. Shared Tool Module: `src/lib/bot/tools.ts`

Extract the 6 tool `execute` functions from `src/app/api/chat/route.ts`. Each gets a signature like:

```typescript
interface ToolContext {
  userId: string;
  supabase: SupabaseClient; // admin client for bot, session client for web
}

export async function searchFood(params: { query: string }, ctx: ToolContext) { ... }
export async function checkCanIEat(params: { foodVariantId: string; portionGrams: number }, ctx: ToolContext) { ... }
// etc.
```

Web chat route wraps these with Supabase session auth. Bot wraps with admin client + linked userId.

### 3. Bot Core: `src/lib/bot/index.ts`

```typescript
import { DiscordAdapter } from "@chat-adapter/discord";
import { TelegramAdapter } from "@chat-adapter/telegram";
import { Chat } from "chat";

const bot = new Chat({
  adapters: [
    new TelegramAdapter({ token: process.env.TELEGRAM_BOT_TOKEN }),
    new DiscordAdapter({ token: process.env.DISCORD_BOT_TOKEN }),
  ],
});

bot.onNewMention(async ({ thread, user }) => {
  // 1. Look up or create platform account
  // 2. If onboarding incomplete, route to onboarding handler
  // 3. Otherwise, pass message to AI with tools
});
```

### 4. Onboarding State Machine: `src/lib/bot/onboarding.ts`

States:

1. `new` → Welcome message, ask for name → `awaiting_name`
2. `awaiting_name` → Save name, ask about health goals → `awaiting_goals`
3. `awaiting_goals` → Save goals/clinical notes, present nutrient presets → `awaiting_nutrients`
4. `awaiting_nutrients` → Save selected nutrients, ask for limits one by one → `awaiting_limits`
5. `awaiting_limits` → Save each limit, when all done → `complete`

Each state handler returns a bot response. Partial data stored in `onboarding_data` JSONB column.

**Nutrient Presets** (quick-start options):

- "Kidney health" → Potassium, Sodium, Phosphorus
- "Blood thinner" → Vitamin K, Vitamin C
- "General tracking" → All 6 core nutrients
- "Custom" → Let me choose

### 5. Webhook Routes

- `src/app/api/bot/telegram/route.ts` — `export const POST = bot.webhooks.telegram`
- `src/app/api/bot/discord/route.ts` — `export const POST = bot.webhooks.discord`

### 6. Rich Response Cards: `src/lib/bot/cards.tsx`

JSX cards using chat-sdk's card system:

```tsx
// "Can I eat this?" result card
<Card>
  <Card.Header>🍕 Pizza (1 slice, 120g)</Card.Header>
  <Fields>
    <Field label="Sodium" value="480mg → 1,200mg/2,000mg (60%)" />
    <Field label="Potassium" value="120mg → 800mg/3,500mg (23%)" />
  </Fields>
  <Card.Footer>
    <Button action="record_meal" data={{ variantId, grams: 120 }}>
      ✅ Log this meal
    </Button>
    <Button url={`${APP_URL}/food/${foodId}`}>📊 Full details</Button>
  </Card.Footer>
</Card>
```

### 7. Web Links for Bot Users

Two strategies:

- **Public detail pages**: `/food/[id]` can be made publicly readable (food data is already public in RLS)
- **Authenticated pages** (settings, log, dashboard): Bot generates a magic link via Supabase `signInWithOtp` that logs the user in and redirects to the target page

## Data Flow

### Message Flow (Established User)

```
1. User sends "can I eat pizza?" on Telegram
2. Telegram webhook → /api/bot/telegram (POST)
3. Bot handler:
   a. Look up platform_accounts WHERE platform='telegram' AND platform_user_id='{tg_id}'
   b. Get userId from platform account
   c. Create admin Supabase client
   d. Pass message to AI with system prompt + tools (same prompt as web chat)
   e. AI calls searchFood → checkCanIEat
   f. Format result as rich card
4. Bot responds with card showing nutrient impact + "Log meal" button
5. If user clicks "Log meal", bot calls recordMeal tool
```

### Onboarding Flow (New User)

```
1. New user sends first message on Telegram
2. Bot handler:
   a. No platform_account found for this telegram_user_id
   b. Create Supabase auth user (via admin client, email = tg_{id}@platform.nutri.local)
   c. Create platform_account with onboarding_state='new'
   d. Create profile record
   e. Enter onboarding handler
3. Onboarding walks through states:
   new → awaiting_name → awaiting_goals → awaiting_nutrients → awaiting_limits → complete
4. Once complete, user can interact normally
```

## Error Handling

| Scenario                                  | Handling                                          |
| ----------------------------------------- | ------------------------------------------------- |
| Webhook verification fails                | Return 401, log to Langfuse                       |
| Platform user not linked                  | Start onboarding flow                             |
| AI tool execution fails                   | Return friendly error message via bot             |
| Food not found                            | Offer AI research (same as web)                   |
| Onboarding interrupted (user goes silent) | State persists in DB, resumes on next message     |
| Rate limiting                             | chat-sdk handles platform rate limits per adapter |
| Invalid button callback data              | Log error, ask user to try again                  |

## Testing Strategy

- Unit tests for shared tool functions (already testable with mock DB)
- Integration tests for onboarding state machine
- Manual testing with Telegram Bot Father + Discord dev bot
- Langfuse traces for all bot interactions (reuse existing integration)

## Environment Variables (New)

```
TELEGRAM_BOT_TOKEN=          # From @BotFather
DISCORD_BOT_TOKEN=           # From Discord Developer Portal
DISCORD_PUBLIC_KEY=           # For webhook verification
NEXT_PUBLIC_APP_URL=          # For generating web links from bot
```

## File Structure (New Files)

```
src/
  lib/
    bot/
      index.ts               # Chat instance with adapters
      tools.ts               # Shared AI tool functions (extracted)
      onboarding.ts           # Onboarding state machine
      cards.tsx               # Rich response card templates
      user-linking.ts         # Platform account lookup/creation
    db/
      schema/
        platform-accounts.ts  # New Drizzle schema
  app/
    api/
      bot/
        telegram/
          route.ts            # Telegram webhook
        discord/
          route.ts            # Discord webhook
supabase/
  migrations/
    XXXX_add_platform_accounts.sql  # New migration
```

## Questions Resolved

- Q: How to link platform users to Supabase? → A: New `platform_accounts` table with platform + platform_user_id unique constraint
- Q: How to handle RLS for bot? → A: Use existing `createAdminClient()` with explicit userId in all queries
- Q: How to reuse AI tools? → A: Extract into shared module with `(params, context)` signature
- Q: Where do webhooks go? → A: `/api/bot/telegram/route.ts` and `/api/bot/discord/route.ts`
- Q: How do bot users access web pages? → A: Public pages via URL, authenticated pages via magic link
- Q: How does onboarding work? → A: State machine in `platform_accounts.onboarding_state` column
