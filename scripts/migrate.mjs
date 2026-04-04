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

// On the platform (.env.development exists), use `migrate deploy` which is
// non-interactive and never prompts to reset the DB.
// Locally, use `migrate dev` which creates new migration files as needed.
const isProduction = existsSync(".env.development");
const migrateArgs = isProduction
  ? ["prisma", "migrate", "deploy"]
  : ["prisma", "migrate", "dev", "--name", "auto"];

const result = spawnSync("npx", migrateArgs, { stdio: "inherit", shell: true });

process.exit(result.status ?? 1);
