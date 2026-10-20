import { NextRequest, NextResponse } from "next/server";

// Caché en memoria para evitar llamadas redundantes a la misma cadena e idioma
const translationCache = new Map<string, string>();

function getCacheKey(text: string, source: string, target: string): string {
  return `${source}:${target}:${text.trim().toLowerCase()}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, target = "en", source = "es" } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ translatedText: text || "" });
    }

    const trimmed = text.trim();
    const targetLang = target.toLowerCase();
    const sourceLang = source.toLowerCase();

    // Si el idioma de origen y destino son iguales, devolver el original
    if (sourceLang === targetLang) {
      return NextResponse.json({ translatedText: trimmed });
    }

    const cacheKey = getCacheKey(trimmed, sourceLang, targetLang);
    if (translationCache.has(cacheKey)) {
      return NextResponse.json({ translatedText: translationCache.get(cacheKey) });
    }

    // Traducción rápida a través del endpoint libre de Google Translate con timeout de 3.5s
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      sourceLang
    )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(trimmed)}`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        signal: AbortSignal.timeout(3500),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translated = data[0].map((item: any) => item[0]).join("");
          if (translated) {
            translationCache.set(cacheKey, translated);
            return NextResponse.json({ translatedText: translated });
          }
        }
      }
    } catch (fetchErr) {
      // Si falla Google Translate (p. ej. firewall saliente de cPanel bloqueando translate.googleapis.com),
      // retornamos el texto original sin bloquear la aplicación.
      console.warn("Google Translate fetch error (firewall or timeout):", fetchErr);
    }

    return NextResponse.json({ translatedText: trimmed });
  } catch (error) {
    console.warn("Translation API error (falling back to original):", error);
    return NextResponse.json({ translatedText: "" });
  }
}
