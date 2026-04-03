# LocalVault

A local-first, AI-powered personal knowledge base. Add articles, notes, tweets, and transcripts — the AI summarizes, tags, and connects them into a searchable graph. Runs entirely on your machine. Your data, your keys, your vault.

---

## Quick start

```bash
git clone https://github.com/x3asarc/localvault
cd localvault
cp .env.example .env        # fill in your API key
npm install
npm run dev                 # opens http://localhost:3000
```

## AI providers

Set your preferred provider in `.env` or via the **AI Settings** tab in the app:

| Provider | Env var | Get key |
|---|---|---|
| Anthropic (default) | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| OpenAI | `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/api-keys) |
| Google Gemini | `GOOGLE_API_KEY` | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| Mistral | `MISTRAL_API_KEY` | [console.mistral.ai](https://console.mistral.ai/api-keys) |
| Groq | `GROQ_API_KEY` | [console.groq.com](https://console.groq.com/keys) |
| OpenRouter | `OPENROUTER_API_KEY` | [openrouter.ai](https://openrouter.ai/keys) |
| Ollama (offline) | *(no key needed)* | [ollama.ai](https://ollama.ai) |

Set `AI_PROVIDER=anthropic` (or whichever you choose) in `.env`.

## File watcher (local auto-ingest)

Set `VAULT_PATH=/path/to/your/vault` in `.env`. Drop any `.md` file into `vault/inbox/` and the app will automatically pick it up, run the full AI pipeline, and move it to `articles-raw/`. No UI interaction needed.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4
- **Backend:** Hono + Prisma + SQLite (better-sqlite3)
- **AI:** Vercel AI SDK — Anthropic, OpenAI, Google, Mistral, Groq, OpenRouter, Ollama
- **Graph:** D3.js force simulation

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a full breakdown.

## License

MIT — use it, fork it, build on it.
