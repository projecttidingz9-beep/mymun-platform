import { z } from "zod";

/** Strip whitespace/CRLF and surrounding quotes (common when pasting into hosting dashboards). */
function normalizeAdminEmailInput(val: unknown): unknown {
  if (typeof val !== "string") return val;
  let s = val.replace(/\r/g, "").trim();
  while (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** During `next build`, Prisma/API routes may load before real `.env` is applied — fill placeholders only then. */
function applyBuildTimeEnvPlaceholders() {
  const isNextBuild = process.env.npm_lifecycle_event === "build";
  if (!isNextBuild) return;
  if (!process.env.AUTH_SESSION_SECRET?.trim()) {
    process.env.AUTH_SESSION_SECRET = "__build_placeholder_AUTH_SESSION_SECRET_min_len__";
  }
  if (!process.env.PASS_QR_SECRET?.trim()) {
    process.env.PASS_QR_SECRET = "__build_placeholder_PASS_QR_SECRET_min_len____";
  }
  if (!process.env.DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = "postgresql://build:build@127.0.0.1:5432/tidingz_build_placeholder";
  }
  if (!process.env.DIRECT_URL?.trim()) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
  if (!process.env.ADMIN_EMAIL?.trim()) {
    process.env.ADMIN_EMAIL = "admin@example.com";
  }
}

applyBuildTimeEnvPlaceholders();

if (typeof process.env.ADMIN_EMAIL === "string") {
  const n = normalizeAdminEmailInput(process.env.ADMIN_EMAIL);
  if (typeof n === "string") process.env.ADMIN_EMAIL = n;
}

const optionalNonEmpty = z
  .string()
  .optional()
  .transform((s) => {
    const t = s?.trim();
    return t ? t : undefined;
  });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: optionalNonEmpty,
  AUTH_SESSION_SECRET: z.string().min(1),
  PASS_QR_SECRET: z.string().min(1),
  /** Platform super-admin — must match session email for `/admin` and `/api/admin/*`. */
  ADMIN_EMAIL: z.preprocess(normalizeAdminEmailInput, z.string().email()),
  GOOGLE_CLIENT_ID: optionalNonEmpty,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: optionalNonEmpty,
  RESEND_API_KEY: optionalNonEmpty,
  RESEND_FROM_EMAIL: optionalNonEmpty,
  NEXT_PUBLIC_APP_URL: optionalNonEmpty,
  PAYMENTS_MODE: z.enum(["free", "manual"]).optional(),
  SENTRY_DSN: optionalNonEmpty,
  /** Same project DSN as `SENTRY_DSN` when you want browser error reporting (public). */
  NEXT_PUBLIC_SENTRY_DSN: optionalNonEmpty,
  /** Supabase Auth (OAuth); optional — enable Google/GitHub etc. in Supabase dashboard. */
  NEXT_PUBLIC_SUPABASE_URL: optionalNonEmpty,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalNonEmpty,
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
});

export type ParsedEnv = z.infer<typeof envSchema> & {
  /** Pooled runtime URL */
  databaseUrl: string;
  /** Direct URL for migrations / scripts (falls back to DATABASE_URL) */
  directDatabaseUrl: string;
};

let cached: ParsedEnv | null = null;

function loadEnv(): ParsedEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment variables: ${JSON.stringify(flat)}`);
  }
  const e = parsed.data;
  const databaseUrl = e.DATABASE_URL.trim();
  const directDatabaseUrl = (e.DIRECT_URL ?? databaseUrl).trim();
  return {
    ...e,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: e.DIRECT_URL,
    databaseUrl,
    directDatabaseUrl,
  };
}

export function getParsedEnv(): ParsedEnv {
  if (!cached) {
    cached = loadEnv();
  }
  return cached;
}

/** Clears env cache (tests only). */
export function resetEnvCacheForTests() {
  cached = null;
}

export const env = {
  databaseUrl: () => getParsedEnv().databaseUrl,
  directDatabaseUrl: () => getParsedEnv().directDatabaseUrl,
  authSessionSecret: () => getParsedEnv().AUTH_SESSION_SECRET,
  passQrSecret: () => getParsedEnv().PASS_QR_SECRET,
  adminEmail: () => getParsedEnv().ADMIN_EMAIL.trim().toLowerCase(),
  googleClientId: () => getParsedEnv().GOOGLE_CLIENT_ID,
  nextPublicGoogleClientId: () => getParsedEnv().NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  resendApiKey: () => getParsedEnv().RESEND_API_KEY,
  resendFromEmail: () => getParsedEnv().RESEND_FROM_EMAIL,
  sentryDsn: () => getParsedEnv().SENTRY_DSN,
};
