import { z } from 'zod';

const booleanish = z
  .union([z.literal('true'), z.literal('false')])
  .transform((v) => v === 'true');

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'test', 'production']).default('local'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Core
  DATABASE_URL: z.url({ error: 'DATABASE_URL must be a valid postgres connection string' }),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters (openssl rand -base64 32)'),
  BETTER_AUTH_URL: z.url(),
  NEXT_PUBLIC_APP_URL: z.url(),

  // File storage
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  STORAGE_S3_ENDPOINT: z.url().optional(),
  STORAGE_S3_REGION: z.string().optional(),
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_S3_FORCE_PATH_STYLE: booleanish.optional(),

  // Email
  EMAIL_DRIVER: z.enum(['console', 'resend', 'smtp']).default('console'),
  EMAIL_FROM: z.email().optional(),
  ADMIN_NOTIFICATION_EMAIL: z.email().optional(),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: booleanish.optional(),

  // PayFast
  PAYFAST_MODE: z.enum(['sandbox', 'live']).default('sandbox'),
  PAYFAST_MERCHANT_ID: z.string().optional(),
  PAYFAST_MERCHANT_KEY: z.string().optional(),
  PAYFAST_PASSPHRASE: z.string().optional(),

  // Meta tracking
  META_PIXEL_ID: z.string().optional(),
  META_CAPI_ACCESS_TOKEN: z.string().optional(),
  META_TEST_EVENT_CODE: z.string().optional(),

  // Outbound automation
  ZAPIER_WEBHOOK_URL: z.url().optional(),

  // Build metadata (injected at Docker build time, not user-provided)
  APP_VERSION: z.string().optional(),
  GIT_COMMIT: z.string().optional(),
  GIT_TAG: z.string().optional(),
  BUILD_TIME: z.string().optional(),
});

type Env = z.infer<typeof baseSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
}

function requireInProduction(env: Env, issues: string[]) {
  // APP_ENV, not NODE_ENV: `next build` always forces NODE_ENV=production even for
  // local/test builds, so APP_ENV is the real signal for "this is a live deployment."
  if (env.APP_ENV !== 'production') return;

  if (env.STORAGE_DRIVER === 's3') {
    for (const key of [
      'STORAGE_S3_ENDPOINT',
      'STORAGE_S3_REGION',
      'STORAGE_S3_BUCKET',
      'STORAGE_S3_ACCESS_KEY_ID',
      'STORAGE_S3_SECRET_ACCESS_KEY',
    ] as const) {
      if (!env[key]) issues.push(`${key} is required when STORAGE_DRIVER=s3`);
    }
  }

  if (env.EMAIL_DRIVER === 'resend' && !env.RESEND_API_KEY) {
    issues.push('RESEND_API_KEY is required when EMAIL_DRIVER=resend');
  }
  if (env.EMAIL_DRIVER === 'smtp') {
    for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'] as const) {
      if (!env[key]) issues.push(`${key} is required when EMAIL_DRIVER=smtp`);
    }
  }
  if (env.EMAIL_DRIVER !== 'console' && !env.EMAIL_FROM) {
    issues.push('EMAIL_FROM is required when EMAIL_DRIVER is not "console"');
  }

  if (!env.PAYFAST_MERCHANT_ID || !env.PAYFAST_MERCHANT_KEY) {
    issues.push('PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY are required in production');
  }
}

let cached: Env | undefined;

/** Treats unset env vars consistently: an empty string (common in .env templates left blank) is "not set". */
function cleanEnv(raw: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = value === '' ? undefined : value;
  }
  return out;
}

/** Parses and validates process.env once, caching the result. Throws with a readable message on failure. */
export function getEnv(): Env {
  if (cached) return cached;

  const parsed = baseSchema.safeParse(cleanEnv(process.env));
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration:\n${formatIssues(parsed.error)}\n\nCheck your .env file against .env.example.`,
    );
  }

  const productionIssues: string[] = [];
  requireInProduction(parsed.data, productionIssues);
  if (productionIssues.length > 0) {
    throw new Error(
      `Invalid production environment configuration:\n${productionIssues.map((i) => `  - ${i}`).join('\n')}`,
    );
  }

  cached = parsed.data;
  return cached;
}
