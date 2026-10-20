/**
 * Utilidades de traduccion para contenido dinamico y semi-dinamico.
 */

export function translateCategory(catName: string, t: any): string {
  if (!catName) return "";
  const key = catName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const categoryAliases: Record<string, string> = {
    "psicologia_bienestar": "psicologia_y_bienestar",
    "ingles_idiomas": "ingles_e_idiomas",
    "desarrollo_personal": "desarrollo_personal",
    "diseno_ui_ux": "diseno",
    "tecnologia_programacion": "tecnologia",
  };
  const resolvedKey = categoryAliases[key] || key;
  // If missing, use fallback
  try {
    return t("Categories." + resolvedKey, catName);
  } catch(e) { return catName; }
}

export function translateCoachName(name: string, t: any): string {
  if (!name) return "";
  const match = name.match(/^Coach Experto (\d+)$/i);
  if (match) {
    try {
      const res = t("SampleCoaches.coach_expert", { n: match[1] || "" });
      if (res && res !== "SampleCoaches.coach_expert") return res;
    } catch(e) {}
    try {
      return t("SampleCoaches.coach_name", { n: match[1] || "" }, "Coach Experto " + match[1]);
    } catch(e) { return "Coach Experto " + match[1]; }
  }
  return name;
}

export function translateCoachHeadline(headline: string, t: any): string {
  if (!headline) return "Coach";
  const match = headline.match(/^Experto en (.+)$/i);
  if (match) {
    const rawTopic = match[1]?.trim() || "";
    const key = rawTopic.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    let translatedTopic = rawTopic;
    try { translatedTopic = t("SampleCoaches.topics." + key, rawTopic); } catch(e) {}
    try {
      return t("SampleCoaches.expert_in", { topic: translatedTopic }, "Experto en " + translatedTopic);
    } catch(e) { return "Experto en " + translatedTopic; }
  }

  const key = headline.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  try { return t("Headlines." + key, headline); } catch(e) { return headline; }
}

export function translateCoachBio(bio: string, translatedName: string, t: any): string {
  if (!bio) return "";
  const match = bio.match(/^Soy el Coach Experto (\d+),/i);
  if (match) {
    try {
      return t(
        "SampleCoaches.bio",
        { coachName: translatedName, n: match[1] || "" },
        "Soy el " + translatedName + ", especializado en enseñar y mentorizar a profesionales que buscan subir al siguiente nivel."
      );
    } catch(e) { return "Soy el " + translatedName + ", especializado en enseñar y mentorizar a profesionales que buscan subir al siguiente nivel."; }
  }

  const bioKey = bio.slice(0, 40).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  try { return t("Bios." + bioKey, bio); } catch(e) { return bio; }
}

export function translateCourseTitle(id: string, title: string, t: any): string {
  if (!title) return "";
  if (id && id.startsWith("sample-")) {
    try { return t("SampleCourses." + id + ".title", title); } catch(e) { return title; }
  }
  const key = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  try { return t("CourseTitles." + key, title); } catch(e) { return title; }
}

export function translateReviewDate(dateStr: string, locale: string, t: any): string {
  if (!dateStr) return "";
  try {
    if (dateStr.includes("3 d") || dateStr.toLowerCase().includes("days")) return t("CoachProfile.time_3_days_ago", "Hace 3 dias");
    if (dateStr.includes("2 sem") || dateStr.toLowerCase().includes("weeks")) return t("CoachProfile.time_2_weeks_ago", "Hace 2 semanas");
    if (dateStr.includes("1 mes") || dateStr.toLowerCase().includes("month")) return t("CoachProfile.time_1_month_ago", "Hace 1 mes");
  } catch(e) {}
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    try { return new Intl.DateTimeFormat(locale.toLowerCase(), { year: "numeric", month: "short", day: "numeric" }).format(parsed); } catch { return dateStr; }
  }
  return dateStr;
}

const clientTranslationCache = new Map<string, string>();
export async function fetchDynamicTranslation(text: string, targetLocale: string, sourceLocale: string = "es"): Promise<string> {
  if (!text || !text.trim()) return text;
  const target = targetLocale.toLowerCase();
  const source = sourceLocale.toLowerCase();
  if (target === source) return text;
  const cacheKey = source + ":" + target + ":" + text.trim();
  if (clientTranslationCache.has(cacheKey)) return clientTranslationCache.get(cacheKey)!;
  try {
    const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, target, source }) });
    if (res.ok) {
      const data = await res.json();
      if (data?.translatedText) { clientTranslationCache.set(cacheKey, data.translatedText); return data.translatedText; }
    }
  } catch (err) {}
  return text;
}
