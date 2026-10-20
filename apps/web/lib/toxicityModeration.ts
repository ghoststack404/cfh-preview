/**
 * Motor de Moderación de Toxicidad y Lenguaje Ofensivo
 * Coaching From Home
 * 
 * Detecta:
 * 1. Groserías, obscenidades y lenguaje soez (Español LATAM/México/España e Inglés).
 * 2. Agravios, insultos directos, humillaciones y discriminación.
 * 3. Violencia verbal, amenazas y hostigamiento.
 * 4. Técnicas de evasión: leetspeak (p3nd3jo, v3rg4), símbolos intercalados (p*ndejo, p.e.n.d.e.j.o) y repetición de letras.
 * 5. Soporte híbrido opcional con Gemini AI si existe clave de API.
 */

export interface ToxicityValidationResult {
  isSafe: boolean;
  reason?: string;
  matchedTerm?: string;
  category?: "PROFANITY" | "INSULT" | "THREAT" | "HARASSMENT" | "NONE";
}

// Palabras educativas o normales que contienen fragmentos que podrían parecer groserías (Whitelisting de falsos positivos)
const SAFE_WHITELIST = new Set([
  "disputa",
  "disputar",
  "computadora",
  "computador",
  "computo",
  "computacion",
  "computación",
  "instituto",
  "sustituto",
  "constitucion",
  "constitución",
  "reputacion",
  "reputación",
  "analisis",
  "análisis",
  "analista",
  "analitica",
  "canalizar",
  "asistente",
  "asistencia",
  "asistir",
  "clase",
  "clases",
  "clasico",
  "clasificación",
  "curso",
  "cursos",
  "curriculum",
  "experto",
  "contacto",
  "contactar",
]);

// Diccionario de términos ofensivos principales (en su raíz / forma canónica sin tildes)
const SEVERE_PROFANITIES = [
  // Derivados de chingar
  "chingar", "chingada", "chingado", "chingados", "chingadas", "chingadera", "chingaderas",
  "chingon", "chingona", "chingones", "chingonas", "chingue", "chingues", "chingan",
  "chinge", "chingatumadre", "chinga tu madre", "chingamadre",
  // Derivados de pendejo
  "pendejo", "pendeja", "pendejos", "pendejas", "pendejada", "pendejadas", "pendejisimo",
  // Derivados de puta/puto y sustituciones clásicas (pvta, pvto, etc.)
  "puta", "puto", "putas", "putos", "putero", "putiza", "putisima", "putisimo",
  "pvta", "pvto", "pvtas", "pvtos", "pvte", "pvtada", "pvtadas", "pvtazo", "pvtazos", "pvterio", "pvtero", "pvteza",
  "hijo de puta", "hija de puta", "hijueputa", "hdp", "hdpvta", "hijodepvta", "hijadepvta",
  // Derivados de cabrón y sustituciones
  "cabron", "cabrona", "cabrones", "cabronas", "cabronada", "cabronadas", "kbron", "cavron", "cavrona",
  // Derivados de verga y sustituciones (uerga, berga)
  "verga", "vergas", "vergazo", "vergazos", "valeverga", "vale verga", "valiendo verga",
  "vete a la verga", "vete a la vrga", "vrga", "berga", "bergas", "uerga", "uergas", "ualeverga", "baleverga",
  // Términos vulgares / sexuales explícitos y sustituciones
  "pito", "pitos", "culo", "culos", "culero", "culeros", "culera", "culeras", "culerada",
  "cvlo", "cvlos", "cvlero", "cvleros", "cvlera", "cvleras", "cvlerada",
  "chvpa", "chvpar", "chvpada", "chvpala", "chvpenla",
  "mierda", "mierdas", "come mierda", "comemierda", "caca",
  "mamada", "mamadas", "mamon", "mamona", "mamones", "mamadas",
  "coño", "coños", "coñazo", "joder", "jodete", "jodanse", "jodido", "jodida",
  "zorra", "zorras", "perra", "perras",
  "malparido", "malparida", "malparidos", "conchetumadre", "chucha", "carechimba", "gonorrea",
  // Pinche cuando se usa despectivamente
  "pinche", "pinches",
];

// Acrónimos vulgares y expresiones abreviadas/simplificadas comunes en LATAM y México
export const VULGAR_ACRONYMS = [
  // A la verga y derivados
  "alv", "a l v", "vtlv", "vlv", "valv",
  // Puta madre y derivados
  "ptm", "p t m", "lptm", "lpm", "lpqtp", "rpqtp",
  // Hijo de tu / su puta madre
  "hdtp", "hdtpm", "hdspm", "hdp", "hdtm",
  // Chinga tu madre / puta madre
  "chpm", "chptm", "chm",
  // Concha tu madre / conchetumadre
  "ctm", "cdtm", "csm", "cdsm", "rctm",
  // Abreviaciones de verga, pendejo, cabrón, mierda, culo, etc.
  "vrg", "vrga", "vrgas", "brga", "vga",
  "pndjo", "pndja", "pndjos", "pndjas", "pdjo", "pdja",
  "cbrn", "kbrn",
  "mrda", "mrd",
  "qlo", "klo",
  // No mames / mamadas
  "nmms", "nmmes", "no mms",
  "mmda", "mmdas", "mmdn",
  // Abreviaciones en inglés
  "wtf", "stfu",
];

const SEVERE_INSULTS = [
  // Insultos denigrantes y agravios
  "estupido", "estupida", "estupidos", "estupidas", "estupidez",
  "idiota", "idiotas", "idiotez",
  "imbecil", "imbeciles",
  "tarado", "tarada", "tarados", "taradas",
  "retrasado", "retrasada", "retrasados", "retrasadas", "retrasado mental",
  "bastardo", "bastarda", "bastardos",
  "muerto de hambre", "muerta de hambre",
  "basura humana", "pedazo de mierda",
  "inutil", "inutiles", "escoria", "lacra", "mugroso", "mugrosa",
  "subnormal",
];

const SEVERE_THREATS = [
  // Amenazas y violencia verbal directa
  "te voy a matar", "te voy a golpear", "te voy a partir",
  "te vas a morir", "muerete", "matate", "suicidate",
  "te voy a romper", "te voy a reventar", "te vas a chingar",
  "ojala te mueras", "ojalá te mueras",
];

const ENGLISH_PROFANITIES = [
  "fuck", "fucking", "fucker", "motherfucker", "motherfucking",
  "shit", "bullshit", "bitch", "bitches",
  "asshole", "assholes", "cunt", "cunts",
  "dick", "dicks", "pussy", "pussies",
  "nigger", "faggot", "retard",
];

/**
 * Normaliza el texto para neutralizar técnicas comunes de evasión:
 * - Leetspeak (@->a, 3->e, 1->i, 0->o, 5->s, 7->t, etc.)
 * - Tildes y diacríticos
 * - Signos intermedios y separadores (*, _, ., -, espacios repetidos)
 * - Letras repetidas exageradas (peeeendejo -> pendejo)
 */
export function normalizeTextForModeration(input: string): string {
  if (!input) return "";

  let text = input.toLowerCase();

  // 1. Quitar tildes
  text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 2. Mapeo de Leetspeak común
  text = text
    .replace(/@/g, "a")
    .replace(/4/g, "a")
    .replace(/3/g, "e")
    .replace(/1/g, "i")
    .replace(/!/g, "i")
    .replace(/\|/g, "i")
    .replace(/0/g, "o")
    .replace(/5/g, "s")
    .replace(/\$/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b");

  // 3. Reemplazo de 'v' usada como vocal 'u' entre dos consonantes (ej: pvta -> puta, cvlo -> culo, chvpa -> chupa, estvpido -> estupido)
  text = text.replace(/([bcdfghjklmnñpqrstvwxyz])v([bcdfghjklmnñpqrstvwxyz])/g, "$1u$2");

  // 4. Colapsar caracteres repetidos consecutivos a máximo 1 (ej: "peeeeendejoooo" -> "pendejo")
  text = text.replace(/(.)\1{2,}/g, "$1");

  return text;
}

/**
 * Construye una versión colapsada que junta letras separadas por espacios o asteriscos
 * Ejemplo: "p * n d e j o" o "p.e.n.d.e.j.o" -> "pndejo"
 */
function buildCompressedTokens(text: string): string {
  // Reemplazar caracteres especiales intermedios
  const clean = text.replace(/[*_.~,;:\-\\/#+]/g, "");
  // Si hay letras sueltas separadas por espacios: "p e n d e j o"
  const collapsed = clean.replace(/\b([a-z])\s+(?=[a-z]\b)/g, "$1");
  // Aplicar normalización de 'v' entre consonantes
  return collapsed.replace(/([bcdfghjklmnñpqrstvwxyz])v([bcdfghjklmnñpqrstvwxyz])/g, "$1u$2");
}

/**
 * Valida un texto frente a las reglas comunitarias contra lenguaje ofensivo, obsceno o agravios.
 */
export function validateTextToxicity(rawText: string): ToxicityValidationResult {
  if (!rawText || typeof rawText !== "string") {
    return { isSafe: true, category: "NONE" };
  }

  const normalized = normalizeTextForModeration(rawText);
  const compressed = buildCompressedTokens(normalized);

  // 1. Verificar amenazas verbales
  for (const threat of SEVERE_THREATS) {
    const normThreat = normalizeTextForModeration(threat);
    if (normalized.includes(normThreat) || compressed.includes(normThreat)) {
      return {
        isSafe: false,
        category: "THREAT",
        matchedTerm: threat,
        reason: "Por seguridad de la comunidad, no se toleran expresiones de violencia, intimidación o amenazas.",
      };
    }
  }

  // 2. Lista combinada de groserías, insultos y acrónimos vulgares simplificados
  const allTerms: { list: string[]; category: "PROFANITY" | "INSULT" }[] = [
    { list: SEVERE_PROFANITIES, category: "PROFANITY" },
    { list: VULGAR_ACRONYMS, category: "PROFANITY" },
    { list: SEVERE_INSULTS, category: "INSULT" },
    { list: ENGLISH_PROFANITIES, category: "PROFANITY" },
  ];

  // Tokenización de palabras
  const tokens = normalized.split(/[\s,.;:!?_()\-[\]{}"'`<>/\\]+/).filter(Boolean);
  const compressedTokens = compressed.split(/[\s,.;:!?_()\-[\]{}"'`<>/\\]+/).filter(Boolean);
  const combinedTokens = Array.from(new Set([...tokens, ...compressedTokens]));

  for (const token of combinedTokens) {
    if (SAFE_WHITELIST.has(token)) continue;
    const dedupedToken = token.replace(/(.)\1+/g, "$1");
    if (SAFE_WHITELIST.has(dedupedToken)) continue;

    for (const group of allTerms) {
      for (const term of group.list) {
        // Coincidencia exacta, coincidencia de token desduplicado o de raíz clara
        if (
          token === term ||
          dedupedToken === term ||
          (token.length >= 4 && term.length >= 4 && (token.startsWith(term) || token.endsWith(term))) ||
          (dedupedToken.length >= 4 && term.length >= 4 && (dedupedToken.startsWith(term) || dedupedToken.endsWith(term)))
        ) {
          if (SAFE_WHITELIST.has(token) || SAFE_WHITELIST.has(dedupedToken)) continue;

          return {
            isSafe: false,
            category: group.category,
            matchedTerm: term,
            reason: group.category === "PROFANITY"
              ? "Tu publicación contiene palabras altisonantes, obscenas o abreviaciones ofensivas (como alv, ptm, hdtp). Ayúdanos a mantener un espacio respetuoso y profesional."
              : "Tu mensaje contiene insultos o expresiones despectivas hacia otros miembros de la comunidad.",
          };
        }
      }
    }
  }

  // Búsqueda en frases completas para términos compuestos (ej. "chinga tu madre", "muerto de hambre", "vale verga", "a la verga")
  const fullTextVariants = [normalized, compressed];
  for (const group of allTerms) {
    for (const term of group.list) {
      if (term.includes(" ")) {
        for (const variant of fullTextVariants) {
          if (variant.includes(term)) {
            return {
              isSafe: false,
              category: group.category,
              matchedTerm: term,
              reason: group.category === "PROFANITY"
                ? "Tu mensaje contiene expresiones obscenas, altisonantes o abreviaciones no permitidas en Coaching From Home."
                : "Tu mensaje contiene ofensas o agravios personales dirigidos a miembros de la comunidad.",
            };
          }
        }
      }
    }
  }

  // Patrones Regex estrictos para evasiones complejas con asteriscos o acrónimos simplificados (ej: alv, ptm, hdtp, p*ndejo, p*ta, v*rga)
  const evasionRegexes = [
    /\bp+[\W_]*[e3*]?[\W_]*n+[\W_]*d+[\W_]*[e3*]?[\W_]*j+[\W_]*[o0a@*e3]/i,     // pendejo/a/e
    /(?:\b|hij[oa]s?(?:de)?|hiju?e?)p+[\W_]*[uvw\d*]+[\W_]*t+[\W_]*[o0a@*e34]/i, // puta, puto, pvta, pvto, pvt4, etc.
    /\b[vbu]+[\W_]*[e3*]?[\W_]*r+[\W_]*g+[\W_]*[a@*o0]/i,                        // verga, berga, uerga, vrga, v3rg4
    /\b[ckq]+[\W_]*[uvw\d*]+[\W_]*l+[\W_]*[o0a@*e34]/i,                          // culo, cvlo, etc.
    /\bm+[\W_]*[i1*]?[\W_]*[e3*]?[\W_]*r+[\W_]*d+[\W_]*[a@*o0]/i,                // mierda
    /\b[ck]+[\W_]*[a@*4]?[\W_]*[bv]+[\W_]*r+[\W_]*[o0*]?[\W_]*n/i,              // cabron, cavron, kbron
    /\b(?:ch|[x]|sh)+[\W_]*[i1*]?[\W_]*n+[\W_]*g/i,                               // chingar / chinga / xinga
    /\bc[\W_]*[uv*]?[\W_]*l[\W_]*[e3*]?[\W_]*r[\W_]*[o0a@*]/i,                  // culero/a, cvlero/a

    // Acrónimos vulgares y expresiones simplificadas (alv, ptm, hdtp, etc.)
    /\b[a@4]+[\W_]*l+[\W_]*v+\b/i,                       // alv, a.l.v, a_l_v, a l v, alvv
    /\bp+[\W_]*t+[\W_]*m+\b/i,                           // ptm, p.t.m, p_t_m, p t m, ptmm
    /\bl+[\W_]*p+[\W_]*t+[\W_]*m+\b/i,                   // lptm
    /\bl+[\W_]*p+[\W_]*m+\b/i,                           // lpm
    /\bh+[\W_]*d+[\W_]*[ts]+[\W_]*p+[\W_]*m*\b/i,       // hdtp, hdtpm, hdspm
    /\bc+[\W_]*h+[\W_]*p+[\W_]*t*[\W_]*m+\b/i,           // chpm, chptm
    /\bc+[\W_]*[dt]?[\W_]*[ts]+[\W_]*m+\b/i,             // ctm, cdtm, csm, cdsm
    /\bv+[\W_]*[tl]+[\W_]*v+\b/i,                        // vlv, vtlv
    /\bl+[\W_]*p+[\W_]*q+[\W_]*t+[\W_]*p+\b/i,           // lpqtp
    /\bv+[\W_]*r+[\W_]*g+[as]*\b/i,                      // vrg, vrga, vrgas
    /\bp+[\W_]*n+[\W_]*d+[\W_]*j+[oa0@]*s*\b/i,          // pndjo, pndja
    /\bn+[\W_]*m+[\W_]*m+[\W_]*[es]*\b/i,                // nmms, nmmes
  ];

  for (const regex of evasionRegexes) {
    const rawMatch = regex.exec(rawText);
    const normMatch = regex.exec(normalized);
    const match = rawMatch || normMatch;

    if (match) {
      const matchText = match[0].toLowerCase();
      // Si el match exacto o desduplicado es una palabra de la lista segura, lo ignoramos
      if (SAFE_WHITELIST.has(matchText) || SAFE_WHITELIST.has(matchText.replace(/(.)\1+/g, "$1"))) {
        continue;
      }

      // Verificar si el match cae dentro de una palabra segura en el texto original
      const targetText = rawMatch ? rawText.toLowerCase() : normalized;
      const matchIdx = match.index;
      const matchEnd = matchIdx + match[0].length;

      let isInsideWhitelist = false;
      for (const safe of SAFE_WHITELIST) {
        let searchIdx = 0;
        while ((searchIdx = targetText.indexOf(safe, searchIdx)) !== -1) {
          const safeEnd = searchIdx + safe.length;
          if (matchIdx >= searchIdx && matchEnd <= safeEnd) {
            isInsideWhitelist = true;
            break;
          }
          searchIdx += 1;
        }
        if (isInsideWhitelist) break;
      }

      if (!isInsideWhitelist) {
        return {
          isSafe: false,
          category: "PROFANITY",
          matchedTerm: match[0],
          reason: "Tu mensaje contiene expresiones obscenas, abreviaciones altisonantes (como alv, ptm, hdtp) o intento de evasión de las normas de la comunidad.",
        };
      }
    }
  }

  return { isSafe: true, category: "NONE" };
}

/**
 * Moderación Semántica Asíncrona con Gemini AI (Opcional si hay API Key disponible)
 * Complementa el motor determinista para analizar sarcasmo dañino o acoso sutil.
 */
export async function evaluateToxicityWithAI(text: string): Promise<ToxicityValidationResult> {
  // Primero ejecutar el filtro local ultrarrápido
  const localCheck = validateTextToxicity(text);
  if (!localCheck.isSafe) {
    return localCheck;
  }

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    return { isSafe: true, category: "NONE" };
  }

  try {
    const prompt = `Eres el moderador de seguridad de una plataforma educativa donde conviven estudiantes, menores y profesores.
Analiza el siguiente texto y determina si contiene:
1. Groserías u obscenidades
2. Insultos o agravios hacia otra persona
3. Acoso, humillación o intimidación
4. Amenazas de violencia

Texto a evaluar: """${text}"""

Responde ÚNICAMENTE un JSON con este formato:
{
  "isSafe": true o false,
  "category": "PROFANITY" | "INSULT" | "THREAT" | "HARASSMENT" | "NONE",
  "reason": "Explicación breve y respetuosa en español del rechazo (solo si isSafe es false)"
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const outputText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (outputText) {
        const parsed = JSON.parse(outputText);
        if (parsed && typeof parsed.isSafe === "boolean") {
          return {
            isSafe: parsed.isSafe,
            category: parsed.category || (parsed.isSafe ? "NONE" : "INSULT"),
            reason: parsed.reason || "El contenido no cumple con las normas de convivencia respetuosa.",
          };
        }
      }
    }
  } catch (err) {
    console.warn("Error en evaluación semántica con Gemini AI:", err);
  }

  return { isSafe: true, category: "NONE" };
}
