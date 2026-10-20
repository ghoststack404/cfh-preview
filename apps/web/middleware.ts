import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decode } from "next-auth/jwt";
import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n";

// Rutas que requieren estar autenticado
const protectedRoutes = ["/sesion", "/dashboard", "/coach/", "/student", "/profile", "/checkout"];

/** Helper para determinar la URL base correcta respetando proxies de producción (evita 0.0.0.0 / localhost en cPanel) */
function getBaseUrl(request?: NextRequest): string {
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

/** Helper para generar una URL con el locale activo preservado */
function getLocalizedUrl(targetPath: string, activeLocale: string, request: NextRequest, preserveQuery: boolean = true): URL {
  if (targetPath.startsWith("http://") || targetPath.startsWith("https://")) {
    return new URL(targetPath);
  }

  const baseUrl = getBaseUrl(request);
  // Si targetPath ya tiene prefijo de locale soportado (ej. /es, /es/, /ja?foo=bar)
  const hasLocalePrefix = locales.some(
    (loc) => targetPath === `/${loc}` || targetPath.startsWith(`/${loc}/`) || targetPath.startsWith(`/${loc}?`)
  );

  let fullUrl: URL;
  if (hasLocalePrefix) {
    fullUrl = new URL(targetPath, baseUrl);
  } else {
    // Separar ruta de query params o hash si existen
    const [pathOnly, searchAndHash] = targetPath.split(/(?=[?#])/);
    const cleanPath = (pathOnly || "").startsWith("/") ? pathOnly : `/${pathOnly || ""}`;
    const localizedPath = cleanPath === "/" ? `/${activeLocale}` : `/${activeLocale}${cleanPath}`;
    const fullPath = searchAndHash ? `${localizedPath}${searchAndHash}` : localizedPath;
    fullUrl = new URL(fullPath, baseUrl);
  }

  if (preserveQuery && request.nextUrl.search && !fullUrl.search) {
    fullUrl.search = request.nextUrl.search;
  }

  return fullUrl;
}

/** Helper para generar redirección limpia al login preservando el callbackUrl y el locale */
function createLoginRedirect(request: NextRequest, activeLocale: string, strippedPathname: string) {
  const { search } = request.nextUrl;
  const baseUrl = getBaseUrl(request);
  const url = new URL(`/${activeLocale}`, baseUrl);
  url.searchParams.set("auth", "login");
  const target = `${strippedPathname}${search || ""}`;
  url.searchParams.set("callbackUrl", target);
  return NextResponse.redirect(url);
}

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always"
});

/** Nombres de todas las cookies de sesión que se limpian al detectar JWT inválido */
const SESSION_COOKIES_TO_CLEAR = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "cfh_session",
  "cfh_active_role",
  "cfh_user_role",
] as const;

/** Limpia las cookies de sesión y redirige al home con ?session=expired */
function createSessionExpiredRedirect(request: NextRequest, activeLocale: string): NextResponse {
  const baseUrl = getBaseUrl(request);
  const expiredUrl = new URL(`/${activeLocale}`, baseUrl);
  expiredUrl.searchParams.set("session", "expired");
  const response = NextResponse.redirect(expiredUrl);
  for (const cookieName of SESSION_COOKIES_TO_CLEAR) {
    response.cookies.set(cookieName, "", { maxAge: 0, path: "/", httpOnly: true, sameSite: "lax" });
  }
  return response;
}

export async function middleware(request: NextRequest) {
  console.log("MIDDLEWARE URL:", request.url);
  const { pathname, search } = request.nextUrl;

  // Extraer el prefijo de idioma del pathname
  const matchedLocale = locales.find(
    (loc) => pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)
  );
  const cookieLocale = (
    request.cookies.get("NEXT_LOCALE")?.value ||
    request.cookies.get("cfh_language")?.value
  )?.toLowerCase();

  const activeLocale = matchedLocale || (cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale);

  // Normalizar el pathname removiendo el prefijo de locale para evaluar route guards
  const strippedPathname = matchedLocale
    ? (pathname.substring(matchedLocale.length + 1) || "/")
    : pathname;

  // 1. Obtener indicadores rápidos de sesión desde cookies
  const hasCustomSession = Boolean(request.cookies.get("cfh_session")?.value);
  const nextAuthTokenCookie =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value ||
    request.cookies.get("next-auth.session-token")?.value ||
    request.cookies.get("__Secure-next-auth.session-token")?.value;
  const hasNextAuthCookie = Boolean(nextAuthTokenCookie);

  // ─── DETECCIÓN TEMPRANA DE JWT INVÁLIDO ────────────────────────────────────
  // Si existe cookie de NextAuth pero falla el decode (secret diferente o token
  // corrupto), limpiamos todo y redirigimos con ?session=expired para mostrar
  // un toast amigable en lugar de dejar al usuario en un estado roto.
  if (hasNextAuthCookie && nextAuthTokenCookie) {
    const salt = request.cookies.get("__Secure-authjs.session-token")
      ? "__Secure-authjs.session-token"
      : request.cookies.get("__Secure-next-auth.session-token")
      ? "__Secure-next-auth.session-token"
      : request.cookies.get("authjs.session-token")
      ? "authjs.session-token"
      : "next-auth.session-token";

    try {
      await decode({
        token: nextAuthTokenCookie,
        secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "fallback_secret_for_development",
        salt,
      });
    } catch (jwtErr: any) {
      console.warn("[middleware] JWT inválido detectado, limpiando sesión:", jwtErr?.message);
      // Evitar loop si ya estamos en el home con ?session=expired
      const alreadyExpired = request.nextUrl.searchParams.get("session") === "expired";
      const isHomePath = strippedPathname === "/" || strippedPathname === "";
      if (!(isHomePath && alreadyExpired)) {
        return createSessionExpiredRedirect(request, activeLocale);
      }
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const isAuthenticated = hasCustomSession || hasNextAuthCookie;

  // Leer rol y estado de onboarding desde cookies sincronizadas
  // Damos prioridad a cfh_active_role porque es el rol que el usuario decidió activar en la UI.
  let role = request.cookies.get("cfh_active_role")?.value || request.cookies.get("cfh_user_role")?.value;
  let isOnboardingCompleted = request.cookies.get("cfh_onboarding_completed")?.value === "true";

  // Si no tenemos el rol en cookies pero hay sesión NextAuth, obtenerla decodificando el token
  if (isAuthenticated && !role && nextAuthTokenCookie) {
    try {
      const salt = request.cookies.get("__Secure-authjs.session-token") ? "__Secure-authjs.session-token" : request.cookies.get("__Secure-next-auth.session-token") ? "__Secure-next-auth.session-token" : request.cookies.get("authjs.session-token") ? "authjs.session-token" : "next-auth.session-token";
      const decoded = await decode({
        token: nextAuthTokenCookie,
        secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "fallback_secret_for_development",
        salt,
      });
      if (decoded?.role) {
        role = decoded.role as string;
      }
    } catch {
      // Continuar con lo que tengamos
    }
  }

  const isCoach = role === "COACH";
  const isStudent = role === "STUDENT" || role === "APPRENTICE";
  const isAdmin = role === "ADMIN";

  // -------------------------------------------------------------
  // GUARD: Root Path (/) Redirection for Authenticated Users
  // -------------------------------------------------------------
  if (strippedPathname === "/") {
    // Si viene para ver el modal de login, registro o aviso de cuenta ya registrada, NO redirigir al dashboard
    if (
      request.nextUrl.searchParams.get("alreadyRegistered") === "true" ||
      request.nextUrl.searchParams.get("auth") === "login" ||
      request.nextUrl.searchParams.get("auth") === "register"
    ) {
      return intlMiddleware(request);
    }

    if (isAuthenticated) {
      // Si el usuario ya está autenticado pero venía con un callbackUrl seguro, redirigir a su destino
      const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") || request.nextUrl.searchParams.get("redirect");
      if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") && !callbackUrl.startsWith("/comunidad")) {
        console.log("REDIRECT 1", callbackUrl);
        return NextResponse.redirect(getLocalizedUrl(callbackUrl, activeLocale, request));
      }

      if (isAdmin) {
        console.log("REDIRECT 2");
        return NextResponse.redirect(getLocalizedUrl("/dashboard", activeLocale, request));
      } else if (isCoach && isOnboardingCompleted) {
        console.log("REDIRECT 3");
        return NextResponse.redirect(getLocalizedUrl("/coach/dashboard", activeLocale, request));
      } else if (isCoach && !isOnboardingCompleted) {
        console.log("REDIRECT 4");
        return NextResponse.redirect(getLocalizedUrl("/coach/onboarding", activeLocale, request));
      } else if (isStudent && isOnboardingCompleted) {
        console.log("REDIRECT 2");
        return NextResponse.redirect(getLocalizedUrl("/dashboard", activeLocale, request));
      } else if (isStudent && !isOnboardingCompleted) {
        console.log("REDIRECT 5");
        return NextResponse.redirect(getLocalizedUrl("/student/onboarding", activeLocale, request));
      } else {
        // Fallback seguro para cualquier otro usuario autenticado
        console.log("REDIRECT 2");
        return NextResponse.redirect(getLocalizedUrl("/dashboard", activeLocale, request));
      }
    }
  }

  // -------------------------------------------------------------
  // GUARD: Rutas de Onboarding de Alumno / Aprendiz (/student/onboarding)
  // -------------------------------------------------------------
  const isStudentOnboardingPath =
    strippedPathname === "/student/onboarding" ||
    strippedPathname.startsWith("/student/onboarding/");

  if (isStudentOnboardingPath) {
    if (!isAuthenticated) {
      return createLoginRedirect(request, activeLocale, strippedPathname);
    }
  }

  // -------------------------------------------------------------
  // GUARD: Ruta Unificada /profile -> Redirección Estricta por Rol
  // -------------------------------------------------------------
  const isProfilePath = strippedPathname === "/profile" || strippedPathname.startsWith("/profile/");
  if (isProfilePath) {
    if (!isAuthenticated && !role) {
      const url = new URL(`/${activeLocale}`, request.url);
      url.searchParams.set("auth", "login");
      return NextResponse.redirect(url);
    }
    const destinationPath = isCoach ? "/coach/profile" : "/dashboard/profile";
    const destUrl = getLocalizedUrl(destinationPath, activeLocale, request);
    destUrl.search = request.nextUrl.search;
    console.log("REDIRECT 6", destUrl.toString());
    return NextResponse.redirect(destUrl, 307);
  }

  // -------------------------------------------------------------
  // GUARD: Dashboard de Estudiante (/dashboard)
  // -------------------------------------------------------------
  const isDashboardPath =
    strippedPathname === "/dashboard" || strippedPathname.startsWith("/dashboard/");

  if (isDashboardPath) {
    // Si el usuario tiene rol activo de Coach, rebotar de inmediato con 307 a su área de coach
    if (isCoach) {
      const destination = request.cookies.get("cfh_onboarding_completed")?.value === "false"
        ? "/coach/onboarding"
        : "/coach/dashboard";
      console.log("REDIRECT 7", destination);
      return NextResponse.redirect(getLocalizedUrl(destination, activeLocale, request), 307);
    }

    if (!isAuthenticated) {
      return createLoginRedirect(request, activeLocale, strippedPathname);
    }

    // Si es estudiante y NO ha completado el onboarding, redirigir a configurar su perfil
    if (isStudent && !isOnboardingCompleted) {
      console.log("REDIRECT 5");
      return NextResponse.redirect(getLocalizedUrl("/student/onboarding", activeLocale, request));
    }
  }

  // -------------------------------------------------------------
  // GUARD: Rutas de Onboarding de Coach (/onboarding/coach o /coach/onboarding)
  // -------------------------------------------------------------
  const isCoachOnboardingPath =
    strippedPathname === "/onboarding/coach" ||
    strippedPathname.startsWith("/onboarding/coach/") ||
    strippedPathname === "/coach/onboarding" ||
    strippedPathname.startsWith("/coach/onboarding/");

  if (isCoachOnboardingPath) {
    if (!isAuthenticated) {
      return createLoginRedirect(request, activeLocale, strippedPathname);
    }
    // Permitimos siempre acceder a /coach/onboarding para completar o editar el llenado de datos
  }

  // -------------------------------------------------------------
  // GUARD: Portal exclusivo de Coach (/coach/dashboard, etc., sin incluir onboarding)
  // -------------------------------------------------------------
  const isCoachPlansPath =
    strippedPathname === "/coach/plans" || strippedPathname.startsWith("/coach/plans/");
  const isCoachPortalPath =
    (strippedPathname === "/coach" || strippedPathname.startsWith("/coach/")) && !isCoachOnboardingPath;

  if (isCoachPortalPath) {
    // Si es estudiante/aprendiz, rebotar de inmediato con 307 a vista de cliente/aprendiz
    if (isStudent) {
      const destination = request.cookies.get("cfh_onboarding_completed")?.value === "false"
        ? "/student/onboarding"
        : "/dashboard";
      console.log("REDIRECT 7", destination);
      return NextResponse.redirect(getLocalizedUrl(destination, activeLocale, request), 307);
    }

    if (!isAuthenticated) {
      return createLoginRedirect(request, activeLocale, strippedPathname);
    }

    // Si es Coach y NO ha completado el onboarding, redirigir a /coach/onboarding (excepto si está viendo /coach/plans)
    if (isCoach && !isOnboardingCompleted && !isCoachPlansPath) {
      console.log("REDIRECT 4");
      return NextResponse.redirect(getLocalizedUrl("/coach/onboarding", activeLocale, request));
    }
  }

  // -------------------------------------------------------------
  // GUARD: Checkout de Alumno (/checkout) vs Suscripciones Coach (/checkout/plan)
  // -------------------------------------------------------------
  const isCheckoutPath = strippedPathname === "/checkout" || strippedPathname.startsWith("/checkout/");
  if (isCheckoutPath) {
    if (!isAuthenticated) {
      return createLoginRedirect(request, activeLocale, strippedPathname);
    }
    const isPlanCheckout = strippedPathname === "/checkout/plan" || strippedPathname.startsWith("/checkout/plan/");
    // Si un Coach intenta acceder al checkout de compra de cursos de estudiante
    if (isCoach && !isPlanCheckout) {
      return NextResponse.redirect(getLocalizedUrl("/coach/dashboard", activeLocale, request), 307);
    }
    // Si un Estudiante intenta acceder al checkout de planes de suscripción de coach
    if (isStudent && isPlanCheckout) {
      return NextResponse.redirect(getLocalizedUrl("/dashboard", activeLocale, request), 307);
    }
  }

  // -------------------------------------------------------------
  // GUARD: Rutas generales protegidas (/sesion, /student, /checkout, etc.)
  // -------------------------------------------------------------
  const isProtected = protectedRoutes.some((route) => strippedPathname.startsWith(route));
  if (isProtected && !isAuthenticated) {
    return createLoginRedirect(request, activeLocale, strippedPathname);
  }

  // Inyectar la ruta actual en los headers de la petición para Server Components y Layouts
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  request.headers.set('x-pathname', pathname);
  const response = intlMiddleware(request);
  response.headers.set('x-middleware-request-x-pathname', pathname);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
