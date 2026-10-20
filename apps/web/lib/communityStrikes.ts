import { prisma } from "@/lib/db";

export const SUSPENSION_DAYS = 4;
export const SUSPENSION_MS = SUSPENSION_DAYS * 24 * 60 * 60 * 1000;

export interface StrikeResult {
  strikeNumber: number;
  isSuspended: boolean;
  suspendedUntil?: Date;
  warningMessage: string;
}

/**
 * Registra o procesa una infracción a las políticas de seguridad de la comunidad.
 * - 1ra infracción: Advertencia registrada en AuditLog y Notificación en plataforma.
 * - 2da infracción: Suspensión de cuenta por 4 días, revocación de sesiones y Notificación.
 */
export async function checkAndHandleCommunityStrike(
  userId: string,
  violationReason: string,
  contentSnippet: string
): Promise<StrikeResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, status: true }
  });

  if (!user) {
    return {
      strikeNumber: 0,
      isSuspended: false,
      warningMessage: "Usuario no encontrado."
    };
  }

  // Si ya está suspendido, verificar si ya expiró
  if (user.status === "SUSPENDED") {
    const reactivateCheck = await checkAndAutoReactivateUser(userId);
    if (reactivateCheck.isSuspended) {
      return {
        strikeNumber: 2,
        isSuspended: true,
        suspendedUntil: reactivateCheck.suspendedUntil,
        warningMessage: `⛔ Tu cuenta está actualmente suspendida por incumplimiento de las normas de la comunidad. Podrás acceder nuevamente en ${reactivateCheck.remainingText}.`
      };
    }
  }

  // Buscar el último registro de suspensión para contar solo infracciones desde ese momento
  const lastSuspension = await prisma.auditLog.findFirst({
    where: {
      entityType: "User",
      entityId: userId,
      action: "USER_SUSPENDED_4_DAYS"
    },
    orderBy: { createdAt: "desc" }
  });

  // Contar infracciones posteriores a la última suspensión
  const priorStrikesCount = await prisma.auditLog.count({
    where: {
      entityType: "User",
      entityId: userId,
      action: "COMMUNITY_INFRACTION",
      ...(lastSuspension ? { createdAt: { gt: lastSuspension.createdAt } } : {})
    }
  });

  const currentStrike = priorStrikesCount + 1;

  if (currentStrike === 1) {
    // 1ra falta: Advertencia
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "COMMUNITY_INFRACTION",
        entityType: "User",
        entityId: userId,
        metadata: {
          strikeNumber: 1,
          reason: violationReason,
          snippet: contentSnippet.slice(0, 180),
          createdAt: new Date().toISOString()
        }
      }
    });

    // Crear notificación en la plataforma
    await prisma.notification.create({
      data: {
        userId,
        type: "SYSTEM",
        title: "⚠️ 1ra Advertencia de Seguridad en Comunidad",
        body: `Has intentado compartir información restringida (${violationReason}). Esta es tu 1ra advertencia oficial. Si vuelves a compartir este tipo de datos, tu cuenta será suspendida automáticamente por 4 días.`,
        link: "/comunidad"
      }
    });

    return {
      strikeNumber: 1,
      isSuspended: false,
      warningMessage: `⚠️ ACCIÓN NO PERMITIDA (1ra Advertencia): Está estrictamente prohibido compartir números de teléfono o datos de contacto externos (${violationReason}). Si vuelves a intentarlo, tu cuenta será suspendida automáticamente.`
    };
  }

  // 2da falta (o más): Suspensión por 4 días
  const suspendedUntil = new Date(Date.now() + SUSPENSION_MS);
  const formattedDate = suspendedUntil.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  // Registrar infracción y suspensión en AuditLog
  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action: "COMMUNITY_INFRACTION",
      entityType: "User",
      entityId: userId,
      metadata: {
        strikeNumber: currentStrike,
        reason: violationReason,
        snippet: contentSnippet.slice(0, 180),
        suspendedUntil: suspendedUntil.toISOString(),
        createdAt: new Date().toISOString()
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action: "USER_SUSPENDED_4_DAYS",
      entityType: "User",
      entityId: userId,
      metadata: {
        strikeNumber: currentStrike,
        reason: violationReason,
        suspendedAt: new Date().toISOString(),
        suspendedUntil: suspendedUntil.toISOString()
      }
    }
  });

  // Cambiar estado del usuario a SUSPENDED
  await prisma.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED" }
  });

  // Notificación del sistema
  await prisma.notification.create({
    data: {
      userId,
      type: "SYSTEM",
      title: "⛔ Cuenta Suspendida por 4 Días",
      body: `Tu cuenta ha sido suspendida temporalmente por 4 días debido a reincidencia en compartir información prohibida en la comunidad (${violationReason}). Tu acceso se restablecerá automáticamente el ${formattedDate}.`,
      link: "/comunidad"
    }
  });

  return {
    strikeNumber: currentStrike,
    isSuspended: true,
    suspendedUntil,
    warningMessage: `⛔ 2DA INFRACCIÓN - CUENTA SUSPENDIDA: Has reincidido al compartir información prohibida (${violationReason}). Tu cuenta ha sido suspendida por un plazo de 4 días (hasta el ${formattedDate}).`
  };
}

/**
 * Verifica si un usuario con estado SUSPENDED ya cumplió los 4 días de sanción.
 * Si ya los cumplió, lo reactiva automáticamente a ACTIVE.
 */
export async function checkAndAutoReactivateUser(userId: string): Promise<{
  isSuspended: boolean;
  remainingText?: string;
  suspendedUntil?: Date;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true }
  });

  if (!user || user.status !== "SUSPENDED") {
    return { isSuspended: false };
  }

  // Buscar la última suspensión de 4 días
  const suspensionLog = await prisma.auditLog.findFirst({
    where: {
      entityType: "User",
      entityId: userId,
      action: "USER_SUSPENDED_4_DAYS"
    },
    orderBy: { createdAt: "desc" }
  });

  if (!suspensionLog || !suspensionLog.metadata) {
    // Suspensión manual de administrador
    return {
      isSuspended: true,
      remainingText: "indefinido (revisión administrativa)"
    };
  }

  const meta = suspensionLog.metadata as Record<string, any>;
  if (!meta.suspendedUntil) {
    return {
      isSuspended: true,
      remainingText: "indefinido (revisión administrativa)"
    };
  }

  const suspendedUntil = new Date(meta.suspendedUntil);
  const now = Date.now();

  if (now >= suspendedUntil.getTime()) {
    // El plazo de 4 días ha expirado: REACTIVAR CUENTA AUTOMÁTICAMENTE
    await prisma.user.update({
      where: { id: userId },
      data: { status: "ACTIVE" }
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "USER_AUTO_REACTIVATED",
        entityType: "User",
        entityId: userId,
        metadata: {
          previousSuspensionEndedAt: meta.suspendedUntil,
          reactivatedAt: new Date().toISOString()
        }
      }
    });

    await prisma.notification.create({
      data: {
        userId,
        type: "SYSTEM",
        title: "✅ Cuenta Reactivada",
        body: "Tu período de suspensión de 4 días ha finalizado. Tu cuenta ha sido reactivada. Recuerda respetar los protocolos de seguridad de la comunidad para evitar nuevas sanciones.",
        link: "/comunidad"
      }
    });

    return { isSuspended: false };
  }

  // Aún está dentro del plazo de 4 días
  const diffMs = suspendedUntil.getTime() - now;
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diffMs % (60 * 1000)) / (60 * 1000));

  let remainingText = "";
  if (days > 0) {
    remainingText = `${days} día(s) y ${hours} hora(s)`;
  } else if (hours > 0) {
    remainingText = `${hours} hora(s) y ${minutes} minuto(s)`;
  } else {
    remainingText = `${minutes} minuto(s)`;
  }

  return {
    isSuspended: true,
    remainingText,
    suspendedUntil
  };
}

export interface SuspensionDetails {
  isSuspended: boolean;
  strikeNumber?: number;
  reason?: string;
  ruleTitle?: string;
  ruleDescription?: string;
  suspendedAt?: string;
  suspendedUntil?: string;
  remainingMs?: number;
  remainingDays?: number;
  remainingHours?: number;
  remainingMinutes?: number;
  remainingSeconds?: number;
  remainingText?: string;
  formattedDate?: string;
}

/**
 * Obtiene la información completa de la suspensión activa de un usuario para mostrar en el banner superior:
 * - Motivos detallados
 * - Regla oficial comunitaria infringida
 * - Conteo regresivo exacto en milisegundos y desglosado (Días, Horas, Minutos, Segundos)
 */
export async function getSuspensionDetails(userId: string): Promise<SuspensionDetails> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true }
  });

  if (!user || user.status !== "SUSPENDED") {
    return { isSuspended: false };
  }

  // Verificar si ya expiró el período de sanción
  const reactivateCheck = await checkAndAutoReactivateUser(userId);
  if (!reactivateCheck.isSuspended) {
    return { isSuspended: false };
  }

  // Obtener el registro de la última suspensión
  const suspensionLog = await prisma.auditLog.findFirst({
    where: {
      entityType: "User",
      entityId: userId,
      action: "USER_SUSPENDED_4_DAYS"
    },
    orderBy: { createdAt: "desc" }
  });

  const meta = (suspensionLog?.metadata || {}) as Record<string, any>;
  const reason = meta.reason || "Incumplimiento reiterado de las normas de convivencia y seguridad de la comunidad.";
  const strikeNumber = meta.strikeNumber || 2;
  const suspendedAt = meta.suspendedAt || suspensionLog?.createdAt.toISOString() || new Date().toISOString();
  const suspendedUntil = meta.suspendedUntil || reactivateCheck.suspendedUntil?.toISOString() || new Date(Date.now() + SUSPENSION_MS).toISOString();

  const suspendedUntilDate = new Date(suspendedUntil);
  const now = Date.now();
  const remainingMs = Math.max(0, suspendedUntilDate.getTime() - now);

  const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
  const remainingHours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const remainingMinutes = Math.floor((remainingMs % (60 * 1000)) / (60 * 1000));
  const remainingSeconds = Math.floor((remainingMs % (60 * 1000)) / 1000);

  const formattedDate = suspendedUntilDate.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  // Mapear el motivo a la Regla Oficial de la Comunidad
  const lowerReason = reason.toLowerCase();
  let ruleTitle = "Regla General — Convivencia y Políticas de Seguridad en la Comunidad";
  let ruleDescription = "Suspensión temporal de 4 días aplicada por acumulación de faltas a los lineamientos y protocolos de seguridad de Coaching From Home.";

  if (
    lowerReason.includes("teléfono") ||
    lowerReason.includes("telefono") ||
    lowerReason.includes("celular") ||
    lowerReason.includes("whats") ||
    lowerReason.includes("telegram") ||
    lowerReason.includes("contacto") ||
    lowerReason.includes("número") ||
    lowerReason.includes("numero")
  ) {
    ruleTitle = "Regla 2.1 — Prohibición de Compartir Métodos de Contacto Externo";
    ruleDescription = "Para salvaguardar la seguridad de los alumnos y la validez de la garantía de servicio, está estrictamente prohibido compartir números telefónicos, celulares, WhatsApp, Telegram o datos de contacto personal. Toda interacción debe mantenerse dentro de la plataforma.";
  } else if (
    lowerReason.includes("cuenta") ||
    lowerReason.includes("banco") ||
    lowerReason.includes("tarjeta") ||
    lowerReason.includes("clabe") ||
    lowerReason.includes("spei") ||
    lowerReason.includes("pago") ||
    lowerReason.includes("transferencia") ||
    lowerReason.includes("depósito") ||
    lowerReason.includes("deposito") ||
    lowerReason.includes("paypal") ||
    lowerReason.includes("zelle")
  ) {
    ruleTitle = "Regla 3.4 — Cero Transacciones y Pagos Fuera de la Plataforma (Protección Antifraude)";
    ruleDescription = "Toda contratación de cursos y sesiones debe realizarse a través del sistema protegido de Coaching From Home. Queda estrictamente prohibido solicitar o compartir cuentas bancarias, CLABE interbancaria, tarjetas o acordar pagos por fuera para prevenir fraudes.";
  } else if (
    lowerReason.includes("imagen") ||
    lowerReason.includes("foto") ||
    lowerReason.includes("archivo") ||
    lowerReason.includes("inapropiad") ||
    lowerReason.includes("sensible")
  ) {
    ruleTitle = "Regla 1.2 — Contenido Seguro, Respetuoso y Apto para la Comunidad";
    ruleDescription = "Todo archivo visual es moderado automáticamente. Se prohíbe subir imágenes inapropiadas o capturas que expongan números de teléfono o cuentas bancarias que eludan los protocolos de seguridad.";
  }

  return {
    isSuspended: true,
    strikeNumber,
    reason,
    ruleTitle,
    ruleDescription,
    suspendedAt,
    suspendedUntil,
    remainingMs,
    remainingDays,
    remainingHours,
    remainingMinutes,
    remainingSeconds,
    remainingText: reactivateCheck.remainingText || `${remainingDays}d ${remainingHours}h`,
    formattedDate
  };
}
