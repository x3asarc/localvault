import { db } from "@/api/db";
import { env } from "@/lib/env";
import { getAuth } from "@adaptive-ai/sdk/server";
import { queue } from "@/api/queue";
import { nanoid } from "nanoid";

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

  const article = await db.article.create({
    data: {
      id: nanoid(),
      userId,
      title: data.title.trim(),
      content: data.content.trim(),
      url: data.url?.trim() || null,
      sourceType: data.sourceType,
      aiStatus: "pending",
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
    where: { userId },
    include: {
      articleTags: { include: { tag: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  let result = articles;

  // Filter by tag
  if (filter?.tag) {
    result = result.filter((a) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      a.articleTags.some((at: any) => at.tag.name === filter.tag),
    );
  }

  // Filter by topic
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
// Stats
// ──────────────────────────────────────────────

export async function getLibraryStats() {
  const userId = await requireUserId();

  const userArticleIds = await db.article
    .findMany({ where: { userId }, select: { id: true } })
    .then((arts) => arts.map((a) => a.id));

  const [totalArticles, processedArticles, totalTags, totalConcepts, totalQueries] =
    await Promise.all([
      db.article.count({ where: { userId } }),
      db.article.count({ where: { userId, aiStatus: "done" } }),
      db.tag.count({
        where: { articles: { some: { articleId: { in: userArticleIds } } } },
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
