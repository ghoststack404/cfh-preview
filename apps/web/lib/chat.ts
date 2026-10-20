export type ContactFinding = "email" | "phone" | "link" | "social";

const emailPattern = /\b[A-Z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[A-Z0-9.-]+\s*(?:\.|\(dot\)|\[dot\])\s*[A-Z]{2,}\b/i;
const phoneDigitsPattern = /(?:\+?\d[\s().-]*){7,}/;
const urlPattern = /\b(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|mx|net|org|io|me|co|app|dev)\b)/i;
const socialPattern = /\b(?:whats?app|telegram|instagram|insta|facebook|fb|tiktok|snapchat|discord|linkedin)\b|(?:^|\s)@[a-z0-9._-]{3,}/i;

const numberWordMap: Record<string, string> = {
  cero: "0", cer0: "0", zero: "0",
  uno: "1", una: "1", ono: "1", un0: "1", one: "1",
  dos: "2", d0s: "2", two: "2",
  tres: "3", tr3s: "3", three: "3",
  cuatro: "4", cuatr0: "4", four: "4",
  cinco: "5", cinc0: "5", five: "5",
  seis: "6", s3is: "6", six: "6",
  siete: "7", si3t3: "7", seven: "7",
  ocho: "8", "0cho": "8", eight: "8",
  nueve: "9", nu3v3: "9", nine: "9",
  diez: "10", once: "11", doce: "12", trece: "13", catorce: "14", quince: "15",
  dieciseis: "16", diecisiete: "17", dieciocho: "18", diecinueve: "19",
  veinte: "20", veintiuno: "21", veintidos: "22", veintitres: "23", veinticuatro: "24",
  veinticinco: "25", veintiseis: "26", veintisiete: "27", veintiocho: "28", veintinueve: "29",
  treinta: "30", cuarenta: "40", cincuenta: "50", sesenta: "60", setenta: "70", ochenta: "80", noventa: "90",
};

const fillerWords = new Set(["y", "guion", "punto", "coma", "mas", "de", "el", "mi", "tel", "cel"]);

function detectSpelledOutPhone(content: string): boolean {
  const norm = content
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const tokens = norm.match(/[a-z0-9]+/g) || [];

  let seqCount = 0;
  let maxSeq = 0;

  for (const t of tokens) {
    if (numberWordMap[t]) {
      seqCount += numberWordMap[t].length;
      if (seqCount > maxSeq) maxSeq = seqCount;
    } else if (/^\d+$/.test(t)) {
      seqCount += t.length;
      if (seqCount > maxSeq) maxSeq = seqCount;
    } else if (fillerWords.has(t)) {
      continue;
    } else {
      seqCount = 0;
    }
  }

  return maxSeq >= 6;
}

export function findContactData(content: string): ContactFinding[] {
  const findings: ContactFinding[] = [];
  if (emailPattern.test(content)) findings.push("email");
  if (phoneDigitsPattern.test(content) || detectSpelledOutPhone(content)) findings.push("phone");
  if (urlPattern.test(content)) findings.push("link");
  if (socialPattern.test(content)) findings.push("social");
  return findings;
}

export function contactMessage(findings: ContactFinding[]) {
  const labels: Record<ContactFinding, string> = {
    email: "correos electrónicos",
    phone: "números de teléfono (dígitos o palabras)",
    link: "enlaces externos",
    social: "redes sociales"
  };
  const violationDesc = findings.length > 0 ? ` (${findings.map((item) => labels[item] || item).join(", ")})` : "";
  return `⛔ Acción no permitida: Está estrictamente prohibido compartir números de teléfono, correos o datos de contacto externos${violationDesc}. Si vuelves a intentarlo, tu cuenta será suspendida automáticamente.`;
}
