/**
 * AI provider constants shared between frontend and backend.
 * This file must NOT import any server-only modules (db, prisma, etc.)
 */

export type AIProvider =
  | "anthropic"
  | "openai"
  | "google"
  | "mistral"
  | "groq"
  | "openrouter"
  | "ollama";

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  ollamaUrl: string;
}

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-3-5-haiku-20241022",
  openai: "gpt-4o-mini",
  google: "gemini-1.5-flash",
  mistral: "mistral-small-latest",
  groq: "llama-3.1-8b-instant",
  openrouter: "anthropic/claude-3.5-haiku",
  ollama: "llama3.2",
};

export const PROVIDER_META: Record<
  AIProvider,
  { label: string; color: string; keyUrl?: string; needsKey: boolean; description: string }
> = {
  anthropic: {
    label: "Anthropic",
    color: "#D4764E",
    keyUrl: "https://console.anthropic.com/settings/keys",
    needsKey: true,
    description: "Claude 3.5 — best reasoning & summarization",
  },
  openai: {
    label: "OpenAI",
    color: "#10A37F",
    keyUrl: "https://platform.openai.com/api-keys",
    needsKey: true,
    description: "GPT-4o — widest ecosystem compatibility",
  },
  google: {
    label: "Google Gemini",
    color: "#4285F4",
    keyUrl: "https://aistudio.google.com/app/apikey",
    needsKey: true,
    description: "Gemini 1.5 — large context window, fast",
  },
  mistral: {
    label: "Mistral",
    color: "#FF6F3C",
    keyUrl: "https://console.mistral.ai/api-keys",
    needsKey: true,
    description: "European provider, strong open-weight models",
  },
  groq: {
    label: "Groq",
    color: "#F55036",
    keyUrl: "https://console.groq.com/keys",
    needsKey: true,
    description: "Lightning fast inference, generous free tier",
  },
  openrouter: {
    label: "OpenRouter",
    color: "#6366F1",
    keyUrl: "https://openrouter.ai/keys",
    needsKey: true,
    description: "Access 200+ models with one key",
  },
  ollama: {
    label: "Ollama (local)",
    color: "#888",
    needsKey: false,
    description: "Fully offline — runs models on your own machine",
  },
};

export const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  anthropic: [
    "claude-3-5-haiku-20241022",
    "claude-3-5-sonnet-20241022",
    "claude-opus-4-5",
  ],
  openai: ["gpt-4o-mini", "gpt-4o", "o1-mini"],
  google: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"],
  mistral: ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"],
  groq: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
  openrouter: [
    "anthropic/claude-3.5-haiku",
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
    "google/gemini-flash-1.5",
    "meta-llama/llama-3.1-8b-instruct",
  ],
  ollama: ["llama3.2", "llama3.1", "mistral", "phi3", "qwen2.5"],
};
