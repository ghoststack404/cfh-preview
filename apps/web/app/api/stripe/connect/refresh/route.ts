import { env } from "@/lib/env";

function getDynamicOrigin(req: Request): string {
  const originHeader = req.headers.get("origin");
  if (originHeader) return originHeader;

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {}
  }

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") || "http";
    return `${proto}://${host}`;
  }

  return env().APP_URL;
}

export async function GET(req: Request) {
  const origin = getDynamicOrigin(req);
  return Response.redirect(new URL("/coach/billing?stripe=refresh", origin), 303);
}
