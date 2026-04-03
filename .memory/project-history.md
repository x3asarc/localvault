# Project History

## Origin

Built on Adaptive AI (adaptive.ai) as a hosted knowledge base app. Subsequently open-sourced as LocalVault with local-first architecture.

## Key design decisions

- **SQLite over PostgreSQL** — zero infrastructure, runs anywhere, copy the `.db` file to back up everything
- **Vercel AI SDK** — single adapter for 7 providers; swapping AI requires only changing a setting
- **No auth in local mode** — single-user assumption locally; `requireUserId()` falls back gracefully
- **File watcher via chokidar** — `VAULT_PATH` env var activates it; inbox/ → auto-ingest → articles-raw/
- **Content deduplication** — sha256 of normalized content (strips markdown links/URLs) + title match
- **D3 force graph** — article nodes + optional concept overlay layer; zoom/pan + mobile-friendly controls

## Known issues / quirks

- Prisma shadow DB migration issue with SQLite duplicate columns — resolved by direct `db push`
- `generateObject` with `output: "no-schema"` used because schemas are dynamic at runtime
- The Adaptive-hosted demo uses `mcp.promptAgent()` fallback; local uses direct provider calls

## Completed features

- Library (search, tag filter, article detail, delete)
- Add content (5 source types, dedup, AI queue)
- Q&A interface (async, history, delete)
- Concepts view (clickable, drill-down)
- Graph view (D3, concept layer, mobile controls)
- Export to Obsidian vault (ZIP)
- Inbox upload (batch ingest from .md files)
- AI Settings page (7 providers, key entry, test connection)
- File watcher daemon (local mode)
- Agent context files (AGENTS.md, README.md, ARCHITECTURE.md)
