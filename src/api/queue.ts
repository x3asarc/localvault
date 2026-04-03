import {
  getQueue,
  type Job,
  type QueueHandlers,
} from "@adaptive-ai/sdk/server";
import { db } from "@/api/db";
import { generateJSON } from "@/api/ai";

// Process a newly added article: summarize, extract key points, topics, tags, and find connections
export const jobs = {
  processArticle: async (payload: { articleId: string; userId: string }, job: Job) => {
    console.log(`[queue] processArticle job ${job.id} for article ${payload.articleId}`);

    // Mark as processing
    await db.article.update({
      where: { id: payload.articleId },
      data: { aiStatus: "processing", aiJobId: job.id },
    });

    try {
      const article = await db.article.findUnique({
        where: { id: payload.articleId },
      });

      if (!article) throw new Error("Article not found");

      // Step 1: Summarize and extract structure
      const analysis = await generateJSON<{
        summary: string;
        keyPoints: string[];
        topics: string[];
        tags: string[];
      }>(
        `Analyze this piece of content and extract key information.

Title: ${article.title}
Source type: ${article.sourceType}
Content:
${article.content.slice(0, 8000)}

Return a JSON object with:
- summary: 2-4 sentence summary
- keyPoints: array of 5-8 most important points
- topics: array of 3-6 topic/theme labels (e.g. "machine learning", "pricing strategy")
- tags: array of 5-10 specific keyword tags (lowercase, single or two words)`,
        {
          type: "object",
          properties: {
            summary: { type: "string" },
            keyPoints: { type: "array", items: { type: "string" } },
            topics: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["summary", "keyPoints", "topics", "tags"],
        },
        payload.userId,
      );

      const { summary, keyPoints, topics, tags } = analysis;

      // Step 2: Find connections with existing articles
      const existingArticles = await db.article.findMany({
        where: {
          userId: payload.userId,
          id: { not: payload.articleId },
          aiStatus: "done",
        },
        select: { id: true, title: true, summary: true, topics: true },
        take: 30,
      });

      type ConnectionResult = { targetId: string; reason: string; strength: number };
      let connections: ConnectionResult[] = [];

      if (existingArticles.length > 0) {
        const existingList = existingArticles
          .map(
            (a) =>
              `ID: ${a.id} | Title: ${a.title} | Topics: ${a.topics || ""} | Summary: ${(a.summary || "").slice(0, 200)}`,
          )
          .join("\n");

        const connResult = await generateJSON<{ connections: ConnectionResult[] }>(
          `Given this new article:
Title: ${article.title}
Topics: ${topics.join(", ")}
Summary: ${summary}

And these existing articles in the knowledge base:
${existingList}

Find the most meaningful conceptual connections. Return JSON with a "connections" array (up to 5) where each item has:
- targetId: the article ID
- reason: 1-2 sentence explanation
- strength: 0-1 float indicating connection strength`,
          {
            type: "object",
            properties: {
              connections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    targetId: { type: "string" },
                    reason: { type: "string" },
                    strength: { type: "number" },
                  },
                  required: ["targetId", "reason", "strength"],
                },
              },
            },
            required: ["connections"],
          },
          payload.userId,
        );

        connections = (connResult.connections || []).slice(0, 5);
      }

      // Step 3: Update concept wiki
      const allTopics = [...new Set(topics)];
      for (const topicName of allTopics) {
        const existingConcept = await db.concept.findUnique({
          where: { userId_name: { userId: payload.userId, name: topicName } },
        });

        if (existingConcept) {
          const currentIds: string[] = JSON.parse(existingConcept.articleIds || "[]");
          if (!currentIds.includes(payload.articleId)) {
            await db.concept.update({
              where: { userId_name: { userId: payload.userId, name: topicName } },
              data: { articleIds: JSON.stringify([...currentIds, payload.articleId]) },
            });
          }
        } else {
          await db.concept.create({
            data: {
              userId: payload.userId,
              name: topicName,
              description: `Articles related to ${topicName}`,
              articleIds: JSON.stringify([payload.articleId]),
            },
          });
        }
      }

      // Save results
      await db.article.update({
        where: { id: payload.articleId },
        data: {
          summary,
          keyPoints: JSON.stringify(keyPoints),
          topics: JSON.stringify(topics),
          aiStatus: "done",
        },
      });

      // Upsert tags
      for (const tagName of tags) {
        const normalizedTag = tagName.toLowerCase().trim();
        if (!normalizedTag) continue;
        const tag = await db.tag.upsert({
          where: { name: normalizedTag },
          create: { name: normalizedTag },
          update: {},
        });
        await db.articleTag.upsert({
          where: { articleId_tagId: { articleId: payload.articleId, tagId: tag.id } },
          create: { articleId: payload.articleId, tagId: tag.id },
          update: {},
        });
      }

      // Save connections
      for (const conn of connections) {
        if (!conn.targetId || conn.targetId === payload.articleId) continue;
        try {
          await db.articleConnection.upsert({
            where: {
              sourceArticleId_targetArticleId: {
                sourceArticleId: payload.articleId,
                targetArticleId: conn.targetId,
              },
            },
            create: {
              sourceArticleId: payload.articleId,
              targetArticleId: conn.targetId,
              reason: conn.reason,
              strength: conn.strength,
            },
            update: { reason: conn.reason, strength: conn.strength },
          });
        } catch {
          // ignore duplicate connection errors
        }
      }

      console.log(`[queue] processArticle job ${job.id} completed for article ${payload.articleId}`);
    } catch (error) {
      console.error(`[queue] processArticle job ${job.id} failed:`, error);
      await db.article.update({
        where: { id: payload.articleId },
        data: { aiStatus: "failed" },
      });
      throw error;
    }
  },

  answerQuery: async (
    payload: { queryId: string; question: string; userId: string },
    job: Job,
  ) => {
    console.log(`[queue] answerQuery job ${job.id} for question: ${payload.question.slice(0, 50)}`);

    try {
      const articles = await db.article.findMany({
        where: { userId: payload.userId, aiStatus: "done" },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      if (articles.length === 0) {
        await db.savedQuery.update({
          where: { id: payload.queryId },
          data: {
            answer: "No articles have been processed yet. Add some content to your knowledge base first.",
            sources: "[]",
          },
        });
        return;
      }

      const context = articles
        .map(
          (a) =>
            `[ID: ${a.id}] "${a.title}" (${a.sourceType}) — Topics: ${a.topics || "N/A"}\nSummary: ${a.summary || "No summary"}\nKey Points: ${a.keyPoints || "[]"}`,
        )
        .join("\n\n---\n\n");

      const result = await generateJSON<{
        answer: string;
        sourceIds: string[];
        confidence: string;
      }>(
        `You are answering a question using a personal knowledge base. Use only the information from the articles below.

KNOWLEDGE BASE (${articles.length} articles):
${context}

QUESTION: ${payload.question}

Return JSON with:
- answer: complete answer to the question, citing which articles you drew from
- sourceIds: array of article IDs used
- confidence: "high" | "medium" | "low"`,
        {
          type: "object",
          properties: {
            answer: { type: "string" },
            sourceIds: { type: "array", items: { type: "string" } },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["answer", "sourceIds", "confidence"],
        },
        payload.userId,
      );

      const { answer, sourceIds, confidence } = result;

      await db.savedQuery.update({
        where: { id: payload.queryId },
        data: {
          answer: `[${confidence.toUpperCase()} CONFIDENCE]\n\n${answer}`,
          sources: JSON.stringify(sourceIds || []),
        },
      });

      console.log(`[queue] answerQuery job ${job.id} completed`);
    } catch (error) {
      console.error(`[queue] answerQuery job ${job.id} failed:`, error);
      await db.savedQuery.update({
        where: { id: payload.queryId },
        data: { answer: "Failed to generate answer. Please try again.", sources: "[]" },
      });
      throw error;
    }
  },
} satisfies QueueHandlers;

export const queue = getQueue<typeof jobs>();
