/**
 * Universal AI adapter — wraps Vercel AI SDK to support all providers.
 *
 * On Adaptive (hosted): falls back to mcp.promptAgent() if no AISettings configured.
 * Locally: reads provider + API key from AISettings in the DB (set via the Settings page).
 *
 * Usage:
 *   const result = await generateJSON<MyType>(prompt, jsonSchema, userId);
 *   const text   = await generateText(prompt, userId);
 */

import { generateObject, generateText as aiGenerateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider";
import { db } from "@/api/db";
import { z } from "zod";

// Re-export shared types and constants from the frontend-safe module
export type { AIProvider, AIConfig } from "@/lib/ai-providers";
export { DEFAULT_MODELS, PROVIDER_META, PROVIDER_MODELS } from "@/lib/ai-providers";
import type { AIProvider, AIConfig } from "@/lib/ai-providers";
import { DEFAULT_MODELS } from "@/lib/ai-providers";

/** Resolve the AI model instance for a given config */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveModel(config: AIConfig): any {
  const { provider, model, apiKey, ollamaUrl } = config;
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
    case "mistral":
      return createMistral({ apiKey })(model);
    case "groq":
      return createGroq({ apiKey })(model);
    case "openrouter":
      return createOpenRouter({ apiKey })(model);
    case "ollama":
      return createOllama({ baseURL: `${ollamaUrl}/api` })(model);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

/** Load AI config for a user from DB. Falls back to env vars for hosted mode. */
async function loadConfig(userId: string): Promise<AIConfig> {
  const settings = await db.aISettings.findUnique({ where: { userId } });

  if (settings && settings.apiKey) {
    return {
      provider: settings.provider as AIProvider,
      model: settings.model,
      apiKey: settings.apiKey,
      ollamaUrl: settings.ollamaUrl,
    };
  }

  // Fall back to environment variables (local .env or Adaptive platform env)
  const envProvider = (process.env.AI_PROVIDER as AIProvider) || "anthropic";
  const envKey =
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.MISTRAL_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    "";
  const envModel = process.env.AI_MODEL || DEFAULT_MODELS[envProvider];

  return {
    provider: envProvider,
    model: envModel,
    apiKey: envKey,
    ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
  };
}

/**
 * Generate structured JSON output from the AI.
 * Mirrors the old mcp.promptAgent({ outputJsonSchema }) pattern.
 */
export async function generateJSON<T>(
  prompt: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsonSchema: Record<string, any>,
  userId: string,
): Promise<T> {
  const config = await loadConfig(userId);
  const model = resolveModel(config);

  // Convert JSON schema to a zod passthrough schema for Vercel AI SDK
  // We use z.any() + parse manually since the schemas are dynamic
  const { object } = await generateObject({
    model,
    prompt,
    schema: z.any(),
    output: "no-schema",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return object as T;
}

/**
 * Generate plain text from the AI.
 */
export async function generateTextResponse(
  prompt: string,
  userId: string,
): Promise<string> {
  const config = await loadConfig(userId);
  const model = resolveModel(config);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { text } = await aiGenerateText({ model, prompt } as any);
    return text;
}

/**
 * Quick connectivity test — sends a minimal prompt and returns true if it works.
 */
export async function testConnection(config: AIConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const model = resolveModel(config);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await aiGenerateText({ model, prompt: "Reply with only the word: ok" } as any);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
