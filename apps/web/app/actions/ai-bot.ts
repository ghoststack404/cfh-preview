"use server";

import { getAuthenticatedUser } from "@/app/actions/onboarding";
import { prisma } from "@/lib/db";
import { z } from "zod";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface CoachAiBotConfig {
  enabled: boolean;
  welcomeMessage: string;
  tone: "friendly" | "professional" | "enthusiastic" | "academic";
  availabilityMode: "always" | "offline_only" | "disabled";
  faqs: FaqItem[];
}

const botConfigSchema = z.object({
  enabled: z.boolean(),
  welcomeMessage: z.string().min(5, "El mensaje de bienvenida debe tener al menos 5 caracteres").max(500, "Máximo 500 caracteres"),
  tone: z.enum(["friendly", "professional", "enthusiastic", "academic"]),
  availabilityMode: z.enum(["always", "offline_only", "disabled"]),
  faqs: z
    .array(
      z.object({
        id: z.string(),
        question: z.string().min(3, "La pregunta debe tener al menos 3 caracteres").max(150, "Máximo 150 caracteres"),
        answer: z.string().min(5, "La respuesta debe tener al menos 5 caracteres").max(400, "Máximo 400 caracteres"),
      })
    )
    .max(10, "Máximo 10 preguntas frecuentes"),
});

export async function getCoachAiBotConfig(): Promise<{
  success: boolean;
  config?: CoachAiBotConfig;
  profileContext?: CoachProfileContext | null;
  error?: string;
  needsOnboarding?: boolean;
}> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autorizado. Inicia sesión para continuar." };
    }

    const profile = await prisma.coachProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, rejectionReason: true, headline: true },
    });

    if (!profile) {
      return { success: false, error: "Perfil de coach no encontrado.", needsOnboarding: true };
    }

    let parsedMeta: any = {};
    if (profile.rejectionReason) {
      try {
        parsedMeta = JSON.parse(profile.rejectionReason);
      } catch {}
    }

    const savedBot = parsedMeta.aiBotConfig || {};

    const defaultConfig: CoachAiBotConfig = {
      enabled: savedBot.enabled ?? true,
      welcomeMessage:
        savedBot.welcomeMessage ??
        `¡Hola! Soy el asistente virtual de ${user.name || "tu Coach"}. Cuéntame qué metas quieres alcanzar o consulta las preguntas frecuentes mientras el coach se conecta.`,
      tone: savedBot.tone ?? "friendly",
      availabilityMode: savedBot.availabilityMode ?? "always",
      faqs: savedBot.faqs ?? [
        {
          id: "faq-1",
          question: "¿Cómo funcionan las sesiones?",
          answer: "Las sesiones de 60 min son por videollamada interactiva con pizarra y material personalizado.",
        },
        {
          id: "faq-2",
          question: "¿Ofreces prueba gratuita?",
          answer: "¡Sí! Puedes reservar una llamada de introducción gratuita de 15 minutos desde mi perfil.",
        },
      ],
    };

    const profileContext = await getCoachProfileContext(user.id);

    return { success: true, config: defaultConfig, profileContext };
  } catch (error: any) {
    console.error("Error en getCoachAiBotConfig:", error);
    return { success: false, error: error?.message || "Error al obtener la configuración del bot." };
  }
}

export async function saveCoachAiBotConfig(data: CoachAiBotConfig): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autorizado." };
    }

    const validated = botConfigSchema.parse(data);

    const profile = await prisma.coachProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, rejectionReason: true },
    });

    if (!profile) {
      return { success: false, error: "Perfil de coach no encontrado." };
    }

    let parsedMeta: any = {};
    if (profile.rejectionReason) {
      try {
        parsedMeta = JSON.parse(profile.rejectionReason);
      } catch {}
    }

    parsedMeta.aiBotConfig = validated;

    await prisma.coachProfile.update({
      where: { id: profile.id },
      data: {
        rejectionReason: JSON.stringify(parsedMeta),
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error en saveCoachAiBotConfig:", error);
    return {
      success: false,
      error: error?.errors?.[0]?.message || error?.message || "No se pudo guardar la configuración.",
    };
  }
}

export interface CoachProfileContext {
  coachName: string;
  headline: string;
  biography: string;
  yearsExperience: number;
  hourlyRate: string;
  scheduleRegular: string;
  scheduleTrial: string;
  policies: string;
}

function cleanString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Extrae la información real del perfil del Coach desde la base de datos (RAG / Context Ingestion).
 */
export async function getCoachProfileContext(coachUserId: string): Promise<CoachProfileContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: coachUserId },
    select: {
      id: true,
      name: true,
      coachProfile: {
        select: {
          id: true,
          headline: true,
          biography: true,
          yearsExperience: true,
          hourlyRateCents: true,
          currency: true,
          freeIntroEnabled: true,
          freeIntroMinutes: true,
          rejectionReason: true,
          availabilityRules: {
            where: { isActive: true },
            orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
          },
        },
      },
    },
  });

  if (!user || !user.coachProfile) return null;
  const profile = user.coachProfile;

  const weekdayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = m < 10 ? `0${m}` : `${m}`;
    return `${displayH}:${displayM} ${ampm}`;
  };

  // Horarios regulares ({{coach_schedule_regular}})
  let scheduleRegular = "";
  if (profile.availabilityRules.length > 0) {
    const grouped = profile.availabilityRules.map(
      (r) => `${weekdayNames[r.weekday]}: ${formatTime(r.startMinute)} a ${formatTime(r.endMinute)}`
    );
    scheduleRegular = grouped.join(", ");
  } else {
    scheduleRegular = "Lunes a Viernes de 09:00 AM a 05:00 PM (Sujeto a confirmación)";
  }

  // Horarios de prueba gratuita ({{coach_schedule_trial}})
  let scheduleTrial = "";
  let parsedRejection: any = {};
  if (profile.rejectionReason) {
    try {
      parsedRejection = JSON.parse(profile.rejectionReason);
    } catch {}
  }

  if (profile.freeIntroEnabled) {
    let introDays: number[] = [];
    if (Array.isArray(parsedRejection.freeIntroWeekdays)) {
      introDays = parsedRejection.freeIntroWeekdays;
    } else if (parsedRejection.freeIntroWeekday !== null && parsedRejection.freeIntroWeekday !== undefined) {
      introDays = [parsedRejection.freeIntroWeekday];
    }

    const startM = parsedRejection.freeIntroStartMinute;
    const endM = parsedRejection.freeIntroEndMinute;
    const duration = profile.freeIntroMinutes || 15;

    if (introDays.length > 0 && startM !== null && startM !== undefined && endM !== null && endM !== undefined) {
      const daysText = introDays.map((d) => weekdayNames[d]).join(" y ");
      scheduleTrial = `Sesión de prueba gratuita de ${duration} minutos disponible los días ${daysText} de ${formatTime(startM)} a ${formatTime(endM)}.`;
    } else {
      scheduleTrial = `Sesión de prueba gratuita de ${duration} minutos disponible según el calendario del coach.`;
    }
  } else {
    scheduleTrial = "Actualmente no ofrece sesiones de prueba gratuitas.";
  }

  // Precio ({{coach_pricing}})
  const rate = (profile.hourlyRateCents / 100).toFixed(0);
  const currency = profile.currency || "USD";
  const hourlyRate = `$${rate} ${currency} por sesión de 60 minutos`;

  // Bio y experiencia ({{coach_bio}})
  const coachName = user.name || "el Coach";
  const headline = profile.headline || "Coach Profesional";
  const yearsExperience = profile.yearsExperience || 1;
  const biography = profile.biography || "Especialista en desarrollo integral.";

  // Políticas ({{coach_policies}})
  const policies =
    "Políticas de sesión: Cancelaciones o cambios de horario deben realizarse con al menos 24 horas de anticipación. Las sesiones se realizan por videollamada interactiva (se requiere conexión estable, cámara y micrófono).";

  return {
    coachName,
    headline,
    biography,
    yearsExperience,
    hourlyRate,
    scheduleRegular,
    scheduleTrial,
    policies,
  };
}

/**
 * Generador contextual inteligente de respuestas del Coach IA.
 * Respeta Zero-Hallucination: si la consulta no corresponde a datos de perfil o FAQs,
 * genera el fallback estricto para derivación al Inbox humano.
 */
function generateCoachAiResponse(params: {
  incomingText: string;
  context: CoachProfileContext;
  botConfig: CoachAiBotConfig;
}): { replyText: string; isFallback: boolean } {
  const { incomingText, context, botConfig } = params;
  const cleanQ = cleanString(incomingText);
  const tone = botConfig.tone || "friendly";

  // 1. FAQs personalizadas del Coach
  if (Array.isArray(botConfig.faqs) && botConfig.faqs.length > 0) {
    const matchedFaq = botConfig.faqs.find((f) => {
      const q = cleanString(f.question);
      if (!q) return false;
      return cleanQ.includes(q) || q.includes(cleanQ) || (cleanQ.length > 8 && q.slice(0, 15).includes(cleanQ.slice(0, 15)));
    });

    if (matchedFaq && matchedFaq.answer) {
      return {
        replyText: matchedFaq.answer,
        isFallback: false,
      };
    }
  }

  // 2. Horarios de prueba gratis ({{coach_schedule_trial}})
  const isTrialQuery =
    cleanQ.includes("prueba gratis") ||
    cleanQ.includes("clase gratis") ||
    cleanQ.includes("sesion gratis") ||
    cleanQ.includes("clase de prueba") ||
    cleanQ.includes("sesion de prueba") ||
    cleanQ.includes("prueba gratuita") ||
    cleanQ.includes("llamada de prueba") ||
    cleanQ.includes("intro");

  if (isTrialQuery) {
    const trialReplies: Record<string, string> = {
      friendly: `¡Hola! Con mucho gusto te cuento: ${context.scheduleTrial} ¡Será un gran placer conocernos y comenzar a trabajar en tus metas!`,
      professional: `Estimado(a) alumno(a), le informo respecto a la sesión introductoria: ${context.scheduleTrial} Dicha llamada está diseñada para evaluar requerimientos y estructurar el plan de trabajo.`,
      enthusiastic: `¡Sí, totalmente! ¡Tenemos una sesión de prueba esperándote con toda la energía! ${context.scheduleTrial} ¡Aprovechémosla al máximo para despegar!`,
      academic: `Saludos cordiales. En lo relativo a la evaluación diagnóstica inicial: ${context.scheduleTrial} Dicha instancia permite diagnosticar su nivel de partida y trazar el plan didáctico.`,
    };
    return {
      replyText: trialReplies[tone] || trialReplies.friendly!,
      isFallback: false,
    };
  }

  // 3. Horarios regulares y disponibilidad general ({{coach_schedule_regular}})
  const isScheduleQuery =
    cleanQ.includes("horario") ||
    cleanQ.includes("disponib") ||
    cleanQ.includes("dias") ||
    cleanQ.includes("agenda") ||
    cleanQ.includes("agendar") ||
    cleanQ.includes("a que hora") ||
    cleanQ.includes("cuando") ||
    cleanQ.includes("turnos") ||
    cleanQ.includes("calendario") ||
    cleanQ.includes("atencion");

  if (isScheduleQuery) {
    const trialNote =
      context.scheduleTrial && !context.scheduleTrial.includes("no ofrece")
        ? ` (Sesiones de prueba disponibles: ${context.scheduleTrial})`
        : "";

    const scheduleReplies: Record<string, string> = {
      friendly: `¡Hola! Con mucho gusto te comparto los horarios de atención de ${context.coachName}: ${context.scheduleRegular}.${trialNote} ¿Te gustaría que agendemos en alguno de estos espacios?`,
      professional: `Estimado(a) alumno(a), la disponibilidad regular del Coach ${context.coachName} es la siguiente: ${context.scheduleRegular}.${trialNote} Puede coordinar y reservar su sesión directamente en la plataforma.`,
      enthusiastic: `¡Hola! ¡Qué gran momento para dar el siguiente paso! Estos son los horarios listos para tus sesiones: ${context.scheduleRegular}.${trialNote} ¡Elige el tuyo y vamos con todo!`,
      academic: `Saludos cordiales. En relación con el cronograma y horarios de cátedra del docente ${context.coachName}: ${context.scheduleRegular}.${trialNote} Se sugiere programar bloques continuos para optimizar la curva de aprendizaje.`,
    };
    return {
      replyText: scheduleReplies[tone] || scheduleReplies.friendly!,
      isFallback: false,
    };
  }

  // 4. Precios / Tarifas ({{coach_pricing}})
  const isPricingQuery =
    cleanQ.includes("precio") ||
    cleanQ.includes("tarifa") ||
    cleanQ.includes("cuanto cobr") ||
    cleanQ.includes("cuanto vale") ||
    cleanQ.includes("costo") ||
    cleanQ.includes("valor") ||
    cleanQ.includes("paquete") ||
    cleanQ.includes("cuanto cuesta") ||
    cleanQ.includes("pago") ||
    cleanQ.includes("pagar");

  if (isPricingQuery) {
    const pricingReplies: Record<string, string> = {
      friendly: `¡Por supuesto! La inversión para la sesión de 60 minutos con ${context.coachName} es de ${context.hourlyRate}. Puedes asegurar tu lugar directamente desde la plataforma cuando gustes.`,
      professional: `La tarifa profesional establecida por sesión de 60 minutos con el Coach ${context.coachName} corresponde a ${context.hourlyRate}. Los pagos y confirmaciones se gestionan de forma segura en la plataforma.`,
      enthusiastic: `¡Excelente decisión invertir en ti y en tu futuro! La sesión intensiva de 60 minutos está en ${context.hourlyRate}. ¡Cada minuto valdrá totalmente el esfuerzo para alcanzar tus metas!`,
      academic: `El arancel pedagógico correspondiente a la sesión lectiva de 60 minutos con el docente ${context.coachName} es de ${context.hourlyRate}, contemplando seguimiento y recursos metodológicos.`,
    };
    return {
      replyText: pricingReplies[tone] || pricingReplies.friendly!,
      isFallback: false,
    };
  }

  // 5. Bio / Experiencia / Metodología ({{coach_bio}})
  const isBioQuery =
    cleanQ.includes("quien eres") ||
    cleanQ.includes("sobre ti") ||
    cleanQ.includes("sobre el coach") ||
    cleanQ.includes("experiencia") ||
    cleanQ.includes("biografia") ||
    cleanQ.includes("bio") ||
    cleanQ.includes("metodologia") ||
    cleanQ.includes("estudios") ||
    cleanQ.includes("quien es") ||
    cleanQ.includes("presentacion") ||
    cleanQ.includes("trayectoria") ||
    cleanQ.includes("perfil");

  if (isBioQuery) {
    const bioReplies: Record<string, string> = {
      friendly: `¡Te cuento con mucho gusto sobre ${context.coachName}! Es ${context.headline} y cuenta con ${context.yearsExperience} años de experiencia acompañando a personas. Su enfoque y metodología: ${context.biography}. ¡Estará feliz de trabajar contigo!`,
      professional: `Perfil y credenciales de ${context.coachName}: ${context.headline}. Acredita ${context.yearsExperience} años de trayectoria profesional. Enfoque metodológico: ${context.biography}.`,
      enthusiastic: `¡Conoce a tu próximo mentor! ${context.coachName} es ${context.headline}, con más de ${context.yearsExperience} años de trayectoria impulsando resultados reales. Su metodología: ${context.biography}. ¡Prepárate para dar el salto!`,
      academic: `Ficha académica del docente ${context.coachName}: ${context.headline}. Posee ${context.yearsExperience} años de experiencia formativa e investigativa. Marco metodológico y pedagógico: ${context.biography}.`,
    };
    return {
      replyText: bioReplies[tone] || bioReplies.friendly!,
      isFallback: false,
    };
  }

  // 6. Políticas / Requisitos ({{coach_policies}})
  const isPoliciesQuery =
    cleanQ.includes("politica") ||
    cleanQ.includes("cancelar") ||
    cleanQ.includes("cancelacion") ||
    cleanQ.includes("reprogram") ||
    cleanQ.includes("requisito") ||
    cleanQ.includes("camara") ||
    cleanQ.includes("microfono") ||
    cleanQ.includes("videollamada") ||
    cleanQ.includes("zoom");

  if (isPoliciesQuery) {
    const policiesReplies: Record<string, string> = {
      friendly: `¡Claro que sí! Para organizarnos bien: ${context.policies} Así garantizamos que aproveches tu clase al máximo.`,
      professional: `Términos operativos del servicio: ${context.policies} El cumplimiento de estos lineamientos asegura el estándar de calidad de las sesiones.`,
      enthusiastic: `¡La disciplina y el compromiso hacen a los grandes campeones! ${context.policies} ¡Ten todo listo para dar el 100%!`,
      academic: `Normativa del aula virtual y directrices de cátedra: ${context.policies} El seguimiento estricto de estos requisitos garantiza la continuidad pedagógica.`,
    };
    return {
      replyText: policiesReplies[tone] || policiesReplies.friendly!,
      isFallback: false,
    };
  }

  // 7. Saludos cordiales iniciales
  const isGreeting =
    cleanQ === "hola" ||
    cleanQ === "buenas" ||
    cleanQ.startsWith("hola ") ||
    cleanQ.startsWith("buenos dias") ||
    cleanQ.startsWith("buenas tardes") ||
    cleanQ.startsWith("buenas noches") ||
    cleanQ.startsWith("que tal");

  if (isGreeting) {
    const greetingReplies: Record<string, string> = {
      friendly: `¡Hola! Qué gusto saludarte. Soy el Asistente Virtual de ${context.coachName}. Puedo contarte sobre nuestros horarios, precios, metodología o ayudarte a coordinar una sesión. ¿Qué te gustaría consultar?`,
      professional: `Estimado(a), un saludo cordial. Soy el Asistente del Coach ${context.coachName}. Estoy a su disposición para proporcionarle información sobre horarios disponibles, tarifas y metodología de trabajo. ¿En qué puedo orientarle?`,
      enthusiastic: `¡Hola! ¡Qué gran energía! Soy el Asistente Virtual de ${context.coachName} y estoy aquí para ayudarte a acelerar tu camino hacia tus metas. Pregúntame sobre horarios, precios o cómo arrancar. ¿Listos para comenzar?`,
      academic: `Saludos cordiales. Asistente pedagógico del docente ${context.coachName} a su disposición. Puedo asistirle en relación con cronogramas de clases, aranceles lectivos y fundamentación metodológica. ¿Cuál es su requerimiento?`,
    };
    return {
      replyText: greetingReplies[tone] || greetingReplies.friendly!,
      isFallback: false,
    };
  }

  // 8. ZERO-HALLUCINATION FALLBACK: Preguntas no cubiertas o fuera de contexto
  return {
    replyText: "Esa información no la tengo a la mano, pero ya le dejé la pregunta notificada al Coach para que te responda directamente por este chat.",
    isFallback: true,
  };
}

/**
 * Simulación de respuesta IA para el panel de configuración del Coach.
 */
export async function simulateCoachAiReply(params: string | {
  incomingText: string;
  overrideTone?: "friendly" | "professional" | "enthusiastic" | "academic";
}): Promise<{
  success: boolean;
  replyText: string;
  isFallback: boolean;
  error?: string;
}> {
  try {
    const incomingText = typeof params === "string" ? params : params.incomingText;
    const overrideTone = typeof params === "string" ? undefined : params.overrideTone;

    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, replyText: "", isFallback: true, error: "No autorizado" };
    }

    const context = await getCoachProfileContext(user.id);
    if (!context) {
      return { success: false, replyText: "", isFallback: true, error: "Perfil de coach no encontrado" };
    }

    const botConfigResult = await getCoachAiBotConfig();
    const botConfig = botConfigResult.config || {
      enabled: true,
      welcomeMessage: "",
      tone: "friendly",
      availabilityMode: "always",
      faqs: [],
    };

    if (overrideTone) {
      botConfig.tone = overrideTone;
    }

    const { replyText, isFallback } = generateCoachAiResponse({
      incomingText,
      context,
      botConfig,
    });

    return { success: true, replyText, isFallback };
  } catch (err: any) {
    return { success: false, replyText: "", isFallback: true, error: err?.message };
  }
}

/**
 * Procesa una respuesta automática del bot del Coach cuando un alumno envía un mensaje.
 * Extrae datos del perfil del Coach en tiempo real (RAG).
 */
export async function processCoachAiAutoReply(params: {
  conversationId: string;
  coachId: string;
  studentId: string;
  incomingText: string;
}): Promise<{ replied: boolean; messageId?: string; replyText?: string; isFallback?: boolean }> {
  try {
    const { conversationId, coachId, incomingText } = params;

    const context = await getCoachProfileContext(coachId);
    if (!context) {
      return { replied: false };
    }

    const coach = await prisma.user.findUnique({
      where: { id: coachId },
      select: {
        id: true,
        name: true,
        coachProfile: {
          select: { rejectionReason: true },
        },
      },
    });

    if (!coach) {
      return { replied: false };
    }

    let parsedMeta: any = {};
    if (coach?.coachProfile?.rejectionReason) {
      try {
        parsedMeta = JSON.parse(coach.coachProfile.rejectionReason);
      } catch {}
    }

    const botConfig: CoachAiBotConfig | undefined = parsedMeta.aiBotConfig;
    if (!botConfig || !botConfig.enabled || botConfig.availabilityMode === "disabled") {
      return { replied: false };
    }

    // Evaluar la respuesta usando RAG y contexto del Coach
    const { replyText, isFallback } = generateCoachAiResponse({
      incomingText,
      context,
      botConfig,
    });

    let finalAutoReply = `🤖 [Respuesta Automática del Asistente]: ${replyText}`;
    if (isFallback) {
      finalAutoReply += " [Pendiente de respuesta humana / Derivado de Bot]";
    }

    // Crear el mensaje en la conversación emitido por el Coach
    const autoMsg = await prisma.message.create({
      data: {
        conversationId,
        senderId: coach.id,
        content: finalAutoReply,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: autoMsg.createdAt },
    });

    // Si fue fallback, notificar especialmente al Coach sobre la derivación humana requerida
    if (isFallback) {
      await prisma.notification.create({
        data: {
          userId: coach.id,
          type: "MESSAGE",
          title: `⚠️ Consulta derivada por Asistente IA`,
          body: `Un alumno realizó una consulta que requiere tu respuesta humana: "${incomingText.slice(0, 100)}"`,
          link: `/messages?conversationId=${conversationId}`,
        },
      });
    }

    return {
      replied: true,
      messageId: autoMsg.id,
      replyText: finalAutoReply,
      isFallback,
    };
  } catch (err) {
    console.error("[processCoachAiAutoReply] Error procesando auto-respuesta:", err);
    return { replied: false };
  }
}
