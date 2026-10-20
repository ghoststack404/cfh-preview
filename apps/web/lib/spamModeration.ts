import { prisma } from "@/lib/db";

export const SPAM_TIMEOUT_MINUTES = 90; // 1 hora y 30 minutos
export const SPAM_TIMEOUT_MS = SPAM_TIMEOUT_MINUTES * 60 * 1000;
export const MAX_REPEATED_COUNT = 3; // Límite de repeticiones (más de 3 está prohibido)
export const SPAM_SIMILARITY_THRESHOLD = 0.75; // 75% de similitud ("lo más parecido")

/**
 * Normaliza texto para comparación de spam:
 * - Minúsculas
 * - Remueve tildes / diacríticos
 * - Remueve hashtags (#), menciones (@), signos de puntuación y emojis
 * - Colapsa espacios en blanco
 */
export function normalizeForSpam(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remover tildes
    .replace(/[#@_.,\/#!$%\^&\*;:{}=\-_`~()?"'«»“”\n\r\t]/g, " ") // Remover signos
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calcula similitud entre dos textos:
 * - 1.0 si son idénticos tras normalizar
 * - Substring ratio si uno contiene al otro
 * - Coeficiente Dice basado en bigramas para detectar "lo más parecido"
 */
export function calculateSpamSimilarity(str1: string, str2: string): number {
  const s1 = normalizeForSpam(str1);
  const s2 = normalizeForSpam(str2);

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  // Si uno contiene al otro con longitud cercana
  if (s1.includes(s2) || s2.includes(s1)) {
    const ratio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
    if (ratio >= 0.70) return ratio;
  }

  // Coeficiente Dice de bigramas
  const getBigrams = (s: string) => {
    const bg = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const b = s.substring(i, i + 2);
      bg.set(b, (bg.get(b) || 0) + 1);
    }
    return bg;
  };

  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);

  let intersection = 0;
  bg1.forEach((count, b) => {
    if (bg2.has(b)) {
      intersection += Math.min(count, bg2.get(b)!);
    }
  });

  const total = (s1.length - 1) + (s2.length - 1);
  return total > 0 ? (2 * intersection) / total : 0;
}

/**
 * Da formato legible al tiempo restante en español
 */
export function formatRemainingTime(remainingMinutes: number): string {
  if (remainingMinutes >= 60) {
    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;
    if (mins === 0) {
      return `${hours} hora${hours > 1 ? "s" : ""}`;
    }
    return `${hours} hora${hours > 1 ? "s" : ""} y ${mins} minuto${mins > 1 ? "s" : ""}`;
  }
  return `${remainingMinutes} minuto${remainingMinutes > 1 ? "s" : ""}`;
}

/**
 * Verifica si un usuario tiene una sanción activa por SPAM (1:30h).
 */
export async function checkUserSpamTimeout(userId: string): Promise<{
  isBlocked: boolean;
  remainingMinutes: number;
  remainingText: string;
  timeoutUntil?: Date;
  formattedHour?: string;
}> {
  const lastSpamLog = await prisma.auditLog.findFirst({
    where: {
      entityType: "User",
      entityId: userId,
      action: "USER_SPAM_TIMEOUT_90_MIN",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!lastSpamLog) {
    return { isBlocked: false, remainingMinutes: 0, remainingText: "" };
  }

  const meta = (lastSpamLog.metadata || {}) as Record<string, any>;
  const suspendedUntilStr =
    meta.suspendedUntil ||
    new Date(lastSpamLog.createdAt.getTime() + SPAM_TIMEOUT_MS).toISOString();
  const suspendedUntil = new Date(suspendedUntilStr);
  const now = Date.now();

  if (suspendedUntil.getTime() <= now) {
    return { isBlocked: false, remainingMinutes: 0, remainingText: "" };
  }

  const remainingMs = Math.max(0, suspendedUntil.getTime() - now);
  const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
  const remainingText = formatRemainingTime(remainingMinutes);

  const formattedHour = suspendedUntil.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    isBlocked: true,
    remainingMinutes,
    remainingText,
    timeoutUntil: suspendedUntil,
    formattedHour,
  };
}

/**
 * Valida si una nueva publicación o mensaje infringe la regla Anti-Spam:
 * 1. Si el usuario ya tiene sanción activa de 1:30h, bloquea de inmediato.
 * 2. Si el usuario ha publicado el mismo mensaje o lo más parecido 3 o más veces en las últimas 24h:
 *    - Se bloquea la creación del nuevo mensaje
 *    - Se aplica la sanción de 1:30h en AuditLog
 *    - Se genera una Notificación oficial en plataforma
 */
export async function validateSpamRule(
  userId: string,
  content: string
): Promise<{
  isSpam: boolean;
  error?: string;
  timeoutUntil?: Date;
  remainingText?: string;
  formattedHour?: string;
}> {
  // 1. Verificar si ya tiene sanción activa
  const currentTimeout = await checkUserSpamTimeout(userId);
  if (currentTimeout.isBlocked) {
    return {
      isSpam: true,
      error: `⛔ ACCESO RESTRINGIDO POR SPAM: Tienes una sanción activa por publicar mensajes repetitivos. No puedes enviar publicaciones ni comentarios durante 1 hora y 30 minutos (tiempo restante: ${currentTimeout.remainingText}, disponible a las ${currentTimeout.formattedHour}).`,
      timeoutUntil: currentTimeout.timeoutUntil,
      remainingText: currentTimeout.remainingText,
      formattedHour: currentTimeout.formattedHour,
    };
  }

  // 2. Consultar historial reciente del usuario (últimas 24 horas)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recentPosts, recentComments] = await Promise.all([
    prisma.communityPost.findMany({
      where: {
        authorId: userId,
        createdAt: { gte: since },
      },
      select: { id: true, content: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.communityComment.findMany({
      where: {
        authorId: userId,
        createdAt: { gte: since },
      },
      select: { id: true, content: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const allRecentItems = [...recentPosts, ...recentComments];
  let matchingCount = 0;

  for (const item of allRecentItems) {
    const sim = calculateSpamSimilarity(content, item.content);
    if (sim >= SPAM_SIMILARITY_THRESHOLD) {
      matchingCount++;
    }
  }

  // Si ya existe 3 o más veces en su historial, este nuevo envío superaría el límite ("más de 3 veces")
  if (matchingCount >= MAX_REPEATED_COUNT) {
    const timeoutUntil = new Date(Date.now() + SPAM_TIMEOUT_MS);
    const formattedHour = timeoutUntil.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const remainingText = "1 hora y 30 minutos";

    // Registrar sanción de 1:30h en AuditLog
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "USER_SPAM_TIMEOUT_90_MIN",
        entityType: "User",
        entityId: userId,
        metadata: {
          reason: "SPAM: Mensaje o publicación repetida más de 3 veces",
          snippet: content.slice(0, 180),
          repeatedTimes: matchingCount + 1,
          suspendedAt: new Date().toISOString(),
          suspendedUntil: timeoutUntil.toISOString(),
        },
      },
    });

    // Crear notificación oficial en la plataforma
    try {
      await prisma.notification.create({
        data: {
          userId,
          type: "SYSTEM",
          title: "⚠️ Advertencia por SPAM (Sanción 1:30h)",
          body: `Has repetido el mismo mensaje más de 3 veces. El SPAM no está permitido en la comunidad. Se ha restringido tu capacidad de publicar o enviar mensajes durante 1 hora y 30 minutos (hasta las ${formattedHour}).`,
          link: "/comunidad",
        },
      });
    } catch (err) {
      console.error("Error al registrar notificación de spam:", err);
    }

    return {
      isSpam: true,
      error: `⚠️ ADVERTENCIA POR SPAM: Has repetido el mismo mensaje más de 3 veces. El SPAM no está permitido en la comunidad. No podrás enviar publicaciones ni mensajes durante 1 hora y 30 minutos (hasta las ${formattedHour}).`,
      timeoutUntil,
      remainingText,
      formattedHour,
    };
  }

  return { isSpam: false };
}
