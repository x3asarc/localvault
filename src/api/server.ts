import { Hono } from "hono";
import { deserialize, serialize } from "superjson";
import { serve } from "@hono/node-server";
import { env } from "@/lib/env";
import path from "path";
import fs from "fs";

const transcoder = { serialize, deserialize };

// ── Adaptive platform bootstrap (no-op in local mode) ────────────────────────
// When running on the Adaptive platform, initializeServerEnvironment sets up
// realtime, queue, and error tracking services. Locally these services don't
// exist, so we catch any failure and continue — the app works without them.
try {
  const { initializeServerEnvironment } = await import("@adaptive-ai/sdk/server");
  initializeServerEnvironment({
    baseUrl: env.VITE_BASE_URL,
    realtimeDomain: env.VITE_REALTIME_DOMAIN,
    guestServicesUrl: env.GUEST_SERVICES_URL,
    environment: env.VITE_NODE_ENV,
    apiKey: env.API_KEY,
    queueDbPath: env.QUEUE_DB_FILE_NAME,
    errorsDbPath: env.ERRORS_DB_FILE_NAME,
  });
} catch {
  // Not running on Adaptive — local mode, safe to ignore
}

// honoMiddleware is only needed on Adaptive (handles RPC routing).
// In local mode we skip it; the Hono app still serves health/RPC via typed-rpc.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let honoMiddleware: ((opts: any) => any) | null = null;
try {
  const sdk = await import("@adaptive-ai/sdk/server");
  honoMiddleware = sdk.honoMiddleware;
} catch {
  // Not on Adaptive — local mode
}

// Import these after initializing the environment
const { procedures, jobs } = await import("@/api");

const app = new Hono();
if (honoMiddleware) {
  // Adaptive platform: full middleware (auth, queue status, logger, RPC)
  app.use(honoMiddleware({ procedures, jobs, transcoder }));
} else {
  // Local mode: minimal JSON-RPC handler via typed-rpc
  const { handleRpc } = await import("typed-rpc/server");
  app.post("/api/*", async (c) => {
    const body = await c.req.json();
    const result = await handleRpc(body, procedures, { transcoder });
    return c.json(result);
  });
}

serve({
  fetch: app.fetch,
  port: Number(env.PORT) + 1,
});

// ── File watcher for local inbox/ folder ─────────────────────────────────────
// Only active in local mode (when VAULT_PATH is set in .env).
// Watches vault/inbox/ for new .md files and auto-ingests them.
const vaultPath = process.env.VAULT_PATH;

if (vaultPath) {
  const inboxPath = path.join(vaultPath, "inbox");

  // Ensure inbox dir exists
  fs.mkdirSync(inboxPath, { recursive: true });

  try {
    const chokidar = await import("chokidar");
    const { db } = await import("@/api/db");
    const { nanoid } = await import("nanoid");
    const { createHash } = await import("crypto");
    const { queue } = await import("@/api/queue");

    // Helper: find any user in the DB (local mode has exactly one)
    async function getLocalUserId(): Promise<string | null> {
      const user = await db.user.findFirst();
      return user?.id ?? null;
    }

    function normalizeContent(content: string): string {
      return content
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    function contentHash(userId: string, content: string): string {
      return createHash("sha256")
        .update(userId + "|" + normalizeContent(content))
        .digest("hex");
    }

    const watcher = chokidar.watch(inboxPath, {
      ignored: /(^|[/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,    // don't re-process files already there
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });

    watcher.on("add", async (filePath: string) => {
      if (!filePath.endsWith(".md")) return;

      console.log(`[watcher] New inbox file: ${filePath}`);

      try {
        const rawContent = fs.readFileSync(filePath, "utf-8");
        const filename = path.basename(filePath);

        // Parse title from first # heading or filename
        const titleMatch = rawContent.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : filename.replace(/\.md$/, "");

        // Strip frontmatter
        let content = rawContent;
        if (content.startsWith("---")) {
          const endFm = content.indexOf("---", 3);
          if (endFm > 0) content = content.slice(endFm + 3).trim();
        }

        const userId = await getLocalUserId();
        if (!userId) {
          console.warn("[watcher] No user found in DB — skipping file.");
          return;
        }

        // Dedup by content hash
        const hash = contentHash(userId, content);
        const existing = await db.article.findFirst({ where: { userId, contentHash: hash } });
        if (existing) {
          console.log(`[watcher] Skipping duplicate: ${filename}`);
          return;
        }

        const article = await db.article.create({
          data: {
            id: nanoid(),
            userId,
            title,
            content,
            sourceType: "note",
            aiStatus: "pending",
            contentHash: hash,
          },
        });

        queue.processArticle({ articleId: article.id, userId });
        console.log(`[watcher] Ingested and queued: ${filename} → ${article.id}`);

        // Move processed file to articles/ so inbox stays clean
        const processedDir = path.join(vaultPath, "articles-raw");
        fs.mkdirSync(processedDir, { recursive: true });
        fs.renameSync(filePath, path.join(processedDir, filename));
      } catch (err) {
        console.error(`[watcher] Failed to ingest ${filePath}:`, err);
      }
    });

    console.log(`[watcher] Watching inbox: ${inboxPath}`);
  } catch (err) {
    console.warn("[watcher] Could not start file watcher:", err);
  }
}
