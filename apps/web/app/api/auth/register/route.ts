import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { validatePassword } from "@/lib/password-validator";
import { SignJWT } from "jose";
import { sendMailSafely } from "@/lib/mail";

export async function POST(request: Request) {
  try {
    const { name, email, password, role } = await request.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: "Nombre, correo, contraseña y rol son requeridos." },
        { status: 400 }
      );
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 10 caracteres, una mayúscula, una minúscula, un número, un símbolo especial y sin espacios en blanco." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "El correo ya está registrado" },
        { status: 400 }
      );
    }

    const rawRole = String(role).toUpperCase();
    const normalizedRole: UserRole = rawRole === "COACH" ? "COACH" : "STUDENT";

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        role: normalizedRole,
        name: String(name).trim(),
      },
    });

    // Generate Verification Token
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "fallback_secret_for_development_secret_key_123");
    const token = await new SignJWT({ userId: user.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(secret);

    // Send Verification Email in background (non-blocking)
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/verify-email?token=${token}`;
    sendMailSafely({
      to: user.email,
      subject: "Coaching From Home - Verifica tu correo electrónico",
      text: `Hola ${user.name},\n\nPor favor verifica tu correo electrónico haciendo clic en el siguiente enlace:\n\n${verifyUrl}\n\nEste enlace expirará en 24 horas.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>¡Bienvenido a Coaching From Home, ${user.name}!</h2>
          <p>Para activar tu cuenta y poder reservar citas, por favor verifica tu correo electrónico.</p>
          <a href="${verifyUrl}" style="display: inline-block; padding: 10px 20px; background-color: #0d6efd; color: #fff; text-decoration: none; border-radius: 5px; margin: 15px 0;">Verificar mi correo</a>
          <p style="font-size: 12px; color: #666;">Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
          <p style="font-size: 12px; word-break: break-all; color: #666;">${verifyUrl}</p>
          <p style="font-size: 12px; color: #666;">Este enlace expirará en 24 horas.</p>
        </div>
      `
    }, "Verificación de email").catch((err) => {
      console.error("[Register] Error sending verification email in background:", err);
    });

    // 1. Iniciar sesión automáticamente creando el token de sesión y cookie cfh_session
    await createSession(user.id);

    // 2. Establecer cookies de sincronización de rol y estado de onboarding
    const cookieStore = await cookies();
    cookieStore.set("cfh_active_role", user.role, { path: "/", maxAge: 60 * 60 * 24 * 30 });
    cookieStore.set("cfh_user_role", user.role, { path: "/", maxAge: 60 * 60 * 24 * 30 });
    cookieStore.set("cfh_onboarding_completed", "false", { path: "/", maxAge: 60 * 60 * 24 * 30 });

    // 3. Limpiar cualquier token previo residual de NextAuth para evitar conflictos de usuario
    const staleNextAuthCookies = [
      "authjs.session-token",
      "__Secure-authjs.session-token",
      "next-auth.session-token",
      "__Secure-next-auth.session-token",
    ];
    for (const c of staleNextAuthCookies) {
      cookieStore.delete(c);
    }

    await audit({
      actorId: user.id,
      action: "USER_REGISTERED",
      entityType: "User",
      entityId: user.id,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isOnboardingCompleted: false,
      },
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    if (error?.code === "P1001" || error?.message?.includes("Can't reach database server")) {
      return NextResponse.json(
        { error: "No se puede conectar con el servidor de base de datos. Por favor verifica que el servicio de base de datos (170.10.163.209) esté encendido." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Error interno del servidor al procesar el registro." },
      { status: 500 }
    );
  }
}
