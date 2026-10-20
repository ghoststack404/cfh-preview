/**
 * Utilidades de Seguridad y Protección para la Comunidad de Coaching From Home
 * 
 * Previene el fraude, bypass de pagos/contacto y regula la ventana de edición.
 */

import { validateTextToxicity, ToxicityValidationResult } from "./toxicityModeration";

export { validateTextToxicity };
export type { ToxicityValidationResult };

export interface SafetyValidationResult {
  isValid: boolean;
  reason?: string;
  category?: string;
}

// Expresión regular para detectar correos electrónicos
const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/i;

// Expresión regular para enlaces de mensajería externa directa
const MESSAGING_LINKS_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:wa\.me|api\.whatsapp\.com|whatsapp\.com\/send|t\.me|telegram\.me|discord\.gg|instagram\.com\/[a-zA-Z0-9_.]+|facebook\.com\/[a-zA-Z0-9_.]+)/i;

// Expresión regular para plataformas de cobro o pago externo y términos bancarios
const EXTERNAL_PAYMENTS_REGEX = /\b(?:zelle|paypal\.me|paypal\b|venmo|cashapp|banco\s*azteca|bbva\b|santander\b|banamex\b|citibanamex\b|banorte\b|hsbc\b|scotiabank\b|inbursa\b|bancoppel\b|oxxo\s*(?:spin|pay)?|spei\b|cuenta\s*clabe|clabe\s*interbancaria|transferencia\s*(?:directa|bancaria|inmediata)?|deposito\s*(?:a\s*mi\s*cuenta|bancario)?|depósito\s*(?:a\s*mi\s*cuenta|bancario)?|tarjeta\s*de\s*(?:debito|débito|credito|crédito)|numero\s*de\s*cuenta|número\s*de\s*cuenta|cuenta\s*bancaria)\b/i;

// Detección de cuentas bancarias, tarjetas (16 dígitos), CLABE (18 dígitos) o vouchers
function containsBankAccount(text: string): boolean {
  // 1. Detección de CLABE (18 dígitos) o Tarjeta (15-16 dígitos) con o sin separadores
  const sanitizedDigitsOnly = text.replace(/[^\d]/g, "");
  // Si contiene una secuencia continua o casi continua de 15 a 18 dígitos que no sea un timestamp largo
  if (/\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/.test(text)) {
    return true; // Tarjeta de 16 dígitos formateada
  }
  if (/\b\d{18}\b/.test(text) || /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{11}[-.\s]?\d{1}\b/.test(text)) {
    return true; // CLABE interbancaria de 18 dígitos
  }

  // 2. Frases bancarias acompañadas de números
  const bankPhraseWithNumbers = /(?:cuenta|clabe|tarjeta|deposito|depósito|transferencia|banco|spei|cbu|cvu)[\s\w.:#-]{1,25}\b\d{6,18}\b/i;
  if (bankPhraseWithNumbers.test(text)) return true;

  // 3. Coincidencia con palabras clave bancarias estrictas
  if (EXTERNAL_PAYMENTS_REGEX.test(text)) {
    // Si menciona palabras bancarias directas como clabe, cuenta bancaria, zelle, etc.
    return true;
  }

  return false;
}

// Detección de números telefónicos (internacionales, celulares de 10 dígitos o con separadores)
// Ejemplos: +52 55 1234 5678, 5512345678, (55) 1234-5678, 55-1234-5678, 5 5 1 2 3 4 5 6 7 8
function containsPhoneNumber(text: string): boolean {
  // 1. Detección con código de país explícito (+52, +1, +34, etc.)
  const intlPhoneRegex = /(?:\+|00)\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{3,4}/;
  if (intlPhoneRegex.test(text)) return true;

  // 2. Detección de secuencias de 8 a 12 dígitos consecutivos o separados por puntos/guiones/espacios
  const tokens = text.split(/[\s,;:\n\r]+/);
  for (const token of tokens) {
    const onlyDigits = token.replace(/\D/g, "");
    if (onlyDigits.length >= 8 && onlyDigits.length <= 14) {
      if (onlyDigits.length === 4) continue; // Ignorar años como 2024, 2025, 2026
      if (token.includes("-") || token.includes(".") || token.startsWith("044") || token.startsWith("045")) {
        return true;
      }
      if (onlyDigits.length === 10) {
        return true;
      }
    }
  }

  // 3. Detección de números separados por espacios individuales ("5 5 1 2 3 4 5 6 7 8")
  const spacedDigitsMatch = text.match(/(?:\d[\s.-]){7,}\d/);
  if (spacedDigitsMatch) {
    const extracted = spacedDigitsMatch[0].replace(/\D/g, "");
    if (extracted.length >= 8 && extracted.length <= 14) {
      return true;
    }
  }

  // 4. Frases de contacto con celular/teléfono
  const contactPhrasesRegex = /(?:mi\s*(?:cel|celular|tel|telefono|teléfono|whats|whatsapp|wa|wpp|inbox|numero|número)\s*(?:es|:|\s)\s*[\d\s.-]{7,})/i;
  if (contactPhrasesRegex.test(text)) return true;

  return false;
}

/**
 * Valida que el texto no contenga datos de contacto externos ni intentos de cobro o cuentas bancarias fuera de la plataforma.
 */
export function validateCommunitySafety(text: string): SafetyValidationResult {
  if (!text || typeof text !== "string") {
    return { isValid: true };
  }

  // 1. Validar Toxicidad, Groserías, Ofensas, Agravios y Amenazas
  const toxicity = validateTextToxicity(text);
  if (!toxicity.isSafe) {
    return {
      isValid: false,
      reason: toxicity.reason || "Por respeto y seguridad comunitaria, no se tolera lenguaje obsceno, agravios ni expresiones ofensivas.",
      category: toxicity.category,
    };
  }

  // 2. Validar Enlaces de mensajería externa
  if (MESSAGING_LINKS_REGEX.test(text)) {
    return {
      isValid: false,
      reason: "Por tu seguridad, no está permitido compartir enlaces directos a WhatsApp, Telegram u otras redes de mensajería externa. La comunicación debe mantenerse dentro de la plataforma para proteger tu garantía."
    };
  }

  // 2. Validar Números telefónicos
  if (containsPhoneNumber(text)) {
    return {
      isValid: false,
      reason: "Por tu seguridad, no está permitido compartir números de teléfono o celulares en la comunidad (incluyendo publicaciones editadas). Mantén todas las consultas dentro de Coaching From Home."
    };
  }

  // 3. Validar Correos electrónicos externos
  if (EMAIL_REGEX.test(text)) {
    return {
      isValid: false,
      reason: "Por seguridad, no se permite publicar direcciones de correo electrónico personales. Utiliza la mensajería segura de la plataforma."
    };
  }

  // 4. Validar Intentos de pago / cuentas bancarias / transacciones externas
  if (containsBankAccount(text)) {
    return {
      isValid: false,
      reason: "Por protocolo de seguridad y prevención de fraudes, no se permite compartir números de cuenta bancaria, tarjetas, CLABE ni solicitar transferencias fuera de Coaching From Home."
    };
  }

  return { isValid: true };
}

/**
 * Valida si una publicación o comentario aún está dentro de la ventana de edición permitida (15 minutos).
 */
export function canEditPostOrComment(createdAt: Date | string, maxMinutes = 15): { canEdit: boolean; remainingMinutes: number } {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diffMinutes = (now - created) / (1000 * 60);

  if (diffMinutes <= maxMinutes) {
    const remaining = Math.max(0, Math.ceil(maxMinutes - diffMinutes));
    return { canEdit: true, remainingMinutes: remaining };
  }

  return { canEdit: false, remainingMinutes: 0 };
}

// Constantes para tags de metadatos de resolución (cero migraciones de DB)
export const RESOLVED_TAG_PREFIX = "__CFH_RESOLVED__";
export const RESOLVED_COMMENT_PREFIX = "__RESOLVED_COMMENT:";

/**
 * Parsea los tags de un post separando los tags visibles del estado de resolución
 */
export function parseCommunityTags(rawTags: any): { tags: string[]; isResolved: boolean; resolvedCommentId?: string } {
  if (!rawTags) return { tags: [], isResolved: false };

  let list: string[] = [];
  if (Array.isArray(rawTags)) {
    list = rawTags.filter(t => typeof t === "string");
  } else if (typeof rawTags === "string") {
    try {
      const parsed = JSON.parse(rawTags);
      if (Array.isArray(parsed)) list = parsed.filter(t => typeof t === "string");
    } catch {
      list = [rawTags];
    }
  }

  let isResolved = false;
  let resolvedCommentId: string | undefined = undefined;
  const cleanTags: string[] = [];

  for (const tag of list) {
    if (tag === RESOLVED_TAG_PREFIX) {
      isResolved = true;
    } else if (tag.startsWith(RESOLVED_COMMENT_PREFIX)) {
      isResolved = true;
      resolvedCommentId = tag.replace(RESOLVED_COMMENT_PREFIX, "");
    } else if (!tag.startsWith("__")) {
      cleanTags.push(tag);
    }
  }

  return { tags: cleanTags, isResolved, resolvedCommentId };
}

export interface MentionedEntity {
  type: "coach" | "course";
  id: string;
  slug: string;
  name: string;
  avatarUrl?: string;
  headline?: string;
}

export const MENTION_COACH_PREFIX = "__mention_coach:";
export const MENTION_COURSE_PREFIX = "__mention_course:";

export function parseCommunityMentions(rawTags: any): MentionedEntity | null {
  if (!rawTags) return null;
  let list: string[] = [];
  if (Array.isArray(rawTags)) {
    list = rawTags.filter((t) => typeof t === "string");
  } else if (typeof rawTags === "string") {
    try {
      const parsed = JSON.parse(rawTags);
      if (Array.isArray(parsed)) list = parsed.filter((t) => typeof t === "string");
    } catch {
      list = [rawTags];
    }
  }

  for (const tag of list) {
    if (tag.startsWith(MENTION_COACH_PREFIX)) {
      const parts = tag.slice(MENTION_COACH_PREFIX.length).split(":");
      if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
        return {
          type: "coach",
          id: parts[0],
          slug: parts[1],
          name: decodeURIComponent(parts[2]),
          avatarUrl: parts[3] ? decodeURIComponent(parts[3]) : undefined,
          headline: parts[4] ? decodeURIComponent(parts[4]) : undefined,
        };
      }
    } else if (tag.startsWith(MENTION_COURSE_PREFIX)) {
      const parts = tag.slice(MENTION_COURSE_PREFIX.length).split(":");
      if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
        return {
          type: "course",
          id: parts[0],
          slug: parts[1],
          name: decodeURIComponent(parts[2]),
          avatarUrl: parts[3] ? decodeURIComponent(parts[3]) : undefined,
          headline: parts[4] ? decodeURIComponent(parts[4]) : undefined,
        };
      }
    }
  }
  return null;
}

export function serializeMentionTag(entity: MentionedEntity): string {
  const safeName = encodeURIComponent(entity.name || "");
  const safeAvatar = encodeURIComponent(entity.avatarUrl || "");
  const safeHeadline = encodeURIComponent(entity.headline || "");
  if (entity.type === "coach") {
    return `${MENTION_COACH_PREFIX}${entity.id}:${entity.slug}:${safeName}:${safeAvatar}:${safeHeadline}`;
  }
  return `${MENTION_COURSE_PREFIX}${entity.id}:${entity.slug}:${safeName}:${safeAvatar}:${safeHeadline}`;
}

/**
 * Serializa los tags para guardarlos en la base de datos con los metadatos de resolución y menciones
 */
export function serializeCommunityTags(
  cleanTags: string[], 
  isResolved: boolean, 
  resolvedCommentId?: string,
  mentionedEntity?: MentionedEntity | null
): string[] {
  const result = cleanTags.filter((t) => !t.startsWith("__"));
  if (isResolved) {
    result.push(RESOLVED_TAG_PREFIX);
    if (resolvedCommentId) {
      result.push(`${RESOLVED_COMMENT_PREFIX}${resolvedCommentId}`);
    }
  }
  if (mentionedEntity) {
    result.push(serializeMentionTag(mentionedEntity));
  }
  return result;
}
