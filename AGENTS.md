# AGENTS.md — LocalVault

This file is the entry point for any LLM agent (Claude Code, Cursor, Copilot, etc.) opening this repo. Read this first.

## What this is

LocalVault is a local-first AI knowledge base. Users add text content (articles, notes, tweets, transcripts). The AI pipeline summarizes, tags, and connects them. Everything runs locally — SQLite database, configurable AI provider, optional file watcher.

## Key facts for agents

- **Language:** TypeScript throughout (strict mode)
- **Frontend:** React 19 + Vite + Tailwind CSS v4 + TanStack Query
- **Backend:** Hono (Node.js) + Prisma ORM + SQLite
- **AI:** Vercel AI SDK — see `src/api/ai.ts` for the adapter
- **Port:** frontend on `$PORT`, backend on `$PORT+1`, proxied via Vite

## Where things live

| What | Where |
|---|---|
| All API endpoints | `src/api/procedures.ts` |
| Background jobs (AI processing) | `src/api/queue.ts` |
| AI provider adapter | `src/api/ai.ts` |
| Database schema | `schema.prisma` |
| UI components | `src/components/` |
| Environment config | `.env` (copy from `.env.example`) |

## How to run

```bash
npm install
cp .env.example .env   # set AI_PROVIDER + API key
npm run dev
```

## How to add a new API endpoint

1. Add an exported `async function` to `src/api/procedures.ts`
2. It's automatically available on the frontend via `client.yourFunction()`
3. Auth: call `await requireUserId()` at the top of any protected procedure

## How AI processing works

`queue.processArticle()` in `src/api/queue.ts` calls `generateJSON()` from `src/api/ai.ts`. The AI adapter reads provider config from the `AISettings` DB table (set by the user in the Settings UI), falling back to env vars. To change providers: update `AISettings` or set `AI_PROVIDER` in `.env`.

## Database

Run `npm run dev:migrations` to apply pending migrations. The schema is in `schema.prisma`. Prisma client is at `src/api/db.ts`.

## Memory

`.memory/` contains additional context files accumulated across sessions. Check there for notes about past decisions, known bugs, and user preferences.

## Current state

See the bottom of this file or `.memory/` for session notes.
