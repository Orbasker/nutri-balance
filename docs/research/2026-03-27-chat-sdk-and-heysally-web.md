# Web Research: Chat SDK (chat-sdk.dev) and HeySally (heysally.co.il)

## Execution

- Preferred backend: websearch+webfetch
- Allowed fallbacks: websearch-only
- Research round: 1

## Sources Used

- WebSearch: succeeded (multiple queries)
- WebFetch: succeeded (chat-sdk.dev, GitHub, Vercel blog, docs pages)
- WebFetch on heysally.co.il: partial (mostly metadata, site is Hebrew-heavy)

## Research Quality

- Status: COMPLETE
- Quality level: high
- Backend mode: websearch+webfetch

---

# Part 1: Chat SDK (chat-sdk.dev)

## What It Is

Chat SDK is a **unified TypeScript library for building chatbots** that deploy across multiple messaging platforms from a single codebase. It is **NOT a React component library** -- it is a server-side bot framework. Think of it as an abstraction layer over platform-specific messaging APIs (Slack, Discord, Teams, etc.).

- **Created by**: Vercel (GitHub repo: vercel/chat)
- **License**: Open source, currently in beta
- **Package**: `npm install chat`
- **Tagline**: "Write your bot logic once, deploy everywhere"

## Architecture

Three-layer design:

### 1. Core (`chat` package)

The `Chat` class is the main entry point. It coordinates adapters, routes events, and provides the unified API surface.

```typescript
import { createSlackAdapter } from "@chat-adapter/slack";
import { createRedisState } from "@chat-adapter/state-redis";
import { Chat } from "chat";

const bot = new Chat({
  userName: "mybot",
  adapters: {
    slack: createSlackAdapter(),
    discord: createDiscordAdapter(),
    teams: createTeamsAdapter(),
  },
  state: createRedisState(),
});
```

### 2. Adapter Layer (platform-specific packages)

Each platform has its own adapter package. Adapters handle:

- Webhook parsing
- API interactions
- Markdown-to-native conversion
- Platform-specific rendering (Block Kit for Slack, Adaptive Cards for Teams, etc.)
- Credential auto-detection from environment variables

### 3. State Management (pluggable persistence)

Handles thread subscriptions, distributed locking, and session caching.

| Package                       | Use Case                 |
| ----------------------------- | ------------------------ |
| `@chat-adapter/state-redis`   | Production (Redis)       |
| `@chat-adapter/state-ioredis` | Alternative Redis client |
| `@chat-adapter/state-pg`      | Production (PostgreSQL)  |
| `@chat-adapter/state-memory`  | Development only         |

## Supported Platforms

| Platform        | Package                  | Mentions | Reactions | Cards   | Modals | Streaming | DMs      |
| --------------- | ------------------------ | -------- | --------- | ------- | ------ | --------- | -------- |
| Slack           | `@chat-adapter/slack`    | Yes      | Yes       | Yes     | Yes    | Native    | Yes      |
| Microsoft Teams | `@chat-adapter/teams`    | Yes      | Read-only | Yes     | No     | Post+edit | Yes      |
| Google Chat     | `@chat-adapter/gchat`    | Yes      | Yes       | Yes     | No     | Post+edit | Yes      |
| Discord         | `@chat-adapter/discord`  | Yes      | Yes       | Yes     | No     | Post+edit | Yes      |
| Telegram        | `@chat-adapter/telegram` | Yes      | Yes       | Partial | No     | Post+edit | Yes      |
| GitHub          | `@chat-adapter/github`   | Yes      | Yes       | No      | No     | No        | No       |
| Linear          | `@chat-adapter/linear`   | Yes      | Yes       | No      | No     | No        | No       |
| WhatsApp        | `@chat-adapter/whatsapp` | No       | Yes       | Partial | No     | No        | DMs only |

**WhatsApp specifics**: Supports messages, reactions, auto-chunking, read receipts, multimedia downloads, location sharing. Cards render as interactive reply buttons (max 3 options). Enforces a 24-hour messaging window.

## Installation and Setup

```bash
# Core
npm install chat

# Platform adapters (pick what you need)
npm install @chat-adapter/slack
npm install @chat-adapter/teams
npm install @chat-adapter/gchat
npm install @chat-adapter/discord
npm install @chat-adapter/telegram
npm install @chat-adapter/github
npm install @chat-adapter/linear
npm install @chat-adapter/whatsapp

# State adapters (pick one)
npm install @chat-adapter/state-redis
npm install @chat-adapter/state-pg
npm install @chat-adapter/state-memory
```

Adapters auto-detect credentials from environment variables:

- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`
- `REDIS_URL`
- etc.

## Key APIs and Event Handlers

### Event Registration

```typescript
bot.onNewMention(async (thread) => { ... })        // @mentions
bot.onSubscribedMessage(async (thread, msg) => { }) // Follow-up messages
bot.onReaction(async (thread, reaction) => { })     // Emoji reactions
bot.onSlashCommand(async (thread, cmd) => { })      // /commands
bot.onAction(async (thread, action) => { })         // Button clicks
```

### Thread Management

```typescript
await thread.subscribe(); // Start listening to thread
await thread.post("text"); // Post a message
await thread.post({ markdown: "**bold**" }); // Markdown
```

### Posting Messages

Multiple formats supported:

- **Plain text**: `await thread.post("Hello")`
- **Markdown**: `await thread.post({ markdown: "**bold** text" })` -- auto-converts to platform-native format
- **AST builders**: `root`, `paragraph`, `text`, `strong`, `link`, etc. for programmatic control
- **Cards (JSX)**: Interactive cross-platform cards
- **AI Streaming**: Pass AI SDK streams directly to `post()`

### AI Streaming Integration

```typescript
bot.onNewMention(async (thread) => {
  const stream = await openai.chat.completions.create({ stream: true, ... });
  await thread.post(stream); // SDK handles platform-specific streaming
});
```

- Slack gets native real-time streaming with formatting
- Other platforms use post-then-edit fallback

### JSX Cards

Requires `tsconfig.json`: `"jsx": "react-jsx"`, `"jsxImportSource": "chat"`

Components: `Card`, `CardText`, `Fields`, `Table`, `Image`, `Section`, `Divider`, `Button`, `LinkButton`, `Select`, `RadioSelect`, `Actions`

```typescript
await thread.post(
  <Card title="Deploy Status">
    <Fields fields={{ Environment: "production", Status: "success" }} />
    <Actions>
      <Button id="rollback" style="danger">Rollback</Button>
    </Actions>
  </Card>
);
```

### Webhooks (Next.js Integration)

```typescript
// app/api/slack/route.ts
export const POST = bot.webhooks.slack;
```

### Direct Messaging

```typescript
const dm = await bot.openDM("slack:U123ABC");
await dm.post("Hey!");
```

### Channel Access

```typescript
const channel = bot.channel("slack:C123ABC");
await channel.post("Announcement!");
```

### Configuration Options

- `userName` (required): Bot display name
- `dedupeTtlMs`: Message dedup TTL (default 300000ms)
- `streamingUpdateIntervalMs`: Streaming update frequency (default 500ms)
- `onLockConflict`: Thread lock conflict handling ('drop' or 'force')

### Singleton Pattern

```typescript
const bot = new Chat({ ... }).registerSingleton();
// In another file:
const bot = Chat.getSingleton();
```

## Multi-Channel Messaging

The core value proposition. Handler code is platform-agnostic:

- Messages are normalized into a consistent format (text, AST, author info, metadata)
- The adapter layer handles all platform-specific rendering
- Swapping platforms means swapping adapters, not rewriting handlers
- Context enrichment: channel/user names, link previews, images are auto-included

## Next.js Integration

Chat SDK has first-class Next.js support:

- Webhook routes map to Next.js API route handlers (`export const POST = bot.webhooks.slack`)
- Serverless-compatible (works with Vercel deployment)
- Tutorial available: "Slack bot with Next.js and Redis"
- Also supports Hono and Nuxt

## Framework Guides Available

- Slack bot with Next.js and Redis
- Discord support bot with Nuxt
- GitHub code review bot with Hono
- Durable sessions with Vercel Workflow

## Key Distinction

This is NOT a chat UI component library. It does NOT provide React components for building chat interfaces in web apps. It is a **server-side bot framework** for building bots that live inside existing messaging platforms.

---

# Part 2: HeySally (heysally.co.il)

## What It Is

HeySally (Sally) is an **Israeli WhatsApp-based personal shopping assistant bot**. It operates entirely within WhatsApp -- no separate app download required.

## Core Features

- **Shopping list management**: Create, organize, and manage grocery shopping lists via WhatsApp conversation
- **List sharing**: Share lists with family members
- **Automatic categorization**: Items are auto-organized by supermarket departments/aisles
- **Cost savings**: Features to help users save money (referenced as "save-with-sally")

## UX Pattern

### Platform: WhatsApp Only

Sally runs entirely inside WhatsApp. Users message the bot like they would message a friend. This is a key UX pattern -- zero friction, no new app to install, works on the platform people already use daily.

### Interaction Model

- **Conversational**: Users send natural language messages to manage their shopping lists
- **Hebrew-first**: Primary language is Hebrew, serving the Israeli market
- **Personal assistant metaphor**: Positioned as "your personal shopping assistant" (Hebrew: "assistant for shopping")

### User Journey (from site structure)

1. Discovery / landing page
2. How-it-works explanation
3. Feature highlights
4. Savings benefits showcase
5. Media coverage / social proof
6. Contact / getting started

### Adoption Metrics

- 5-star rating from 1,000+ users (from schema.org metadata)
- Listed as a "ProductivityApplication" on the WhatsApp platform

## UX Design Principles (from the HeySally pattern)

1. **Meet users where they are**: WhatsApp is ubiquitous in Israel; no new app download needed
2. **Conversational over UI**: No buttons, forms, or complex UI -- just natural chat
3. **Automatic intelligence**: Auto-categorization by department reduces user effort
4. **Social/shared experience**: List sharing with family makes it collaborative
5. **Single-platform focus**: Rather than multi-platform, Sally goes deep on WhatsApp

## Relevance to NutriBalance

The HeySally pattern demonstrates how a health/nutrition assistant could work through a chat interface:

- Users could ask "Can I eat this?" via WhatsApp/chat
- Bot responds with confidence scores and recommendations
- Natural language beats form-filling for food queries
- Shared family dietary tracking could follow the list-sharing pattern

---

## Gotchas / Warnings

### Chat SDK

- Currently in **beta** -- APIs may change
- WhatsApp adapter has a 24-hour messaging window limitation
- Cards on WhatsApp are limited to 3 interactive reply buttons
- GitHub and Linear adapters are limited (mentions and reactions only, no DMs)
- This is a SERVER-SIDE bot framework, not a UI component library
- Streaming only works natively on Slack; others use post-then-edit fallback

### HeySally

- Hebrew-only service, limited to Israeli market
- WhatsApp-only -- no web, Telegram, or other platform support
- Limited public documentation in English about the technical implementation

## References

- https://chat-sdk.dev/
- https://chat-sdk.dev/docs
- https://chat-sdk.dev/docs/usage
- https://chat-sdk.dev/docs/posting-messages
- https://chat-sdk.dev/docs/cards
- https://github.com/vercel/chat
- https://vercel.com/blog/chat-sdk-brings-agents-to-your-users
- https://vercel.com/changelog/chat-sdk
- https://www.heysally.co.il/
- https://gkigroup.com/6-israeli-chatbots-you-should-message/

---

Web research complete.
