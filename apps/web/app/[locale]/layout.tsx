import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "../globals.css";
import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { TranslationProvider } from "@/components/TranslationProvider";
import Footer from "@/components/Footer";

import HeaderProfile from "@/components/HeaderProfile";
import MobileNavDrawer from "@/components/MobileNavDrawer";
import NextAuthSessionProvider from "@/components/SessionProviderWrapper";
import { SessionWatcher } from "@/components/SessionWatcher";
import { AuthModalProvider } from "@/context/AuthModalContext";
import NotificationBell from "@/components/NotificationBell";
import CartButton from "@/components/CartButton";
import { CartProvider } from "@/context/CartContext";
import { ThemeProvider } from "@/context/ThemeContext";
import ThemeToggle from "@/components/ThemeToggle";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { getSuspensionDetails } from "@/lib/communityStrikes";
import FullScreenSuspensionScreen from "@/components/FullScreenSuspensionScreen";

import ClientGlobalModals from "@/components/ClientGlobalModals";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CFH - Educación que transforma",
  description: "Aprende hoy, transforma tu mañana.",
  icons: {
    icon: '/Logo.png',
  },
};

/**
 * RootLayout es el punto de entrada principal para toda la aplicación Next.js (App Router).
 * Aquí se definen los "Providers" globales que envuelven a todas las páginas, permitiendo
 * compartir estado (Autenticación, Idioma, Modales) en cualquier parte de la aplicación.
 * 
 * Tecnologías principales:
 * - Next.js (App Router)
 * - NextAuth (SessionProvider)
 * - Tailwind CSS & Framer Motion (UI)
 */
import { CFHIntlProvider } from '@/components/CFHIntlProvider';
import { getMessages } from 'next-intl/server';

export default async function RootLayout({
  children, params
}: Readonly<{ children: ReactNode; params: Promise<{ locale: string }> }>) {  // Obtener session (puede venir de NextAuth o custom)
  const resolvedParams = await params;
  const locale = resolvedParams.locale;
  const messages = await getMessages();
  const store = await cookies();
  const themeCookie = store.get("cfh_theme")?.value;
  const isDark = themeCookie !== "light";
  const activeRoleCookie = store.get("cfh_active_role")?.value;

  let sessionUser = null;
  const nextAuthSession = await auth();
  const customUser = await currentUser();
  const activeRole = activeRoleCookie || (customUser as any)?.role || (nextAuthSession?.user as any)?.role;
  
  if (customUser) {
    sessionUser = {
      ...customUser,
      avatarUrl: customUser.avatarUrl || null,
      coachPhotoUrl: customUser.coachProfile?.photoUrl || null,
      coachName: customUser.coachProfile?.displayName || null,
      activeRole,
    };
  } else if (nextAuthSession?.user) {
    sessionUser = {
      ...nextAuthSession.user,
      activeRole,
    };
  }

  // Verificar si la cuenta del usuario está suspendida
  let suspensionDetails = null;
  if (sessionUser?.id) {
    try {
      suspensionDetails = await getSuspensionDetails(sessionUser.id);
    } catch (suspErr) {
      console.error("Error al verificar estado de suspensión en RootLayout:", suspErr);
    }
  }

  // BLOQUEO TOTAL DE PANTALLA: Si la cuenta está suspendida, se oculta el 100% de la plataforma
  // (sin navbar, sin cursos, sin feed, sin dashboard, sin footer)
  if (suspensionDetails?.isSuspended) {
    return (
      <html lang={locale} className={`scroll-smooth ${isDark ? "dark" : ""}`} data-theme={isDark ? "dark" : "light"} suppressHydrationWarning>
        <body suppressHydrationWarning className={`${inter.className} bg-cfh-bg dark:bg-slate-950 text-cfh-text dark:text-slate-100 antialiased min-h-screen flex flex-col transition-colors duration-200`}>
          <CFHIntlProvider messages={messages} locale={locale}>
            <ThemeProvider>
            <NextAuthSessionProvider session={nextAuthSession}>
              <FullScreenSuspensionScreen details={suspensionDetails} />
            </NextAuthSessionProvider>
          </ThemeProvider>
          </CFHIntlProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang={locale} className={`scroll-smooth ${isDark ? "dark" : ""}`} data-theme={isDark ? "dark" : "light"} suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.className} bg-cfh-bg dark:bg-slate-950 text-cfh-text dark:text-slate-100 antialiased min-h-screen flex flex-col transition-colors duration-200 overflow-x-clip`}>
        {/* ThemeProvider: Provee el estado global de Modo Claro / Modo Oscuro */}
          <CFHIntlProvider messages={messages} locale={locale}>
            <ThemeProvider>
          {/* NextAuthSessionProvider: Mantiene la sesión del usuario viva en el cliente */}
          <NextAuthSessionProvider session={nextAuthSession}>
            <SessionWatcher />
            {/* AuthModalProvider: Controla el estado global (abierto/cerrado) de los modales de login/registro */}
            <AuthModalProvider>
              {/* TranslationProvider: Carga el diccionario JSON correcto según el idioma detectado/seleccionado */}
              <TranslationProvider>
                <CartProvider>
                {/* Modales globales lazy-loaded (Flotan sobre toda la aplicación) */}
                <ClientGlobalModals />
                
                {/* Unified Top Navbar (Desktop & Mobile) */}
                <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 transition-colors duration-200">
                  <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-6">
                    <div className="flex justify-between items-center h-20 sm:h-24 gap-2 lg:gap-4 xl:gap-6">
                      
                      {/* Left Side: Logo */}
                      <div className="shrink-0 flex items-center">
                        <Link href={`/${locale}`} className="flex items-center gap-2.5 sm:gap-3 hover:opacity-90 transition-opacity cursor-pointer">
                          <div className="relative w-11 h-11 sm:w-12 sm:h-12 shrink-0 transition-transform duration-300">
                            <Image
                              src="/Logo.png"
                              alt="CFH Logo"
                              width={48}
                              height={48}
                              priority
                              className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300 opacity-100 dark:opacity-0"
                            />
                            <Image
                              src="/Logo-dark.png"
                              alt="CFH Logo"
                              width={48}
                              height={48}
                              priority
                              className="absolute inset-0 w-full h-full object-contain rounded-2xl transition-opacity duration-300 opacity-0 dark:opacity-100"
                            />
                          </div>
                          <span className="font-black text-xl sm:text-2xl tracking-tight hidden sm:block text-cfh-dark-green dark:text-white transition-colors duration-300">
                            Coaching<span className="text-cfh-light-green">FromHome</span>
                          </span>
                        </Link>
                      </div>

                      {/* Center: Desktop Navigation */}
                      <div className="hidden xl:flex items-center justify-center flex-1 min-w-0 px-1 xl:px-1 2xl:px-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                        <Navigation initialUser={sessionUser} />
                      </div>

                      {/* Right Side: Actions & Profile */}
                      <div className="flex items-center gap-1 sm:gap-2 lg:gap-2.5 shrink-0">
                        {/* Selector de Modo Claro / Modo Oscuro */}
                        <ThemeToggle />
                        
                        {/* Language Selector (Client Component) - oculto en móviles muy pequeños ya que está en el drawer */}
                        <div className="hidden sm:flex">
                          <LanguageSwitcher />
                        </div>

                        {sessionUser && (
                          <>
                            <NotificationBell />
                            {activeRole !== "COACH" && <CartButton />}
                          </>
                        )}
                        <HeaderProfile initialUser={sessionUser} />
                        
                        {/* Mobile Navigation Drawer */}
                        <MobileNavDrawer initialUser={sessionUser} activeRole={activeRole} />
                      </div>

                    </div>
                  </div>
                </header>

          {/* Main Content Area */}
          <main className="flex-1 w-full min-h-0">
            <Suspense fallback={<div className="w-full min-h-[60vh] bg-cfh-bg dark:bg-slate-950" />}>
              {children}
            </Suspense>
          </main>

          <Footer />
                </CartProvider>
              </TranslationProvider>
            </AuthModalProvider>
          </NextAuthSessionProvider>
        </ThemeProvider>
          </CFHIntlProvider>
      </body>
    </html>
  );
}






