import crypto from "crypto";

export interface GenerateSignedDownloadUrlOptions {
  fileId: string;
  userId: string;
  expiresInSeconds?: number;
  baseUrl?: string;
  secret?: string;
}

export interface SignedDownloadUrlResult {
  downloadUrl: string;
  token: string;
  expires: number;
  expiresAt: Date;
}

export interface VerifySignedTokenOptions {
  fileId: string;
  userId?: string | null;
  token?: string | null;
  expires?: number | string | null;
  secret?: string;
}

export interface TokenVerificationResult {
  valid: boolean;
  error?: string;
  code?: string;
  reason?: string;
  status: number;
  payload?: {
    fileId: string;
    userId: string;
    exp: number;
  };
}

export function getSigningSecret(): string {
  return (
    process.env.STORAGE_SIGNING_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "cfh-s3-qa-test-secret-key-2026"
  );
}

/**
 * Computes an HMAC-SHA256 signature for a file, user, and expiration timestamp.
 */
export function computeSignature(
  fileId: string,
  userId: string,
  exp: number,
  secretKey?: string
): string {
  const secret = secretKey || getSigningSecret();
  return crypto
    .createHmac("sha256", secret)
    .update(`${fileId}:${userId}:${exp}`)
    .digest("hex");
}

/**
 * Generates a short-lived cryptographically signed download URL.
 * Default expiration is 15 minutes (900 seconds).
 */
export function generateSignedDownloadUrl({
  fileId,
  userId,
  expiresInSeconds = 900,
  baseUrl = "",
  secret,
}: GenerateSignedDownloadUrlOptions): SignedDownloadUrlResult {
  const nowUnix = Math.floor(Date.now() / 1000);
  const exp = nowUnix + expiresInSeconds;
  const signature = computeSignature(fileId, userId, exp, secret);

  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const token = signature;
  const expiresAt = new Date(exp * 1000);
  const downloadUrl = `${cleanBaseUrl}/api/course-files/${encodeURIComponent(
    fileId
  )}?token=${token}&expires=${exp}&userId=${encodeURIComponent(userId)}`;

  return {
    downloadUrl,
    token,
    expires: exp,
    expiresAt,
  };
}

/**
 * Verifies a signed download token against the file ID and expiration.
 */
export function verifySignedDownloadToken({
  fileId,
  userId,
  token,
  expires,
  secret,
}: VerifySignedTokenOptions): TokenVerificationResult {
  // If token is missing
  if (!token) {
    return {
      valid: false,
      error: "Token de descarga requerido.",
      code: "MISSING_DOWNLOAD_TOKEN",
      reason: "MISSING_PARAMETERS",
      status: 401,
    };
  }

  const effectiveSecret = secret || getSigningSecret();

  // Mode 1: If expires is passed directly or in query
  if (expires !== undefined && expires !== null) {
    if (!userId) {
      return {
        valid: false,
        error: "Parámetros de usuario requeridos.",
        code: "MISSING_PARAMETERS",
        reason: "MISSING_PARAMETERS",
        status: 401,
      };
    }

    const exp = typeof expires === "number" ? expires : parseInt(expires, 10);
    const nowUnix = Math.floor(Date.now() / 1000);

    if (isNaN(exp) || nowUnix > exp) {
      return {
        valid: false,
        error: "El token de descarga ha expirado.",
        code: "TOKEN_EXPIRED",
        reason: "TOKEN_EXPIRED",
        status: 403,
      };
    }

    const expectedSig = computeSignature(fileId, userId, exp, effectiveSecret);

    try {
      const tokenBuf = Buffer.from(token, "hex");
      const expectedBuf = Buffer.from(expectedSig, "hex");

      if (
        tokenBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(tokenBuf, expectedBuf)
      ) {
        return {
          valid: false,
          error: "Firma digital del token inválida.",
          code: "INVALID_SIGNATURE",
          reason: "INVALID_SIGNATURE",
          status: 403,
        };
      }

      return {
        valid: true,
        status: 200,
        payload: { fileId, userId, exp },
      };
    } catch {
      return {
        valid: false,
        error: "Formato de firma inválido.",
        code: "INVALID_SIGNATURE_FORMAT",
        reason: "INVALID_SIGNATURE",
        status: 403,
      };
    }
  }

  // Mode 2: Base64url packed token JSON { f, u, e, s }
  try {
    let parsed: { f?: string; u?: string; e?: number; s?: string } | null = null;
    try {
      const decoded = Buffer.from(token, "base64url").toString("utf8");
      parsed = JSON.parse(decoded);
    } catch {
      return {
        valid: false,
        error: "Parámetros de token incompletos o formato no válido.",
        code: "MISSING_PARAMETERS",
        reason: "MISSING_PARAMETERS",
        status: 401,
      };
    }

    if (!parsed?.f || !parsed?.u || !parsed?.e || !parsed?.s) {
      return {
        valid: false,
        error: "Token incompleto.",
        code: "MALFORMED_TOKEN",
        reason: "MISSING_PARAMETERS",
        status: 401,
      };
    }

    const { f: tokenFileId, u: tokenUserId, e: exp, s: sig } = parsed;

    if (fileId !== tokenFileId) {
      return {
        valid: false,
        error: "El token no corresponde al archivo solicitado.",
        code: "RESOURCE_MISMATCH",
        reason: "RESOURCE_MISMATCH",
        status: 403,
      };
    }

    if (userId && tokenUserId !== userId) {
      return {
        valid: false,
        error: "El token no pertenece al usuario autenticado.",
        code: "USER_MISMATCH",
        reason: "INVALID_SIGNATURE",
        status: 403,
      };
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    if (nowUnix > exp) {
      return {
        valid: false,
        error: "El token de descarga ha expirado.",
        code: "TOKEN_EXPIRED",
        reason: "TOKEN_EXPIRED",
        status: 403,
      };
    }

    const expectedSig = computeSignature(tokenFileId, tokenUserId, exp, effectiveSecret);
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expectedSig, "hex");

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return {
        valid: false,
        error: "Firma digital inválida.",
        code: "INVALID_SIGNATURE",
        reason: "INVALID_SIGNATURE",
        status: 403,
      };
    }

    return {
      valid: true,
      status: 200,
      payload: { fileId: tokenFileId, userId: tokenUserId, exp },
    };
  } catch {
    return {
      valid: false,
      error: "Error de verificación de token.",
      code: "VERIFICATION_ERROR",
      reason: "INVALID_SIGNATURE",
      status: 403,
    };
  }
}

/**
 * Checks whether AWS S3 storage is configured in the environment.
 */
export function isS3Configured(): boolean {
  return Boolean(
    (process.env.AWS_S3_BUCKET || process.env.S3_BUCKET) &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
}

/**
 * Storage Abstraction
 * 
 * TODO: Cambiar la implementación a Cloudflare R2 con URLs firmadas 
 * antes del lanzamiento con alumnos de pago para proteger los PDFs y archivos privados.
 */
export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Error subiendo el archivo");
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error);
  }

  return data.url;
}

export function getFileUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  return pathOrUrl;
}
