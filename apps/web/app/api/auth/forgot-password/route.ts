import { handleRouteError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { assertSameOrigin, randomToken, sha256 } from "@/lib/security";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

import path from "node:path";
import fs from "node:fs";

function resetEmail(name: string, link: string) {
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(link);
  
  // Leemos el logo para incrustarlo como CID (Content-ID) de forma que siempre se vea en Gmail, móvil y Outlook
  let logoAttachment: any = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "Logo.png");
    if (fs.existsSync(logoPath)) {
      logoAttachment = {
        filename: "logo.png",
        path: logoPath,
        cid: "cfh-logo@coachingfromhome"
      };
    }
  } catch (_) {}

  return {
    subject: "Recupera tu contraseña | Coaching From Home",
    text: `Hola ${name}.\n\nRecibimos una solicitud para restablecer tu contraseña en Coaching From Home.\n\nHaz clic en el siguiente enlace para crear tu nueva contraseña (vence en 30 minutos):\n${link}\n\nSi no realizaste esta solicitud, puedes ignorar este mensaje de forma segura.\n\nEl equipo de Coaching From Home.`,
    attachments: logoAttachment ? [logoAttachment] : undefined,
    html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recupera tu cuenta</title>
</head>
<body style="margin:0;padding:0;background-color:#09121d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#09121d;min-height:100vh;padding:40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;background-color:#0f1d2d;border-radius:24px;border:1px solid #1e354f;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.45);">
          
          <!-- Header Banner -->
          <tr>
            <td align="center" style="padding:36px 32px 24px 32px;background:linear-gradient(180deg, #13273e 0%, #0f1d2d 100%);border-bottom:1px solid #1b334d;">
              <!-- Logo Container -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    ${logoAttachment 
                      ? `<img src="cid:cfh-logo@coachingfromhome" alt="Coaching From Home" width="76" height="76" style="display:block;border-radius:20px;border:2px solid #5D92B9;box-shadow:0 8px 16px rgba(0,0,0,0.3);margin-bottom:12px;" />` 
                      : `<div style="width:68px;height:68px;border-radius:18px;background-color:#5D92B9;display:flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:26px;color:#ffffff;font-weight:bold;">CFH</div>`
                    }
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <span style="font-size:18px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;display:block;">
                      Coaching<span style="color:#5D92B9;">From</span>Home
                    </span>
                    <span style="font-size:11px;font-weight:600;letter-spacing:1px;color:#88C0A0;text-transform:uppercase;margin-top:2px;display:block;">
                      Educación que transforma
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding:36px 36px 28px 36px;">
              <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:#ffffff;line-height:1.25;text-align:center;">
                Recuperación de Contraseña
              </h1>
              
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#cbd5e1;text-align:left;">
                Hola <strong style="color:#ffffff;">${safeName}</strong>,
              </p>
              
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.6;color:#94a3b8;text-align:left;">
                Hemos recibido una solicitud para restablecer la contraseña de acceso a tu cuenta. Para continuar y definir tu nueva clave, haz clic en el siguiente botón:
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0;">
                <tr>
                  <td align="center">
                    <a href="${safeLink}" target="_blank" style="display:inline-block;background-color:#5D92B9;color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:16px 36px;border-radius:16px;box-shadow:0 8px 20px rgba(93,146,185,0.35);letter-spacing:0.2px;text-align:center;">
                      Crear nueva contraseña &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry Alert Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#142539;border-radius:14px;border:1px solid #234062;margin-top:24px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;font-size:12px;line-height:1.5;color:#93c5fd;text-align:left;">
                      ⏱ <strong>Vigencia de seguridad:</strong> Este enlace es de un solo uso y vencerá automáticamente en <strong>30 minutos</strong>. Si no solicitaste este cambio, puedes ignorar este correo sin que afecte a tu cuenta.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px 32px 36px;border-top:1px solid #182c42;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:12px;color:#64748b;">
                &copy; Coaching From Home &bull; Plataforma Segura
              </p>
              <p style="margin:0;font-size:11px;color:#475569;">
                Este es un correo automático de seguridad, por favor no respondas a este mensaje.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  };
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const contentType = request.headers.get("content-type") ?? "";
    const email = contentType.includes("application/json")
      ? String((await request.json()).email ?? "").trim().toLowerCase()
      : String((await request.formData()).get("email") ?? "").trim().toLowerCase();
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
    let delivery: "sent" | "not-found" | "failed" = user ? "sent" : "not-found";

    if (user) {
      const token = randomToken(36);
      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
        prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60_000) } })
      ]);
      // Detectar la IP o Dominio accesible para que el enlace abra tanto en PC como en Celulares (WiFi)
      const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
      const reqProto = request.headers.get("x-forwarded-proto") || "http";
      
      let effectiveHost = hostHeader;
      // Si la petición vino desde "localhost" o "127.0.0.1" (la PC), usamos la IP local de tu máquina (192.168.100.143:3000)
      // para que cuando lo abras en tu celular NO diga "localhost is unreachable"
      if (!effectiveHost || effectiveHost.includes("localhost") || effectiveHost.includes("127.0.0.1")) {
        effectiveHost = "192.168.100.143:3000";
      }

      const baseUrl = `${reqProto}://${effectiveHost}`;
      const link = `${baseUrl}/es/auth/reset-password?token=${encodeURIComponent(token)}`;
      try {
        await sendMail({ to: user.email, ...resetEmail(user.name, link) });
      } catch (error) {
        console.error("No se pudo enviar el correo de recuperación", error);
        delivery = "failed";
      }
    }

    if (contentType.includes("application/json")) {
      return Response.json({ success: true, delivery: process.env.NODE_ENV === "development" ? delivery : undefined });
    }
    const url = new URL("/auth/forgot-password", env().APP_URL);
    url.searchParams.set("sent", "1");
    if (process.env.NODE_ENV === "development") url.searchParams.set("delivery", delivery);
    return Response.redirect(url, 303);
  } catch (error) {
    return handleRouteError(error);
  }
}
