import { validateCommunitySafety } from "./communitySafety";
import path from "path";
import fs from "fs";

export interface ImageModerationResult {
  isSafe: boolean;
  reason?: string;
  violationType?: "NONE" | "INAPPROPRIATE" | "PHONE_NUMBER" | "BANK_ACCOUNT" | "VIOLENCE" | "MALICIOUS" | "OTHER";
  extractedText?: string;
}

/**
 * Resuelve la ruta física real del worker de Tesseract para evitar que Next.js Turbopack / Webpack
 * inyecte identificadores virtuales como "[project]/node_modules...".
 */
function resolveTesseractWorkerPath(): string | undefined {
  const candidates = [
    path.resolve(process.cwd(), "..", "..", "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js"),
    path.resolve(process.cwd(), "..", "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js"),
    path.resolve(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js"),
    "C:\\Users\\ivann\\OneDrive\\Documentos\\CoachingFromHome\\Tia_Monica\\node_modules\\tesseract.js\\src\\worker-script\\node\\index.js",
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch (_) {}
  }
  return undefined;
}

// Instancia única (Singleton) para reutilizar el worker y lograr respuestas de alta velocidad (<200ms)
let sharedWorker: any = null;
let sharedWorkerPromise: Promise<any> | null = null;

async function getOCRWorker() {
  if (sharedWorker) return sharedWorker;
  if (sharedWorkerPromise) return sharedWorkerPromise;

  sharedWorkerPromise = (async () => {
    try {
      const { createWorker } = await import("tesseract.js");
      const workerPath = resolveTesseractWorkerPath();
      const options: any = workerPath ? { workerPath } : {};
      const worker = await createWorker("eng", 1, options);
      sharedWorker = worker;
      return worker;
    } catch (err) {
      console.warn("No se pudo inicializar worker de Tesseract:", err);
      sharedWorkerPromise = null;
      return null;
    }
  })();

  return sharedWorkerPromise;
}

// Precalentar el worker en segundo plano para respuesta inmediata al subir
if (typeof process !== "undefined" && process.versions?.node) {
  setTimeout(() => {
    getOCRWorker().catch(() => {});
  }, 1000);
}

/**
 * Extrae texto visible de un buffer de imagen mediante IA OCR local reutilizable y de respuesta ultrarrápida.
 * Cuenta con un timeout de 7s para balancear precisión completa y fluidez sin colgar la UI.
 */
async function extractTextFromImageBuffer(buffer: Buffer): Promise<string> {
  const timeoutPromise = new Promise<string>((resolve) => {
    setTimeout(() => {
      resolve("");
    }, 7000);
  });

  const ocrPromise = (async () => {
    try {
      const worker = await getOCRWorker();
      if (!worker) return "";
      const ret = await worker.recognize(buffer);
      return ret?.data?.text || "";
    } catch (ocrErr) {
      console.warn("Advertencia en escaneo OCR local:", ocrErr);
      sharedWorker = null;
      sharedWorkerPromise = null;
      return "";
    }
  })();

  return Promise.race([ocrPromise, timeoutPromise]);
}

/**
 * Analiza un buffer de imagen con máxima sensibilidad contra:
 * 1. Payloads maliciosos o scripts incrustados (Filtro heurístico)
 * 2. Números telefónicos o enlaces de contacto visibles en la foto (OCR Local Tesseract)
 * 3. Datos de cuentas bancarias, tarjetas o comprobantes de pago visibles (OCR Local Tesseract)
 * 4. Palabras ofensivas, groserías o insultos escritos en la foto (OCR Local Tesseract)
 * 5. Contenido inapropiado / adulto / lencería / erótico / violencia (Gemini Vision si hay API Key)
 */
export async function moderateImageBuffer(
  buffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<ImageModerationResult> {
  try {
    // 1. FILTRO HEURÍSTICO LOCAL INMEDIATO
    // Detección de scripts o código malicioso incrustado en el archivo
    const bufferPrefix = buffer.subarray(0, 4096).toString("latin1");
    if (
      /<script[\s>]/i.test(bufferPrefix) ||
      /javascript:/i.test(bufferPrefix) ||
      /onload\s*=/i.test(bufferPrefix) ||
      /<\?php/i.test(bufferPrefix)
    ) {
      return {
        isSafe: false,
        violationType: "MALICIOUS",
        reason: "El archivo contiene código o datos ejecutables no permitidos.",
      };
    }

    // 2. FILTRO ÓPTICO DE INTELIGENCIA ARTIFICIAL (OCR TESSERACT LOCAL)
    // Extrae y analiza cualquier texto o números visibles en la imagen de forma 100% local y autónoma
    try {
      const extractedText = await extractTextFromImageBuffer(buffer);
      if (extractedText && extractedText.trim().length > 0) {
        const textSafety = validateCommunitySafety(extractedText);
        if (!textSafety.isValid) {
          let violationType: ImageModerationResult["violationType"] = "INAPPROPRIATE";
          const reasonLower = (textSafety.reason || "").toLowerCase();

          if (reasonLower.includes("teléfono") || reasonLower.includes("celular") || reasonLower.includes("whats") || reasonLower.includes("contacto")) {
            violationType = "PHONE_NUMBER";
          } else if (reasonLower.includes("cuenta") || reasonLower.includes("tarjeta") || reasonLower.includes("clabe") || reasonLower.includes("transferencia")) {
            violationType = "BANK_ACCOUNT";
          } else if (reasonLower.includes("violencia") || reasonLower.includes("amenazas")) {
            violationType = "VIOLENCE";
          }

          return {
            isSafe: false,
            violationType,
            reason: `La imagen contiene información no permitida detectada por IA: ${textSafety.reason}`,
            extractedText: extractedText.trim(),
          };
        }
      }
    } catch (ocrError) {
      console.warn("Error ejecutando OCR en buffer de imagen:", ocrError);
    }

    // 3. FILTRO DE VISIÓN POR INTELIGENCIA ARTIFICIAL MULTIMODAL (GEMINI VISION)
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (apiKey) {
      try {
        const base64Data = buffer.toString("base64");
        const prompt = `Eres un sistema de moderación estricto para una plataforma educativa y de coaching con aprendices, menores y profesionales.
Evalúa la imagen adjunta con MÁXIMA SENSIBILIDAD ante las siguientes prohibiciones:
1. CONTENIDO INAPROPIADO: Cualquier desnudez total o parcial, ropa interior, lencería, poses sexualmente sugerentes, escotes excesivos, genitales, pornografía o material erótico.
2. NÚMEROS TELEFÓNICOS / WHATSAPP: Cualquier número de teléfono, celular, contacto de WhatsApp o ID de mensajería externa escrito, fotografiado o visible en la imagen.
3. DATOS BANCARIOS / PAGOS: Cualquier número de tarjeta de crédito/débito, cuenta bancaria, CLABE interbancaria, captura de pantalla de transferencias bancarias, comprobante/voucher de pago o códigos QR de pago externo.
4. VIOLENCIA / ARMAS / DROGAS: Armas de fuego, cuchillos, sangre, lesiones, drogas o gestos obscenos.

Si la imagen contiene CUALQUIERA de estas cosas, NO es segura (isSafe: false).
Responde ÚNICAMENTE un objeto JSON válido con este formato exacto:
{
  "isSafe": false,
  "violationType": "INAPPROPRIATE" | "PHONE_NUMBER" | "BANK_ACCOUNT" | "VIOLENCE" | "NONE",
  "reason": "Explicación breve y cortés en español para el usuario del motivo del rechazo"
}`;

        // Llamada a Gemini con fallback
        const modelNames = ["gemini-2.5-flash", "gemini-1.5-flash"];
        for (const model of modelNames) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(3500),
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: prompt },
                      {
                        inlineData: {
                          mimeType: mimeType || "image/jpeg",
                          data: base64Data,
                        },
                      },
                    ],
                  },
                ],
                generationConfig: {
                  responseMimeType: "application/json",
                  temperature: 0.1,
                },
              }),
            });

            if (response.ok) {
              const data = await response.json();
              const textResult =
                data?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (textResult) {
                const parsed = JSON.parse(textResult);
                if (parsed && typeof parsed.isSafe === "boolean") {
                  if (!parsed.isSafe) {
                    return {
                      isSafe: false,
                      violationType: parsed.violationType || "INAPPROPRIATE",
                      reason:
                        parsed.reason ||
                        "La imagen no cumple con las normas de seguridad de la comunidad.",
                    };
                  }
                  return { isSafe: true, violationType: "NONE" };
                }
              }
            }
          } catch (modelErr) {
            console.warn(`Error llamando a Gemini (${model}):`, modelErr);
          }
        }
      } catch (aiErr) {
        console.error("Error en moderación de imagen por IA:", aiErr);
      }
    }

    return { isSafe: true, violationType: "NONE" };
  } catch (error) {
    console.error("Error durante la moderación de la imagen:", error);
    return { isSafe: true, violationType: "NONE" };
  }
}
