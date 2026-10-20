import { requireUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/api";
import { sendMail } from "@/lib/mail";
import { assertSameOrigin } from "@/lib/security";

export async function POST() {
  try {
    await assertSameOrigin();
    const admin = await requireUser(["ADMIN"]);
    const result = await sendMail({
      to: admin.email,
      subject: "Prueba de correo CFH",
      text: "El servidor de correo de Coaching From Home respondió correctamente."
    });
    return Response.json({ message: result.mode === "console" ? "Correo mostrado en la consola." : `Correo enviado a ${admin.email}.` });
  } catch (error) {
    return handleRouteError(error);
  }
}
