import type { Procedures } from "@/api";

// On Adaptive: apiClient routes each call to /api/<methodName> via the platform.
// Locally: same paths work because Vite proxies /api/* to the local Hono server,
// and our local Hono handler accepts POST /api/* via typed-rpc handleRpc.
import { apiClient } from "@adaptive-ai/sdk/client";

export const client = apiClient<Procedures>();

export type inferRPCOutputType<K extends keyof Procedures> =
  Procedures[K] extends (...args: never[]) => Promise<infer R> ? R : never;
