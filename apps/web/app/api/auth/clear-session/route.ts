import { destroySession } from "@/lib/auth";
import { NextResponse } from "next/server";

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

export async function GET(req: Request) {
  // Cuando Next.js detecta una sesión "fantasma" en Server Components, 
  // redirige a este endpoint por GET para limpiar las cookies y romper el bucle infinito del Middleware.
  await destroySession();
  
  const baseUrl = getBaseUrl(req);
  const url = new URL("/", baseUrl);
  url.searchParams.set("auth", "login");
  return NextResponse.redirect(url);
}
