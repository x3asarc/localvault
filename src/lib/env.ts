import { z } from "zod";

const publicSchema = z.object({
  VITE_APP_ID: z.string().default("local"),
  VITE_BASE_URL: z.string().url().default("http://localhost:47291"),
  VITE_ROOT_URL: z.string().url().default("http://localhost:47291"),
  VITE_REALTIME_DOMAIN: z.string().default("localhost"),
  VITE_BOX_ID: z.string().default("local"),
  VITE_NODE_ENV: z.enum(["development", "production"]).default("development"),
});

const serverSchema = z.object({
  PORT: z.string().default("47291"),
  API_KEY: z.string().default("local-dev-key"),
  DB_FILE_NAME: z.string().default("file:./localvault.db"),
  GUEST_SERVICES_URL: z.string().url().default("http://localhost:47291"),
  QUEUE_DB_FILE_NAME: z.string().default("./localvault-queue.db"),
  ERRORS_DB_FILE_NAME: z.string().default("./localvault-errors.db"),
});

const schema = serverSchema.extend(publicSchema.shape);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore import.meta.env type issues are not correctly inferred
const metaEnv = import.meta.env;

const isServer = metaEnv?.SSR || typeof process !== "undefined";

const schemaToCheck = isServer ? schema : publicSchema;

const parsed = schemaToCheck.safeParse(isServer ? process?.env : metaEnv);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.format());
  throw new Error("Invalid environment variables");
}

const proxy = new Proxy(parsed.data, {
  get(target, prop) {
    if (isServer || String(prop).startsWith("VITE_")) {
      return target[prop as keyof typeof target];
    }

    throw new Error(
      `Attempted to access server-side environment variable "${String(prop)}" from the client-side.`,
    );
  },
});

export const env = proxy as z.infer<typeof schema>;
