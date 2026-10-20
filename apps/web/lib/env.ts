import { z } from "zod";

const optionalUrl = z.string().url().or(z.literal("")).optional();

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_COOKIE_NAME: z.string().default("cfh_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  CONTACT_ENCRYPTION_KEY: z.string().optional(),
  PAYMENTS_MODE: z.enum(["mock", "stripe"]).default("mock"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CONNECT_RETURN_URL: optionalUrl,
  STRIPE_CONNECT_REFRESH_URL: optionalUrl,
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  STRIPE_ELITE_PRICE_ID: z.string().optional(),
  AI_MODE: z.enum(["mock", "openai"]).default("mock"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  OPENAI_REASONING_EFFORT: z.enum(["minimal", "low", "medium", "high"]).default("low"),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(300).max(8000).default(1800),
  VIDEO_PROVIDER: z.enum(["mock", "twilio"]).default("mock"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_API_KEY_SID: z.string().optional(),
  TWILIO_API_KEY_SECRET: z.string().optional(),
  MAIL_MODE: z.enum(["console", "smtp"]).default("smtp"),
  SMTP_HOST: z.string().optional().default("mail.coachingfromhome.com.mx"),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_SECURE: z.union([z.boolean(), z.string()]).default(true).transform((val) => val === true || val === "true" || val === "1"),
  SMTP_AUTH_REQUIRED: z.union([z.boolean(), z.string()]).default(true).transform((val) => val === true || val === "true" || val === "1"),
  SMTP_USER: z.string().optional().default("contact@coachingfromhome.com.mx"),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('"Coaching From Home" <contact@coachingfromhome.com.mx>'),
  SMTP_HELP_USER: z.string().optional().default("help@coachingfromhome.com.mx"),
  SMTP_HELP_PASSWORD: z.string().optional(),
  SMTP_HELP_PASS: z.string().optional(),
  SMTP_HELP_FROM: z.string().default('"Coaching From Home Soporte" <help@coachingfromhome.com.mx>'),
  MAILPIT_WEB_URL: optionalUrl,
  CRON_SECRET: z.string().optional(),
  PUSHER_APP_ID: z.string().optional(),
  NEXT_PUBLIC_PUSHER_KEY: z.string().optional(),
  PUSHER_SECRET: z.string().optional(),
  NEXT_PUBLIC_PUSHER_CLUSTER: z.string().default("mt1"),
});

let cached: z.infer<typeof schema> | undefined;

export function env() {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export function requireIntegration(keys: string[], label: string) {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) throw new Error(`${label} no está configurado. Faltan: ${missing.join(", ")}`);
}
