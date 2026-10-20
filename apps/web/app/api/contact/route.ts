import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/mail";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const to = (formData.get("to") as string)?.trim().toLowerCase();
    const subject = (formData.get("subject") as string)?.trim();
    const message = (formData.get("message") as string)?.trim();
    const senderEmail = (formData.get("senderEmail") as string)?.trim().toLowerCase() || "";
    const senderName = (formData.get("senderName") as string)?.trim() || "";

    if (!to || !subject || !message) {
      return NextResponse.json({ error: "Faltan campos requeridos." }, { status: 400 });
    }

    const validEmails = ["help@coachingfromhome.com.mx", "contact@coachingfromhome.com.mx"];
    if (!validEmails.includes(to)) {
      return NextResponse.json({ error: "Destinatario no válido." }, { status: 400 });
    }

    // Recopilar imágenes adjuntas (hasta 4)
    const imageKeys = ["image_0", "image_1", "image_2", "image_3"];
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

    for (const key of imageKeys) {
      const file = formData.get(key);
      if (file && file instanceof File && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        attachments.push({
          filename: file.name || `adjunto_${attachments.length + 1}.png`,
          content: Buffer.from(arrayBuffer),
          contentType: file.type || "image/png",
        });
      }
    }

    const isHelp = to.includes("help");
    const account = isHelp ? "help" : "contact";
    const mailboxLabel = isHelp ? "Soporte y Ayuda (help@coachingfromhome.com.mx)" : "Contacto General (contact@coachingfromhome.com.mx)";

    const formattedMessage = message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");
    const safeSubject = subject.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeSenderName = senderName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const senderDisplay = senderName
      ? (senderEmail ? `${safeSenderName} &lt;${senderEmail}&gt;` : safeSenderName)
      : (senderEmail || "Visitante del sitio");

    const html = `
      <div style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background-color: #ffffff; color: #1e293b;">
        <div style="background: linear-gradient(135deg, #061528 0%, #1a6358 100%); padding: 32px 28px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Nuevo Mensaje de Contacto Web</h1>
          <p style="color: #cbd5e1; margin: 8px 0 0; font-size: 14px;">Coaching From Home</p>
        </div>
        
        <div style="padding: 28px;">
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 140px;">Buzón destino:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${mailboxLabel}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Remitente:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${senderDisplay}</td>
              </tr>
              ${senderEmail ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Email de contacto:</td>
                <td style="padding: 6px 0; color: #1a6358; font-weight: 700;"><a href="mailto:${senderEmail}" style="color: #1a6358; text-decoration: underline;">${senderEmail}</a></td>
              </tr>` : ""}
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Asunto:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${safeSubject}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Imágenes adjuntas:</td>
                <td style="padding: 6px 0; color: #0f172a;">${attachments.length > 0 ? `${attachments.length} archivo(s) adjunto(s)` : "Ninguna"}</td>
              </tr>
            </table>
          </div>

          <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px; font-size: 15px; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">Mensaje recibido:</h3>
            <div style="background-color: #f8fafc; border-left: 4px solid #1a6358; padding: 18px 20px; font-size: 15px; line-height: 1.6; color: #334155; border-radius: 0 8px 8px 0;">
              ${formattedMessage}
            </div>
          </div>

          ${senderEmail ? `
          <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px 18px; margin-top: 24px; font-size: 13px; color: #64748b;">
            💡 <strong>Respuesta rápida:</strong> Puedes responder directamente a este correo haciendo clic en <em>"Responder"</em> en tu bandeja de entrada para contactar a <strong>${senderEmail}</strong>.
          </div>` : ""}
        </div>

        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
          Coaching From Home © ${new Date().getFullYear()} • Plataforma de Mentorías y Cursos
        </div>
      </div>
    `;

    const text = `
Nuevo mensaje de contacto web:

Buzón: ${to}
Remitente: ${senderName ? `${senderName} (${senderEmail || 'Sin email'})` : (senderEmail || 'Visitante')}
Asunto: ${subject}
Imágenes adjuntas: ${attachments.length}

Mensaje:
${message}

---
Enviado desde CoachingFromHome.com.mx
    `.trim();

    // Enviar el correo usando SMTP de cPanel
    await sendMail({
      to,
      subject: `[Web Contacto] ${subject}`,
      text,
      html,
      replyTo: senderEmail || undefined,
      account,
      attachments,
    });

    console.log(`[Contact API] Mensaje enviado exitosamente a ${to}`);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("[Contact API] Error al enviar email:", err);
    return NextResponse.json(
      { error: "No se pudo enviar el correo en este momento. Intenta de nuevo más tarde." },
      { status: 500 }
    );
  }
}
