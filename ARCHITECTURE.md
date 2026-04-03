# Architecture

LocalVault is a full-stack TypeScript app split into a Vite/React frontend and a Hono/Prisma backend, both served from a single `npm run dev`.

## Directory structure

```
localvault/
├── src/
│   ├── App.tsx                  # Root: tab routing + bottom nav
│   ├── main.tsx                 # React entry point
│   ├── index.css                # Tailwind v4 + dark mode tokens
│   │
│   ├── api/
│   │   ├── server.ts            # Hono server + file watcher daemon
│   │   ├── procedures.ts        # All RPC endpoints (typed, auto-exported)
│   │   ├── queue.ts             # Background job handlers (processArticle, answerQuery)
│   │   ├── ai.ts                # Universal AI adapter (Vercel AI SDK, all providers)
│   │   ├── db.ts                # Prisma client singleton
│   │   └── index.ts             # Re-exports procedures + jobs
│   │
│   ├── components/
│   │   ├── Library.tsx          # Article list with search + tag filter
│   │   ├── ArticleCard.tsx      # Single article row
│   │   ├── ArticleDetail.tsx    # Full article view with AI analysis + connections
│   │   ├── AddContent.tsx       # Add new content form
│   │   ├── QueryInterface.tsx   # Ask questions against the knowledge base
│   │   ├── ConceptsView.tsx     # Browse AI-generated concept clusters
│   │   ├── GraphView.tsx        # D3 force graph of articles + concepts
│   │   ├── ExportInbox.tsx      # Export vault / import from inbox
│   │   └── SettingsPage.tsx     # AI provider + API key configuration
│   │
│   └── lib/
│       ├── client.ts            # Typed RPC client (typed-rpc)
│       ├── env.ts               # Zod-validated environment variables
│       └── utils.ts             # cn() and other helpers
│
├── schema.prisma                # Database schema
├── migrations/                  # Prisma migration history
├── .env.example                 # Template for local setup
├── .memory/                     # Agent memory (LLM context files)
│   └── architecture.md          # This file, summarised for agents
├── AGENTS.md                    # Entry point for LLM agents
├── ARCHITECTURE.md              # This file
└── README.md                    # Setup + usage guide
```

## Data flow

```
User adds content
      │
      ▼
addArticle() procedure
      │  saves to SQLite with aiStatus="pending"
      ▼
queue.processArticle() job  ◄── runs async in background
      │
      ├── generateJSON() → ai.ts → Vercel AI SDK → provider of choice
      │     • summary, keyPoints, topics, tags
      │
      ├── generateJSON() → find connections to existing articles
      │
      └── writes back to SQLite (aiStatus="done")
            │
            ▼
      Frontend polls / refetches → UI updates
```

## AI adapter (`src/api/ai.ts`)

All AI calls go through a single `generateJSON(prompt, schema, userId)` function. It:

1. Loads `AISettings` from the DB for the given user
2. Falls back to `process.env.AI_PROVIDER` + `process.env.*_API_KEY` if no DB settings
3. Constructs the right Vercel AI SDK model instance
4. Calls `generateObject()` with `output: "no-schema"` for dynamic schemas

This means swapping providers requires only changing a setting — no code changes.

## File watcher

When `VAULT_PATH` is set in `.env`, `server.ts` starts a `chokidar` watcher on `$VAULT_PATH/inbox/`. New `.md` files trigger the same pipeline as the UI's "Add Content" flow. Processed files are moved to `articles-raw/` to prevent re-ingestion.

## Auth

On Adaptive (hosted demo): uses `@adaptive-ai/sdk/server`'s `getAuth()` — each user has an isolated namespace.

Locally: the `requireUserId()` function still calls `getAuth()`. For local single-user mode you can stub this by setting a fixed `LOCAL_USER_ID` in `.env` (see `.env.example`). The file watcher uses `db.user.findFirst()` as a fallback.

## Database

SQLite via Prisma + `better-sqlite3`. Schema lives in `schema.prisma`. Run migrations with `npm run dev:migrations`. Key models:

| Model | Purpose |
|---|---|
| `Article` | The core unit — raw content + AI analysis |
| `ArticleConnection` | Directed graph edge between two articles |
| `Concept` | AI-generated topic cluster (many articles) |
| `Tag` | Keyword tag (many-to-many with articles) |
| `SavedQuery` | Q&A history |
| `AISettings` | Per-user provider + API key config |
