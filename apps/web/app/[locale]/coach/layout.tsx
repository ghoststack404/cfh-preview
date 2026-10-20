import type { ReactNode } from "react";
import { getAuthenticatedUser } from "@/app/actions/onboarding";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { locales, defaultLocale } from "@/i18n";

export default async function CoachLayout({
  children,
  params,
}: {
  children: ReactNode;
  params?: Promise<{ locale?: string }>;
}) {
  const resolvedParams = params ? await params : undefined;
  const store = await cookies();
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || headerList.get("x-middleware-request-x-pathname") || "";

  // Determine active locale: route params -> pathname prefix -> cookie -> default
  const pathnameMatch = pathname.match(/^\/([a-z]{2})(?:\/|$)/);
  const cookieLocale = (store.get("NEXT_LOCALE")?.value || store.get("cfh_language")?.value || "").toLowerCase();
  const rawLocale = resolvedParams?.locale || pathnameMatch?.[1] || cookieLocale || defaultLocale;
  const locale = locales.includes(rawLocale) ? rawLocale : defaultLocale;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/api/auth/clear-session");
  }

  if (pathname.includes("/coach/onboarding") || pathname.includes("/onboarding/coach")) {
    return <>{children}</>;
  }

  const activeRole = store.get("cfh_active_role")?.value;

  // Explicit role isolation: If activeRole is explicitly STUDENT, isolate and redirect to student dashboard
  if (activeRole === "STUDENT") {
    redirect(`/${locale}/dashboard`);
  }

  const isCoach = user.role === "COACH" || user.role === "ADMIN" || activeRole === "COACH";

  if (!isCoach) {
    redirect(`/${locale}/dashboard`);
  }

  if (user.role !== "COACH" && user.role !== "ADMIN") {
    redirect(`/${locale}/coach/onboarding`);
  }

  return <>{children}</>;
}

