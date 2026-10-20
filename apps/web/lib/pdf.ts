import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function wrap(text: string, width = 88) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > width) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function createTextPdf(title: string, content: string) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [612, 792];
  let page = pdf.addPage(pageSize);
  let y = 742;
  page.drawText("COACHING FROM HOME", { x: 52, y, size: 11, font: bold, color: rgb(0.18, 0.52, 0.43) });
  y -= 34;
  page.drawText(title.slice(0, 80), { x: 52, y, size: 20, font: bold, color: rgb(0.07, 0.14, 0.23) });
  y -= 34;
  for (const line of wrap(content)) {
    if (y < 58) {
      page = pdf.addPage(pageSize);
      y = 742;
    }
    page.drawText(line, { x: 52, y, size: 10.5, font: regular, color: rgb(0.16, 0.2, 0.25) });
    y -= line ? 16 : 10;
  }
  return pdf.save();
}


export async function createCertificatePdf(studentName: string, courseName: string, coachName: string, dateStr: string, code: string) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  
  // Landscape format
  const pageSize: [number, number] = [792, 612];
  const page = pdf.addPage(pageSize);
  
  // Draw elegant border
  page.drawRectangle({
    x: 30, y: 30, width: 732, height: 552,
    borderColor: rgb(0.18, 0.52, 0.43),
    borderWidth: 4,
  });
  page.drawRectangle({
    x: 36, y: 36, width: 720, height: 540,
    borderColor: rgb(0.18, 0.52, 0.43),
    borderWidth: 1,
  });

  // Center helper
  const drawCentered = (text: string, font: any, size: number, y: number, color = rgb(0.07, 0.14, 0.23)) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (792 - textWidth) / 2, y, size, font, color });
  };

  drawCentered("COACHING FROM HOME", bold, 24, 480, rgb(0.18, 0.52, 0.43));
  drawCentered("CERTIFICADO DE FINALIZACIÓN", bold, 36, 420);
  
  drawCentered("Se otorga con orgullo a:", regular, 16, 360);
  drawCentered(studentName.toUpperCase(), bold, 28, 320, rgb(0.18, 0.52, 0.43));
  
  drawCentered("Por haber completado satisfactoriamente el curso:", regular, 16, 270);
  drawCentered(courseName, bold, 20, 230);
  
  drawCentered(`Impartido por ${coachName}`, italic, 14, 190);
  
  // Bottom signature and date area
  page.drawLine({
    start: { x: 150, y: 110 },
    end: { x: 350, y: 110 },
    thickness: 1,
    color: rgb(0.18, 0.52, 0.43)
  });
  const dateWidth = regular.widthOfTextAtSize(dateStr, 12);
  page.drawText(dateStr, { x: 250 - (dateWidth/2), y: 90, size: 12, font: regular });
  
  page.drawLine({
    start: { x: 442, y: 110 },
    end: { x: 642, y: 110 },
    thickness: 1,
    color: rgb(0.18, 0.52, 0.43)
  });
  const coachWidth = regular.widthOfTextAtSize("Firma del Coach", 12);
  page.drawText("Firma del Coach", { x: 542 - (coachWidth/2), y: 90, size: 12, font: regular });

  // Verification code
  page.drawText(`Código de verificación: ${code}`, {
    x: 40, y: 40, size: 8, font: regular, color: rgb(0.5, 0.5, 0.5)
  });

  return pdf.save();
}
