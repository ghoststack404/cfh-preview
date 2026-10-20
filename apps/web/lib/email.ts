import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "mail.coachingfromhome.com.mx",
  port: parseInt(process.env.SMTP_PORT || "465", 10),
  secure: process.env.SMTP_SECURE === "true" || parseInt(process.env.SMTP_PORT || "465", 10) === 465,
  auth: {
    user: process.env.SMTP_USER || "contact@coachingfromhome.com.mx",
    pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "cyWWsimz3Z3riD6",
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 20_000,
});

const DEFAULT_FROM = process.env.SMTP_FROM || `"Coaching From Home" <contact@coachingfromhome.com.mx>`;

// ------------------------------------
// TRANSACTIONAL EMAILS
// ------------------------------------

export async function sendWelcomeEmail(to: string, name: string) {
  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #061528; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">¡Bienvenido/a a Coaching From Home!</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="font-size: 16px; color: #334155;">Hola <strong>${name}</strong>,</p>
          <p style="font-size: 16px; color: #334155;">Nos alegra mucho que te hayas unido a nuestra comunidad. Aquí podrás conectar con coaches expertos, acceder a cursos exclusivos y llevar tu aprendizaje al siguiente nivel.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background-color: #1a6358; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; display: inline-block;">
              Ir a mi Dashboard
            </a>
          </div>
          <p style="font-size: 14px; color: #64748b; margin-top: 30px;">Si tienes alguna pregunta, no dudes en responder a este correo.</p>
        </div>
      </div>
    `;

    const result = await transporter.sendMail({
      from: DEFAULT_FROM,
      to,
      subject: "¡Bienvenido a Coaching From Home! 🎉",
      html,
    });
    console.log("Welcome email sent:", result.messageId);
    return true;
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return false;
  }
}

export async function sendCoursePurchaseEmail(to: string, name: string, courseTitle: string, price: string) {
  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #1a6358; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">¡Compra Exitosa!</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="font-size: 16px; color: #334155;">Hola <strong>${name}</strong>,</p>
          <p style="font-size: 16px; color: #334155;">Confirmamos la compra de tu curso:</p>
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; font-size: 18px; font-weight: bold; color: #0f172a;">${courseTitle}</p>
            <p style="margin: 0; font-size: 16px; color: #64748b;">Monto pagado: <strong>${price}</strong></p>
          </div>
          <p style="font-size: 16px; color: #334155;">Ya tienes acceso completo al material. ¡Empieza cuando quieras!</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background-color: #061528; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; display: inline-block;">
              Acceder al Curso
            </a>
          </div>
        </div>
      </div>
    `;

    const result = await transporter.sendMail({
      from: DEFAULT_FROM,
      to,
      subject: `Confirmación de Compra: ${courseTitle} 🎓`,
      html,
    });
    console.log("Course purchase email sent:", result.messageId);
    return true;
  } catch (error) {
    console.error("Error sending purchase email:", error);
    return false;
  }
}

export async function sendBookingConfirmationEmail(to: string, name: string, coachName: string, date: Date) {
  try {
    const formattedDate = date.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #2563eb; padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">¡Sesión Confirmada!</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="font-size: 16px; color: #334155;">Hola <strong>${name}</strong>,</p>
          <p style="font-size: 16px; color: #334155;">Tu sesión de 60 min ha sido reservada con éxito. Aquí están los detalles:</p>
          <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; font-size: 16px;"><strong>Coach:</strong> ${coachName}</p>
            <p style="margin: 0; font-size: 16px;"><strong>Fecha y Hora:</strong> ${formattedDate}</p>
          </div>
          <p style="font-size: 16px; color: #334155;">Podrás acceder a la videollamada desde tu panel 5 minutos antes de la hora acordada.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; display: inline-block;">
              Ver mis Sesiones
            </a>
          </div>
        </div>
      </div>
    `;

    const result = await transporter.sendMail({
      from: DEFAULT_FROM,
      to,
      subject: `Reserva confirmada con ${coachName} 📅`,
      html,
    });
    console.log("Booking email sent:", result.messageId);
    return true;
  } catch (error) {
    console.error("Error sending booking email:", error);
    return false;
  }
}
