import crypto from "node:crypto";
import { headers } from "next/headers";
import { env } from "@/lib/env";

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function encryptionKey() {
  const configured = env().CONTACT_ENCRYPTION_KEY;
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CONTACT_ENCRYPTION_KEY no está configurada.");
    }
    return crypto.createHash("sha256").update("cfh-development-only-key").digest();
  }
  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) {
    throw new Error("CONTACT_ENCRYPTION_KEY debe contener 32 bytes en base64.");
  }
  return key;
}

export function encryptPrivateValue(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptPrivateValue(value: string) {
  const [ivPart, tagPart, dataPart] = value.split(".");
  if (!ivPart || !tagPart || !dataPart) throw new Error("Dato cifrado inválido.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

export async function requestContext() {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for");
  return {
    ipAddress: forwarded?.split(",")[0]?.trim() ?? list.get("x-real-ip") ?? undefined,
    userAgent: list.get("user-agent") ?? undefined
  };
}

export async function assertSameOrigin() {
  const list = await headers();
  const origin = list.get("origin");
  if (!origin) return;
  const expected = new URL(env().APP_URL).origin;
  if (origin === expected) return;
  if (process.env.NODE_ENV !== "production") {
    try {
      const originUrl = new URL(origin);
      if (["localhost", "127.0.0.1", "192.168.100.143"].includes(originUrl.hostname) || originUrl.hostname.startsWith("192.168.")) {
        return;
      }
    } catch {}
  }
  throw new Error("FORBIDDEN");
}
