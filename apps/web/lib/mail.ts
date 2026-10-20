import nodemailer from "nodemailer";
import { env, requireIntegration } from "@/lib/env";

export type MailAccount = "contact" | "help";

export function getTransporter(account: MailAccount = "contact") {
  const config = env();
  requireIntegration(["SMTP_HOST"], "Correo SMTP");

  const isHelp = account === "help";
  const user = isHelp
    ? (process.env.SMTP_HELP_USER || config.SMTP_HELP_USER || "help@coachingfromhome.com.mx")
    : (process.env.SMTP_USER || config.SMTP_USER || "contact@coachingfromhome.com.mx");

  let pass = isHelp
    ? (process.env.SMTP_HELP_PASSWORD || process.env.SMTP_HELP_PASS || config.SMTP_HELP_PASSWORD || config.SMTP_HELP_PASS || "6-+VF?GZaX.k2$cv")
    : (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || config.SMTP_PASSWORD || config.SMTP_PASS || "cyWWsimz3Z3riD6");

  // Safeguard: Next.js / dotenv-expand strips '$cv' from password if unescaped
  if (isHelp && (pass === "6-+VF?GZaX.k2" || pass.startsWith("6-+VF?GZaX.k2\\"))) {
    pass = "6-+VF?GZaX.k2$cv";
  }

  const host = process.env.SMTP_HOST || config.SMTP_HOST || "mail.coachingfromhome.com.mx";
  const port = parseInt(process.env.SMTP_PORT || String(config.SMTP_PORT || 465), 10);
  const secure = process.env.SMTP_SECURE === "true" || config.SMTP_SECURE || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
}

function transporter(account: MailAccount = "contact") {
  return getTransporter(account);
}

export async function verifyMailConnection(account: MailAccount = "contact") {
  if (env().MAIL_MODE === "console") return { ok: true, mode: "console" as const };
  await transporter(account).verify();
  return { ok: true, mode: "smtp" as const };
}

export interface SendMailInput {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
  account?: MailAccount;
  attachments?: any[];
}

export async function sendMail(input: SendMailInput) {
  if (env().MAIL_MODE === "console") {
    console.info("[CFH MAIL]", { from: input.from || env().SMTP_FROM, ...input });
    return { mode: "console" as const, messageId: "console-mock" };
  }

  const account: MailAccount = input.account || (typeof input.to === "string" && input.to.includes("help") ? "help" : "contact");
  const from = input.from || (account === "help"
    ? (process.env.SMTP_HELP_FROM || env().SMTP_HELP_FROM || '"Coaching From Home Soporte" <help@coachingfromhome.com.mx>')
    : (process.env.SMTP_FROM || env().SMTP_FROM || '"Coaching From Home" <contact@coachingfromhome.com.mx>'));

  const info = await transporter(account).sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo,
    attachments: input.attachments,
  });
  return { mode: "smtp" as const, messageId: info.messageId };
}

export async function sendMailSafely(input: SendMailInput, context = "correo") {
  try {
    const result = await sendMail(input);
    return { ok: true as const, result };
  } catch (error) {
    console.error(`No se pudo enviar ${context}.`, error);
    return { ok: false as const };
  }
}

