#!/usr/bin/env node
// Cross-platform migration runner.
// Loads .env (if present) then runs: prisma migrate dev --name auto
import { config } from "dotenv";
import { spawnSync } from "child_process";
import { existsSync } from "fs";

// Platform uses .env.development; locally users have .env
const envFile = existsSync(".env.development")
  ? ".env.development"
  : existsSync(".env")
  ? ".env"
  : null;
if (envFile) config({ path: envFile });

// Fallback defaults so Prisma can resolve the DB URL even without a .env
process.env.DB_FILE_NAME ??= "file:./localvault.db";

const result = spawnSync(
  "npx",
  ["prisma", "migrate", "dev", "--name", "auto"],
  { stdio: "inherit", shell: true }
);

process.exit(result.status ?? 1);
