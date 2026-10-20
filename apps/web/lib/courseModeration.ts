/**
 * Motor de Moderación de Cursos con Inteligencia Artificial
 * Coaching From Home — AI Course Moderation Pipeline (R5)
 * 
 * Compone:
 * 1. Moderación de toxicidad y lenguaje ofensivo (toxicityModeration.ts)
 * 2. Seguridad comunitaria y prevención de bypass de pagos/contacto (communitySafety.ts)
 * 3. Verificación de completitud pedagógica y estructural
 * 4. Inspección semántica de IA (mock determinista offline y OpenAI en producción)
 */

import { validateTextToxicity } from "./toxicityModeration";
import { validateCommunitySafety } from "./communitySafety";

export interface CourseModerationViolation {
  field: "title" | "summary" | "description" | "whatYouWillLearn" | "modules" | "lessons" | "thumbnailUrl" | "priceCents";
  category: "PROFANITY" | "THREAT" | "HARASSMENT" | "CONTACT_BYPASS" | "PAYMENT_BYPASS" | "STRUCTURE" | "QUALITY";
  message: string;
}

export interface CourseModerationResult {
  passed: boolean;
  allowed: boolean; // Alias para compatibilidad total con PROJECT.md
  score: number; // 0.0 a 1.0
  reasons: string[];
  flags: {
    toxicity: boolean;
    communitySafety: boolean;
    completeness: boolean;
    aiSemantic: boolean;
  };
  violations: CourseModerationViolation[];
  suggestedAction?: string;
  reviewedBy: "AI_DETERMINISTIC" | "AI_OPENAI" | "AI_MOCK";
  timestamp: string;
}

export interface CourseModerationLessonInput {
  title: string;
  durationMinutes?: number;
  videoUrl?: string | null;
  content?: string | null;
  kind?: string;
  isPreview?: boolean;
}

export interface CourseModerationModuleInput {
  title: string;
  lessons?: CourseModerationLessonInput[];
}

export interface CourseModerationInput {
  title: string;
  summary?: string | null;
  description?: string | null;
  whatYouWillLearn?: string[];
  priceCents: number;
  currency?: string;
  thumbnailUrl?: string | null;
  introVideoUrl?: string | null;
  estimatedMinutes?: number;
  modules?: CourseModerationModuleInput[];
}

// Patrones deterministas para promesas engañosas, esquemas piramidales o fraudes
const MISLEADING_SCHEMES_REGEX = /\b(?:dinero\s*f[aá]cil|hazte\s*rico|hacerte\s*rico|vu[eé]lvete\s*rico|ganancias?\s*garantizadas?|ingresos?\s*garantizados?|100%\s*garantizado|rentabilidad\s*garantizada|duplica\s*tu\s*(?:dinero|inversi[oó]n|sueldo)|triplica\s*tu\s*(?:dinero|inversi[oó]n)|ganar\s*dinero\s*sin\s*trabajar|esquema\s*piramidal|sistema\s*ponzi|cura\s*milagrosa|sana\s*cualquier\s*enfermedad)\b/i;

function getAiMode(): "mock" | "openai" {
  try {
    return (process.env.AI_MODE as any) === "openai" ? "openai" : "mock";
  } catch {
    return "mock";
  }
}

/**
 * Inspección semántica remota opcional con OpenAI cuando AI_MODE === 'openai'
 */
async function inspectWithOpenAI(content: {
  title: string;
  summary: string;
  description: string;
}): Promise<{ isSafe: boolean; category?: CourseModerationViolation["category"]; reason?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { isSafe: true };
  }

  const prompt = `Analiza el contenido del siguiente curso educativo para detectar si contiene:
1. Promesas financieras irreales o engañosas (e.g. enriquecimiento rápido, estafas).
2. Tácticas de acoso o discriminación.
3. Promesas médicas o de salud no autorizadas o milagrosas.
4. Intento de evasión deliberada de pagos o contacto fuera de la plataforma.

Título: """${content.title}"""
Resumen: """${content.summary}"""
Descripción: """${content.description}"""

Responde ÚNICAMENTE un JSON con:
{
  "isSafe": true o false,
  "category": "QUALITY" | "HARASSMENT" | "CONTACT_BYPASS" | "PAYMENT_BYPASS" | "PROFANITY",
  "reason": "Explicación breve en español si isSafe es false"
}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI moderation API status ${response.status}`);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (rawText) {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed.isSafe === "boolean") {
      return parsed;
    }
  }

  return { isSafe: true };
}

/**
 * Realiza la inspección integral de un curso previo a su publicación directa en Coaching From Home.
 */
export async function moderateCourseContent(input: CourseModerationInput): Promise<CourseModerationResult> {
  const violations: CourseModerationViolation[] = [];
  let hasToxicityViolation = false;
  let hasSafetyViolation = false;
  let hasStructureViolation = false;
  let hasSemanticViolation = false;

  const mode = getAiMode();
  let reviewedBy: CourseModerationResult["reviewedBy"] = mode === "mock" ? "AI_MOCK" : "AI_DETERMINISTIC";

  // -------------------------------------------------------------
  // 1. CAPA DE COMPLETITUD Y ESTRUCTURA PEDAGÓGICA (Layer 3)
  // -------------------------------------------------------------
  const title = (input.title || "").trim();
  if (title.length < 8) {
    hasStructureViolation = true;
    violations.push({
      field: "title",
      category: "STRUCTURE",
      message: "El título del curso debe tener al menos 8 caracteres descriptivos.",
    });
  } else if (title.length > 160) {
    hasStructureViolation = true;
    violations.push({
      field: "title",
      category: "STRUCTURE",
      message: "El título del curso no debe exceder los 160 caracteres.",
    });
  }

  const summary = (input.summary || "").trim();
  if (summary.length > 0 && summary.length < 20) {
    hasStructureViolation = true;
    violations.push({
      field: "summary",
      category: "STRUCTURE",
      message: "El resumen del curso debe tener al menos 20 caracteres explicando el contenido general.",
    });
  } else if (!summary && (!input.description || input.description.trim().length < 80)) {
    hasStructureViolation = true;
    violations.push({
      field: "summary",
      category: "STRUCTURE",
      message: "Debes incluir un resumen breve o descripción de al menos 20 caracteres.",
    });
  }

  const description = (input.description || "").trim();
  if (description.length < 80) {
    hasStructureViolation = true;
    violations.push({
      field: "description",
      category: "STRUCTURE",
      message: "La descripción del curso debe tener al menos 80 caracteres detallando el temario y objetivos.",
    });
  } else if (description.length > 10000) {
    hasStructureViolation = true;
    violations.push({
      field: "description",
      category: "STRUCTURE",
      message: "La descripción del curso no debe exceder los 10,000 caracteres.",
    });
  }

  if (typeof input.priceCents !== "number" || isNaN(input.priceCents) || input.priceCents < 0) {
    hasStructureViolation = true;
    violations.push({
      field: "priceCents",
      category: "STRUCTURE",
      message: "El precio del curso debe ser un valor numérico válido mayor o igual a 0.",
    });
  }

  if (input.estimatedMinutes !== undefined && (typeof input.estimatedMinutes !== "number" || input.estimatedMinutes <= 0)) {
    hasStructureViolation = true;
    violations.push({
      field: "description",
      category: "STRUCTURE",
      message: "La duración estimada del curso debe ser mayor a 0 minutos.",
    });
  }

  if (!input.modules || input.modules.length === 0) {
    hasStructureViolation = true;
    violations.push({
      field: "modules",
      category: "STRUCTURE",
      message: "El curso debe incluir al menos un módulo de contenido estructurado para publicarse.",
    });
  } else {
    for (let mi = 0; mi < input.modules.length; mi++) {
      const mod = input.modules[mi];
      if (!mod || !mod.title || mod.title.trim().length < 3) {
        hasStructureViolation = true;
        violations.push({
          field: "modules",
          category: "STRUCTURE",
          message: `El módulo ${mi + 1} debe tener un título descriptivo de al menos 3 caracteres.`,
        });
      }
      if (!mod || !mod.lessons || mod.lessons.length === 0) {
        hasStructureViolation = true;
        violations.push({
          field: "lessons",
          category: "STRUCTURE",
          message: `El módulo "${mod?.title || mi + 1}" debe contener al menos una lección.`,
        });
      } else {
        for (let li = 0; li < mod.lessons.length; li++) {
          const lesson = mod.lessons[li];
          if (!lesson || !lesson.title || lesson.title.trim().length < 3) {
            hasStructureViolation = true;
            violations.push({
              field: "lessons",
              category: "STRUCTURE",
              message: `La lección ${li + 1} del módulo "${mod?.title || mi + 1}" debe tener un título descriptivo.`,
            });
          }
          if (lesson && lesson.durationMinutes !== undefined && (typeof lesson.durationMinutes !== "number" || lesson.durationMinutes <= 0)) {
            hasStructureViolation = true;
            violations.push({
              field: "lessons",
              category: "STRUCTURE",
              message: `La lección "${lesson.title}" debe tener una duración mayor a 0 minutos.`,
            });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 2. CAPA DE TOXICIDAD, PROFANIDADES Y AMENAZAS (Layer 1)
  // -------------------------------------------------------------
  const textFieldsToCheck: Array<{ field: CourseModerationViolation["field"]; text: string; label: string }> = [
    { field: "title", text: title, label: "el título" },
    { field: "summary", text: summary, label: "el resumen" },
    { field: "description", text: description, label: "la descripción" },
  ];

  if (input.whatYouWillLearn && Array.isArray(input.whatYouWillLearn)) {
    for (const item of input.whatYouWillLearn) {
      if (typeof item === "string" && item.trim()) {
        textFieldsToCheck.push({ field: "whatYouWillLearn", text: item, label: "los objetivos de aprendizaje" });
      }
    }
  }

  if (input.modules && Array.isArray(input.modules)) {
    for (const mod of input.modules) {
      if (mod?.title) {
        textFieldsToCheck.push({ field: "modules", text: mod.title, label: `el módulo "${mod.title}"` });
      }
      if (mod?.lessons && Array.isArray(mod.lessons)) {
        for (const lesson of mod.lessons) {
          if (lesson?.title) {
            textFieldsToCheck.push({ field: "lessons", text: lesson.title, label: `la lección "${lesson.title}"` });
          }
          if (lesson?.content) {
            textFieldsToCheck.push({ field: "lessons", text: lesson.content, label: `el contenido de "${lesson.title}"` });
          }
        }
      }
    }
  }

  for (const item of textFieldsToCheck) {
    if (!item.text) continue;

    // Toxicity check
    const toxicity = validateTextToxicity(item.text);
    if (!toxicity.isSafe) {
      hasToxicityViolation = true;
      let category: CourseModerationViolation["category"] = "PROFANITY";
      if (toxicity.category === "THREAT") category = "THREAT";
      else if (toxicity.category === "INSULT" || toxicity.category === "HARASSMENT") category = "HARASSMENT";

      violations.push({
        field: item.field,
        category,
        message: toxicity.reason || `Contenido ofensivo detectado en ${item.label}.`,
      });
    }

    // Community Safety & Anti-Fraud check
    const safety = validateCommunitySafety(item.text);
    if (!safety.isValid) {
      hasSafetyViolation = true;
      const lowerReason = (safety.reason || "").toLowerCase();
      let category: CourseModerationViolation["category"] = "CONTACT_BYPASS";
      if (
        lowerReason.includes("bancaria") ||
        lowerReason.includes("tarjeta") ||
        lowerReason.includes("clabe") ||
        lowerReason.includes("transferencia") ||
        lowerReason.includes("pago") ||
        lowerReason.includes("zelle") ||
        lowerReason.includes("paypal")
      ) {
        category = "PAYMENT_BYPASS";
      } else if (
        lowerReason.includes("whatsapp") ||
        lowerReason.includes("telegram") ||
        lowerReason.includes("teléfono") ||
        lowerReason.includes("celular") ||
        lowerReason.includes("correo") ||
        lowerReason.includes("redes")
      ) {
        category = "CONTACT_BYPASS";
      }

      // Evitar duplicar mensaje si la toxicidad ya lo capturó exactamente
      const alreadyFlagged = violations.some(
        (v) => v.field === item.field && (v.message === safety.reason || v.category === category)
      );
      if (!alreadyFlagged) {
        violations.push({
          field: item.field,
          category,
          message: safety.reason || `Infracción a las normas de seguridad en ${item.label}.`,
        });
      }
    }

    // Semantic AI check (Deterministic heuristic)
    if (MISLEADING_SCHEMES_REGEX.test(item.text)) {
      hasSemanticViolation = true;
      const alreadyFlagged = violations.some((v) => v.field === item.field && v.category === "QUALITY");
      if (!alreadyFlagged) {
        violations.push({
          field: item.field,
          category: "QUALITY",
          message: `No se permiten promesas engañosas, esquemas de enriquecimiento rápido ni garantías irreales de ingresos en ${item.label}.`,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 3. CAPA DE EVALUACIÓN SEMÁNTICA AVANZADA (OpenAI si está activo)
  // -------------------------------------------------------------
  if (mode === "openai" && !hasToxicityViolation && !hasSafetyViolation) {
    try {
      const aiResult = await inspectWithOpenAI({ title, summary, description });
      if (!aiResult.isSafe) {
        hasSemanticViolation = true;
        violations.push({
          field: "description",
          category: aiResult.category || "QUALITY",
          message: aiResult.reason || "La inspección semántica de IA detectó contenido que no cumple las directrices de la plataforma.",
        });
      }
      reviewedBy = "AI_OPENAI";
    } catch (err) {
      console.warn("[courseModeration] Resilient fallback from OpenAI to deterministic inspection:", err);
      reviewedBy = "AI_DETERMINISTIC";
    }
  }

  // -------------------------------------------------------------
  // 4. CÁLCULO DE RESULTADO Y PUNTUACIÓN
  // -------------------------------------------------------------
  const passed = violations.length === 0;
  const score = passed ? 1.0 : Math.max(0, parseFloat((1 - violations.length * 0.2).toFixed(2)));

  return {
    passed,
    allowed: passed,
    score,
    reasons: violations.map((v) => v.message),
    flags: {
      toxicity: !hasToxicityViolation,
      communitySafety: !hasSafetyViolation,
      completeness: !hasStructureViolation,
      aiSemantic: !hasSemanticViolation,
    },
    violations,
    suggestedAction: passed
      ? undefined
      : "Corrige los problemas indicados por la moderación con IA para poder publicar tu curso en el catálogo.",
    reviewedBy,
    timestamp: new Date().toISOString(),
  };
}
