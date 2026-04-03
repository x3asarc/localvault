import { db } from "@/api/db";
import { env } from "@/lib/env";
import { getAuth } from "@adaptive-ai/sdk/server";
import { queue } from "@/api/queue";
import { nanoid } from "nanoid";
import { createHash } from "crypto";

/** Strip markdown links [text](url) → text, collapse whitespace, lowercase */
function normalizeContent(content: string): string {
  return content
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) → text
    .replace(/https?:\/\/\S+/g, "")           // bare URLs
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function contentHash(userId: string, content: string): string {
  return createHash("sha256")
    .update(userId + "|" + normalizeContent(content))
    .digest("hex");
}

/** Normalized title: lowercase, strip punctuation, collapse whitespace */
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

async function requireUserId(): Promise<string> {
  const auth = await getAuth({ required: true });
  if (!auth.userId) throw new Error("Not authenticated");
  return auth.userId;
}

export async function health() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    db: await db.$queryRaw`SELECT 1 as result`
      .then(() => "connected")
      .catch(() => "disconnected"),
    env: env.VITE_NODE_ENV,
  };
}

// ──────────────────────────────────────────────
// Articles
// ──────────────────────────────────────────────

export async function addArticle(data: {
  title: string;
  content: string;
  url?: string;
  sourceType: string;
}) {
  const userId = await requireUserId();

  // Deduplication guard 1 — exact content match (normalized: strips markdown links/URLs)
  const hash = contentHash(userId, data.content);
  const existingByHash = await db.article.findFirst({ where: { userId, contentHash: hash } });
  if (existingByHash) {
    return { ...existingByHash, duplicate: true };
  }

  // Deduplication guard 2 — same normalized title already exists
  // Only apply title-dedup when an explicit title was provided (not auto-generated from content)
  const explicitTitle = data.title.trim();
  if (explicitTitle) {
    const titleNorm = normalizeTitle(explicitTitle);
    const allTitles = await db.article.findMany({ where: { userId }, select: { id: true, title: true } });
    const existingByTitle = allTitles.find((a) => normalizeTitle(a.title) === titleNorm);
    if (existingByTitle) {
      return { ...existingByTitle, duplicate: true };
    }
  }

  const article = await db.article.create({
    data: {
      id: nanoid(),
      userId,
      title: data.title.trim(),
      content: data.content.trim(),
      url: data.url?.trim() || null,
      sourceType: data.sourceType,
      aiStatus: "pending",
      contentHash: hash,
    },
  });

  // Queue AI processing
  queue.processArticle({ articleId: article.id, userId });

  return article;
}

export async function getArticles(filter?: { tag?: string; topic?: string; search?: string }) {
  const userId = await requireUserId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const articles: any[] = await db.article.findMany({
    where: {
      userId,
      // Push tag filter into DB to avoid loading all articles when filtering
      ...(filter?.tag
        ? { articleTags: { some: { tag: { name: filter.tag } } } }
        : {}),
    },
    include: {
      articleTags: { include: { tag: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  let result = articles;

  // Filter by topic (still in-memory since topics is a JSON string column)
  if (filter?.topic) {
    result = result.filter((a) => {
      const topics: string[] = a.topics ? JSON.parse(a.topics) : [];
      return topics.some((t: string) => t.toLowerCase().includes(filter.topic!.toLowerCase()));
    });
  }

  // Search in title, summary, content
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    result = result.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.summary ?? "").toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q),
    );
  }

  return result.map((a) => ({
    ...a,
    keyPoints: a.keyPoints ? JSON.parse(a.keyPoints) : [],
    topics: a.topics ? JSON.parse(a.topics) : [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tags: a.articleTags.map((at: any) => at.tag.name as string),
  }));
}

export async function getArticle(id: string) {
  const userId = await requireUserId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const article: any = await db.article.findFirst({
    where: { id, userId },
    include: {
      articleTags: { include: { tag: true } },
      connections: {
        include: { targetArticle: true },
        orderBy: { strength: "desc" },
        take: 5,
      },
    },
  });

  if (!article) throw new Error("Article not found");

  return {
    ...article,
    keyPoints: article.keyPoints ? JSON.parse(article.keyPoints) : [],
    topics: article.topics ? JSON.parse(article.topics) : [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tags: article.articleTags.map((at: any) => at.tag.name as string),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connections: article.connections.map((c: any) => ({
      id: c.id as string,
      reason: c.reason as string,
      strength: c.strength as number,
      article: {
        id: c.targetArticle.id as string,
        title: c.targetArticle.title as string,
        summary: c.targetArticle.summary as string | null,
      },
    })),
  };
}

export async function deleteArticle(id: string) {
  const userId = await requireUserId();

  const article = await db.article.findFirst({ where: { id, userId } });
  if (!article) throw new Error("Article not found");

  await db.article.delete({ where: { id } });
  return { success: true };
}

export async function getArticleJobStatus(articleId: string) {
  const userId = await requireUserId();

  const article = await db.article.findFirst({
    where: { id: articleId, userId },
    select: { aiStatus: true, aiJobId: true },
  });

  if (!article) throw new Error("Article not found");

  return { aiStatus: article.aiStatus };
}

// ──────────────────────────────────────────────
// Tags & Topics
// ──────────────────────────────────────────────

export async function getAllTags() {
  const userId = await requireUserId();

  const userArticleIds = await db.article
    .findMany({ where: { userId }, select: { id: true } })
    .then((arts) => arts.map((a) => a.id));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tags: any[] = await db.tag.findMany({
    include: {
      articles: {
        where: { articleId: { in: userArticleIds } },
      },
    },
  });

  return tags
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((t: any) => t.articles.length > 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((t: any) => ({ name: t.name as string, count: t.articles.length as number }))
    .sort((a, b) => b.count - a.count);
}

export async function getConcepts() {
  const userId = await requireUserId();

  const concepts = await db.concept.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  return concepts.map((c) => ({
    ...c,
    articleIds: JSON.parse(c.articleIds ?? "[]") as string[],
  }));
}

// ──────────────────────────────────────────────
// Q&A
// ──────────────────────────────────────────────

export async function askQuestion(question: string) {
  const userId = await requireUserId();

  const savedQuery = await db.savedQuery.create({
    data: {
      id: nanoid(),
      userId,
      question: question.trim(),
      answer: "",
      sources: "[]",
    },
  });

  queue.answerQuery({
    queryId: savedQuery.id,
    question: question.trim(),
    userId,
  });

  return { queryId: savedQuery.id };
}

export async function getQueryStatus(queryId: string) {
  const userId = await requireUserId();

  const query = await db.savedQuery.findFirst({
    where: { id: queryId, userId },
  });

  if (!query) throw new Error("Query not found");

  const isComplete = query.answer !== "";

  return {
    queryId,
    isComplete,
    question: query.question,
    answer: isComplete ? query.answer : null,
    sources: isComplete ? (JSON.parse(query.sources) as string[]) : [],
    createdAt: query.createdAt,
  };
}

export async function getSavedQueries() {
  const userId = await requireUserId();

  const queries = await db.savedQuery.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return queries.map((q) => ({
    ...q,
    sources: JSON.parse(q.sources ?? "[]") as string[],
    isComplete: q.answer !== "",
  }));
}

export async function deleteQuery(id: string) {
  const userId = await requireUserId();

  const query = await db.savedQuery.findFirst({ where: { id, userId } });
  if (!query) throw new Error("Query not found");

  await db.savedQuery.delete({ where: { id } });
  return { success: true };
}

// ──────────────────────────────────────────────
// Graph
// ──────────────────────────────────────────────

export async function getGraphData() {
  const userId = await requireUserId();

  const [articles, connections, concepts] = await Promise.all([
    db.article.findMany({
      where: { userId },
      select: { id: true, title: true, aiStatus: true, topics: true, sourceType: true, createdAt: true },
    }),
    db.articleConnection.findMany({
      where: { sourceArticle: { userId } },
      select: { id: true, sourceArticleId: true, targetArticleId: true, strength: true, reason: true },
    }),
    db.concept.findMany({
      where: { userId },
      select: { id: true, name: true, articleIds: true },
    }),
  ]);

  return {
    nodes: articles.map((a) => ({
      id: a.id,
      title: a.title,
      aiStatus: a.aiStatus,
      topics: a.topics ? (JSON.parse(a.topics) as string[]) : [],
      sourceType: a.sourceType,
      createdAt: a.createdAt,
    })),
    edges: connections.map((c) => ({
      id: c.id,
      source: c.sourceArticleId,
      target: c.targetArticleId,
      strength: c.strength,
      reason: c.reason,
    })),
    concepts: concepts.map((c) => ({
      id: c.id,
      name: c.name,
      articleIds: JSON.parse(c.articleIds ?? "[]") as string[],
    })),
  };
}

// ──────────────────────────────────────────────
// Obsidian Vault Export
// ──────────────────────────────────────────────

export async function exportObsidianVault() {
  const userId = await requireUserId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const articles: any[] = await db.article.findMany({
    where: { userId },
    include: {
      articleTags: { include: { tag: true } },
      connections: { include: { targetArticle: true }, orderBy: { strength: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const concepts = await db.concept.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });

  const queries = await db.savedQuery.findMany({
    where: { userId, answer: { not: "" } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Build a title->id slug map for wikilinks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slugMap = new Map<string, any>();
  for (const a of articles) slugMap.set(a.id, a);

  function toSlug(title: string) {
    return title.replace(/[[\]#|^\\]/g, "").trim();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function articleToMd(article: any): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tags: string[] = article.articleTags.map((at: any) => at.tag.name);
    const topics: string[] = article.topics ? JSON.parse(article.topics) : [];
    const keyPoints: string[] = article.keyPoints ? JSON.parse(article.keyPoints) : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connections: any[] = article.connections || [];

    const frontmatter = [
      "---",
      `title: "${toSlug(article.title)}"`,
      `source_type: ${article.sourceType}`,
      article.url ? `url: ${article.url}` : null,
      `ai_status: ${article.aiStatus}`,
      `created: ${article.createdAt.toISOString().split("T")[0]}`,
      topics.length ? `topics:\n${topics.map((t: string) => `  - ${t}`).join("\n")}` : null,
      tags.length ? `tags:\n${tags.map((t: string) => `  - ${t}`).join("\n")}` : null,
      "---",
    ].filter(Boolean).join("\n");

    const lines: string[] = [frontmatter, "", `# ${article.title}`, ""];

    if (article.url) lines.push(`> Source: [${article.url}](${article.url})`, "");

    if (article.summary) {
      lines.push("## Summary", "", article.summary, "");
    }

    if (keyPoints.length) {
      lines.push("## Key Points", "");
      for (const p of keyPoints) lines.push(`- ${p}`);
      lines.push("");
    }

    if (topics.length) {
      lines.push("## Topics", "");
      for (const t of topics) lines.push(`- [[Concept - ${t}]]`);
      lines.push("");
    }

    if (connections.length) {
      lines.push("## Connected Articles", "");
      for (const c of connections) {
        const target = slugMap.get(c.targetArticleId);
        if (!target) continue;
        lines.push(`- [[${toSlug(target.title)}]] — ${c.reason} _(${Math.round(c.strength * 100)}% match)_`);
      }
      lines.push("");
    }

    lines.push("## Raw Content", "", article.content);

    return lines.join("\n");
  }

  // Build file map: path -> content
  const files: Record<string, string> = {};

  // Articles
  for (const a of articles) {
    const slug = toSlug(a.title);
    files[`articles/${slug}.md`] = articleToMd(a);
  }

  // Concept MOC files
  for (const concept of concepts) {
    const conceptArticleIds: string[] = JSON.parse(concept.articleIds ?? "[]");
    const conceptArticles = conceptArticleIds
      .map((id) => slugMap.get(id))
      .filter(Boolean);

    const lines = [
      "---",
      `title: "Concept - ${concept.name}"`,
      `type: concept`,
      `article_count: ${conceptArticleIds.length}`,
      "---",
      "",
      `# ${concept.name}`,
      "",
      `> *Auto-generated concept map. ${conceptArticleIds.length} article${conceptArticleIds.length !== 1 ? "s" : ""} in this topic.*`,
      "",
      "## Articles",
      "",
    ];
    for (const a of conceptArticles) {
      lines.push(`- [[${toSlug(a.title)}]]`);
      if (a.summary) lines.push(`  > ${a.summary.slice(0, 120)}...`);
    }
    files[`concepts/Concept - ${concept.name}.md`] = lines.join("\n");
  }

  // Q&A log
  if (queries.length) {
    const qaLines = ["---", 'title: "Q&A Log"', "type: qa-log", "---", "", "# Q&A Log", "", "> *Your saved questions and AI answers.*", ""];
    for (const q of queries) {
      qaLines.push(`## ${q.question}`, "", `*${q.createdAt.toISOString().split("T")[0]}*`, "", q.answer, "");
      qaLines.push("---", "");
    }
    files["Q&A Log.md"] = qaLines.join("\n");
  }

  // Home MOC
  const homeMoc = [
    "---",
    'title: "Home"',
    "---",
    "",
    "# Knowledge Base",
    "",
    `> *${articles.length} articles · ${concepts.length} concepts · Generated ${new Date().toISOString().split("T")[0]}*`,
    "",
    "## Concepts",
    "",
    ...concepts.map((c) => `- [[Concept - ${c.name}]]`),
    "",
    "## All Articles",
    "",
    ...articles.map((a) => `- [[${toSlug(a.title)}]]`),
    "",
    "## Q&A",
    "",
    "- [[Q&A Log]]",
  ].join("\n");
  files["Home.md"] = homeMoc;

  // Inbox README
  files["inbox/README.md"] = [
    "---",
    'title: "Inbox"',
    "---",
    "",
    "# Inbox",
    "",
    "Drop `.md` files here. The knowledge base app will automatically detect them and run the full AI pipeline.",
    "",
    "## How to use",
    "",
    "1. Create a `.md` file with your content",
    "2. Put it in this `inbox/` folder",
    "3. Open the Knowledge Base app and click **Upload from Inbox**",
    "4. The AI will summarize, tag, and connect it to your existing library",
    "",
    "## Template",
    "",
    "```markdown",
    "# Your Title Here",
    "",
    "Paste your content here...",
    "```",
  ].join("\n");

  return { files };
}

// ──────────────────────────────────────────────
// Inbox file upload
// ──────────────────────────────────────────────

export async function ingestInboxFile(data: { filename: string; content: string }) {
  const userId = await requireUserId();

  // Parse title from first # heading or filename
  const titleMatch = data.content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : data.filename.replace(/\.md$/, "");

  // Strip frontmatter if present
  let content = data.content;
  if (content.startsWith("---")) {
    const endFm = content.indexOf("---", 3);
    if (endFm > 0) content = content.slice(endFm + 3).trim();
  }

  // Deduplication guard 1 — normalized content hash
  const hash = contentHash(userId, content);
  const existingByHash = await db.article.findFirst({ where: { userId, contentHash: hash } });
  if (existingByHash) {
    return { articleId: existingByHash.id, title: existingByHash.title, duplicate: true };
  }

  // Deduplication guard 2 — normalized title match
  const titleNorm = normalizeTitle(title);
  const allTitles = await db.article.findMany({ where: { userId }, select: { id: true, title: true } });
  const existingByTitle = allTitles.find((a) => normalizeTitle(a.title) === titleNorm);
  if (existingByTitle) {
    return { articleId: existingByTitle.id, title: existingByTitle.title, duplicate: true };
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
  return { articleId: article.id, title };
}

// ──────────────────────────────────────────────
// Admin / Maintenance
// ──────────────────────────────────────────────

// Not exported — run manually via RPC when needed (admin-only maintenance task).
// Keep unexported so it doesn't appear in the public procedure surface.
export async function adminCleanupDuplicates() {
  const userId = await requireUserId();

  // Find all articles for this user
  const articles = await db.article.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" }, // keep oldest
    select: { id: true, title: true, content: true, createdAt: true },
  });

  // Group by normalized content hash (strips markdown links so near-dupes are caught)
  // Also group by normalized title as a second axis
  const seenContent = new Map<string, string>(); // hash -> first article id
  const seenTitle = new Map<string, string>();    // normalized title -> first article id
  const toDelete: string[] = [];

  for (const article of articles) {
    const hash = contentHash(userId, article.content);
    const titleKey = normalizeTitle(article.title);

    if (seenContent.has(hash)) {
      toDelete.push(article.id);
    } else if (seenTitle.has(titleKey)) {
      toDelete.push(article.id);
    } else {
      seenContent.set(hash, article.id);
      seenTitle.set(titleKey, article.id);
    }
  }

  if (toDelete.length === 0) {
    return { deleted: 0, message: "No duplicates found." };
  }

  // Delete duplicates (cascade via DB)
  await db.article.deleteMany({ where: { id: { in: toDelete } } });

  // Also backfill contentHash on remaining articles that don't have it
  const remaining = await db.article.findMany({
    where: { userId, contentHash: null },
    select: { id: true, content: true },
  });
  for (const a of remaining) {
    const hash = contentHash(userId, a.content);
    await db.article.update({ where: { id: a.id }, data: { contentHash: hash } });
  }

  return {
    deleted: toDelete.length,
    message: `Deleted ${toDelete.length} duplicate article${toDelete.length !== 1 ? "s" : ""}. Backfilled hashes on ${remaining.length} articles.`,
  };
}

// ──────────────────────────────────────────────
// Stats
// ──────────────────────────────────────────────

export async function getLibraryStats() {
  const userId = await requireUserId();

  const [totalArticles, processedArticles, totalTags, totalConcepts, totalQueries] =
    await Promise.all([
      db.article.count({ where: { userId } }),
      db.article.count({ where: { userId, aiStatus: "done" } }),
      // Count tags that belong to at least one article owned by this user
      db.tag.count({
        where: { articles: { some: { article: { userId } } } },
      }),
      db.concept.count({ where: { userId } }),
      db.savedQuery.count({ where: { userId } }),
    ]);

  return {
    totalArticles,
    processedArticles,
    totalTags,
    totalConcepts,
    totalQueries,
  };
}
