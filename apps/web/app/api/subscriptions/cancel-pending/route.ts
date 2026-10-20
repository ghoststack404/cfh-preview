import { NextResponse } from "next/server";
import { cancelPendingPlanSelection } from "@/app/actions/onboarding";

export async function POST(req: Request) {
  try {
    const result = await cancelPendingPlanSelection();
    if (!result.success && result.error?.includes("No autorizado")) {
      return NextResponse.json({ error: result.error, redirectUrl: "/coach/dashboard" }, { status: 401 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in /api/subscriptions/cancel-pending POST:", error);
    return NextResponse.json(
      { success: false, redirectUrl: "/coach/dashboard", error: error?.message || "Error interno al cancelar suscripción pendiente" },
      { status: 500 }
    );
  }
}

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
  const baseUrl = getBaseUrl(req);
  try {
    const result = await cancelPendingPlanSelection();
    return NextResponse.redirect(new URL(result.redirectUrl || "/coach/dashboard", baseUrl));
  } catch (error: any) {
    console.error("Error in /api/subscriptions/cancel-pending GET:", error);
    return NextResponse.redirect(new URL("/coach/dashboard", baseUrl));
  }
}
