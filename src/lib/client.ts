import type { Procedures } from "@/api";
import { rpcClient } from "typed-rpc";

// In local mode: typed-rpc client → Vite proxy → local Hono server at PORT+1
// On Adaptive: typed-rpc client → platform routing (same /api/rpc path)
// Using a relative URL means Vite's proxy handles forwarding automatically.
export const client = rpcClient<Procedures>("/api/rpc");

export type inferRPCOutputType<K extends keyof Procedures> =
  Procedures[K] extends (...args: never[]) => Promise<infer R> ? R : never;
