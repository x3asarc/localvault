#!/usr/bin/env node
/**
 * Cross-platform env loader + process spawner.
 * Loads .env.development (platform mode) or .env (local mode), then
 * spawns the command passed as arguments.
 *
 * Usage: node scripts/with-env.mjs <command> [args...]
 */
import { config } from "dotenv";
import { spawnSync } from "child_process";
import { existsSync } from "fs";

// Platform sets .env.development; locally users have .env
const envFile = existsSync(".env.development")
  ? ".env.development"
  : existsSync(".env")
  ? ".env"
  : null;

if (envFile) {
  config({ path: envFile });
} 

// Set sensible defaults so the app can start even without any env file
process.env.PORT ??= "3000";
process.env.DB_FILE_NAME ??= "file:./localvault.db";
process.env.QUEUE_DB_FILE_NAME ??= "./localvault-queue.db";
process.env.ERRORS_DB_FILE_NAME ??= "./localvault-errors.db";
process.env.VITE_APP_ID ??= "local";
process.env.VITE_BASE_URL ??= `http://localhost:${process.env.PORT}`;
process.env.VITE_ROOT_URL ??= `http://localhost:${process.env.PORT}`;
process.env.VITE_NODE_ENV ??= "development";
process.env.VITE_REALTIME_DOMAIN ??= "localhost";
process.env.VITE_BOX_ID ??= "local";
process.env.API_KEY ??= "local-dev-key";
process.env.GUEST_SERVICES_URL ??= `http://localhost:${process.env.PORT}`;

const [, , ...args] = process.argv;
if (!args.length) {
  console.error("Usage: node scripts/with-env.mjs <command> [args...]");
  process.exit(1);
}

const result = spawnSync(args[0], args.slice(1), {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
