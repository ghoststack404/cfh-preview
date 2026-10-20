import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { jwtVerify } from "jose";

const prisma = new PrismaClient();

function getBaseUrl(request?: Request): string {
  const envUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("0.0.0.0") && !envUrl.includes("127.0.0.1")) {
    return envUrl.replace(/\/$/, "");
  }
  if (request) {
    const fHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const fProto = request.headers.get("x-forwarded-proto") || "https";
    if (fHost && !fHost.includes("0.0.0.0") && !fHost.includes("127.0.0.1")) {
      return `${fProto}://${fHost}`.replace(/\/$/, "");
    }
  }
  return "https://coachingfromhome.com.mx";
}

export async function GET(request: Request) {
  const baseUrl = getBaseUrl(request);
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/verify-email?error=MissingToken", baseUrl));
    }

    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "fallback_secret_for_development_secret_key_123");
    
    let payload;
    try {
      const { payload: jwtPayload } = await jwtVerify(token, secret);
      payload = jwtPayload;
    } catch (e) {
      console.error("Token verification failed:", e);
      return NextResponse.redirect(new URL("/verify-email?error=InvalidToken", baseUrl));
    }

    const userId = payload.userId as string;
    
    if (!userId) {
      return NextResponse.redirect(new URL("/verify-email?error=InvalidToken", baseUrl));
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.redirect(new URL("/verify-email?error=UserNotFound", baseUrl));
    }

    if (!user.emailVerifiedAt) {
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() }
      });
    }

    // Redirect to a success page
    return NextResponse.redirect(new URL("/verify-email?success=true", baseUrl));
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.redirect(new URL("/verify-email?error=VerificationError", baseUrl));
  }
}
