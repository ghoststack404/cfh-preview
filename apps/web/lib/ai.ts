import type { AiArtifactType, UserRole } from "@prisma/client";
import { env, requireIntegration } from "@/lib/env";

const labels: Record<AiArtifactType, string> = {
  TASK_PLAN: "Plan de tareas",
  STUDY_PLAN: "Plan de estudio",
  SESSION_SUMMARY: "Resumen de sesión",
  EMOTIONAL_INSIGHTS: "Observaciones emocionales",
  MARKETING_POST: "Publicación comercial",
  AUTO_REPLY: "Respuesta sugerida"
};

const formatRules: Record<AiArtifactType, string> = {
  TASK_PLAN: "Incluye objetivo, criterios de éxito, tareas priorizadas, calendario de 7 días, obstáculos previsibles y una revisión final.",
  STUDY_PLAN: "Incluye diagnóstico inicial, meta medible, ruta por semanas, práctica diaria, recursos sugeridos sin inventar enlaces y forma de evaluar avance.",
  SESSION_SUMMARY: "Incluye contexto, temas tratados, avances, acuerdos, tareas, riesgos, preguntas para la próxima sesión y un cierre cálido.",
  EMOTIONAL_INSIGHTS: "Separa hechos observables, hipótesis prudentes, preguntas de validación y apoyos posibles. No diagnostiques ni etiquetes a la persona.",
  MARKETING_POST: "Entrega un texto humano, un título, cuerpo, llamada a la acción, tres variantes cortas y cinco hashtags sobrios. No hagas promesas garantizadas.",
  AUTO_REPLY: "Redacta una respuesta empática y concreta, resume la necesidad, plantea dos preguntas útiles y propone el siguiente paso dentro de la plataforma."
};

function topic(prompt: string) {
  return prompt.trim().replace(/\s+/g, " ").slice(0, 900);
}

function mockResult(type: AiArtifactType, prompt: string, role: UserRole) {
  const subject = topic(prompt);
  const roleLine = role === "COACH" ? "Pensado para que lo adaptes a tu voz como coach." : "Pensado para que puedas seguirlo sin sentir que es una lista imposible.";
  const templates: Record<AiArtifactType, string> = {
    TASK_PLAN: `PLAN DE TAREAS\n\nContexto\n${subject}\n\nObjetivo de esta semana\nTransformar la meta en un resultado visible y pequeño. ${roleLine}\n\nCriterios de éxito\n- Existe una entrega concreta, no solo tiempo invertido.\n- El avance puede revisarse en menos de 10 minutos.\n- La carga diaria se mantiene realista.\n\nPlan de 7 días\nDía 1: definir el resultado y eliminar lo que no sea prioritario.\nDía 2: reunir información y preparar materiales.\nDía 3: crear una primera versión sin buscar perfección.\nDía 4: pedir o simular retroalimentación.\nDía 5: corregir el punto de mayor impacto.\nDía 6: probar el resultado en una situación real.\nDía 7: revisar, registrar lo aprendido y decidir el siguiente paso.\n\nObstáculos previsibles\n- Querer resolver todo de una vez: limita la sesión a una sola prioridad.\n- Falta de tiempo: usa bloques de 25 minutos.\n- Bloqueo o inseguridad: empieza con una versión deliberadamente sencilla.\n\nCierre de revisión\n¿Qué cambió, qué sigue igual y qué harás diferente la próxima semana?`,
    STUDY_PLAN: `PLAN DE ESTUDIO\n\nMeta\n${subject}\n\nPunto de partida\nAntes de comenzar, escribe qué ya sabes, qué te cuesta y qué evidencia demostraría que aprendiste.\n\nRuta de 4 semanas\nSemana 1 — Fundamentos: conceptos esenciales y ejemplos guiados.\nSemana 2 — Práctica: ejercicios cortos con retroalimentación inmediata.\nSemana 3 — Aplicación: un caso o proyecto pequeño conectado con tu meta.\nSemana 4 — Integración: explicar lo aprendido, corregir huecos y cerrar con una entrega.\n\nRutina sugerida\n- 10 min de repaso.\n- 25 min de práctica activa.\n- 10 min para registrar errores y dudas.\n- 5 min para elegir el siguiente ejercicio.\n\nEvaluación\nAl final de cada semana, intenta resolver una tarea sin ayuda y explica tu proceso en voz alta. Si no puedes explicarlo, vuelve al concepto que faltó en lugar de repetir todo.`,
    SESSION_SUMMARY: `RESUMEN DE SESIÓN\n\nContexto compartido\n${subject}\n\nTemas principales\n1. La prioridad que la persona quiere resolver.\n2. Los obstáculos que están frenando el avance.\n3. Las acciones que sí son posibles antes de la siguiente sesión.\n\nAvances observados\n- Se identificó una meta más concreta.\n- Se distinguieron hechos de interpretaciones.\n- Se acordó trabajar con pasos medibles.\n\nAcuerdos\n- Completar una acción prioritaria.\n- Registrar dudas, resultados y emociones relevantes.\n- Revisar el avance antes de la próxima sesión.\n\nPreguntas para la próxima conversación\n- ¿Qué acción produjo el mayor cambio?\n- ¿Dónde apareció resistencia o confusión?\n- ¿Qué apoyo facilitaría continuar?\n\nNota\nEste resumen organiza lo conversado; debe revisarse con la persona para confirmar que representa correctamente su experiencia.`,
    EMOTIONAL_INSIGHTS: `OBSERVACIONES EMOCIONALES PRUDENTES\n\nMaterial analizado\n${subject}\n\nHechos observables\n- El texto describe una situación que parece importante para la persona.\n- Hay referencias a esfuerzo, dudas y deseo de avanzar.\n- No hay información suficiente para concluir causas clínicas.\n\nHipótesis que conviene validar\nPodría existir frustración, presión o cansancio, pero estas son posibilidades y no diagnósticos. La interpretación correcta debe confirmarse preguntando directamente.\n\nPreguntas útiles\n- ¿Qué parte de esta situación te pesa más hoy?\n- ¿Qué emoción reconoces tú, con tus propias palabras?\n- ¿Qué necesitarías para sentir un poco más de claridad o seguridad?\n- ¿Hay algo que no quieras trabajar todavía?\n\nApoyos posibles\nValidar la experiencia, bajar el ritmo, elegir una sola prioridad y acordar límites claros. Si aparecen señales de riesgo o sufrimiento intenso, corresponde recomendar apoyo profesional apropiado.`,
    MARKETING_POST: `TÍTULO\nAvanzar desde casa también puede sentirse acompañado\n\nPUBLICACIÓN\n${subject}\n\nNo necesitas tener todo resuelto para empezar. Una buena sesión de coaching puede ayudarte a ordenar la meta, convertirla en decisiones pequeñas y mantener un seguimiento que sí se adapte a tu vida. En Coaching From Home puedes conocer al coach, revisar su experiencia y reservar una primera conversación dentro de un entorno seguro.\n\nLLAMADA A LA ACCIÓN\nConoce el perfil y reserva tu sesión dentro de Coaching From Home.\n\nVARIANTES CORTAS\n1. Menos presión, más claridad y un siguiente paso real.\n2. Tu meta puede empezar con una conversación de 15 minutos.\n3. Acompañamiento humano, desde casa y a tu ritmo.\n\nHASHTAGS\n#CoachingFromHome #DesarrolloPersonal #Aprendizaje #MetasClaras #CoachingOnline`,
    AUTO_REPLY: `Hola, gracias por contarme lo que estás buscando. Entiendo que quieres trabajar en: ${subject}\n\nPara orientarte mejor, me ayudaría saber dos cosas:\n1. ¿Qué resultado concreto te gustaría conseguir primero?\n2. ¿Qué has intentado hasta ahora y dónde sentiste el mayor bloqueo?\n\nPodemos comenzar con una sesión breve para aclarar la meta y decidir si mi enfoque encaja contigo. Para mantener la reserva, el seguimiento y las garantías, continuemos la conversación y el pago dentro de Coaching From Home.`
  };
  return templates[type];
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return "";
  const parts: string[] = [];
  for (const item of record.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const text = (block as Record<string, unknown>).text;
      if (typeof text === "string") parts.push(text);
    }
  }
  return parts.join("\n").trim();
}

export async function generateAiArtifact(input: { type: AiArtifactType; prompt: string; role: UserRole }) {
  const config = env();
  if (config.AI_MODE === "mock") {
    return { content: mockResult(input.type, input.prompt, input.role), provider: "mock", model: "cfh-local-rich-template-v2", inputTokens: 0, outputTokens: 0 };
  }
  requireIntegration(["OPENAI_API_KEY"], "OpenAI");
  const instructions = [
    "Eres Coach Assistant AI de Coaching From Home.",
    "Responde en español natural, cálido y profesional, sin sonar genérico ni robótico.",
    "No inventes datos, testimonios, certificaciones, enlaces ni resultados garantizados.",
    "No hagas diagnósticos médicos, psicológicos, legales o financieros.",
    "Cuando falte información, dilo y formula preguntas útiles en lugar de asumir.",
    `El usuario solicita: ${labels[input.type]}.`,
    formatRules[input.type],
    "Usa títulos claros, pasos accionables, criterios medibles y suficiente detalle para que el resultado sea útil por sí solo."
  ].join(" ");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.OPENAI_MODEL,
      reasoning: { effort: config.OPENAI_REASONING_EFFORT },
      instructions,
      input: input.prompt,
      max_output_tokens: config.OPENAI_MAX_OUTPUT_TOKENS
    })
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI respondió ${response.status}: ${message.slice(0, 500)}`);
  }
  const payload = await response.json() as Record<string, unknown>;
  const usage = payload.usage as Record<string, number> | undefined;
  const content = extractOutputText(payload);
  if (!content) throw new Error("OpenAI no devolvió contenido utilizable.");
  return { content, provider: "openai", model: config.OPENAI_MODEL, inputTokens: usage?.input_tokens ?? 0, outputTokens: usage?.output_tokens ?? 0 };
}
