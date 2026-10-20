"use client";

import React, { useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

export function useTranslation() {
  let tNextIntl: any = null;
  let locale = 'es';

  try {
    tNextIntl = useTranslations();
  } catch (_) {
    // Si useTranslations falla durante SSR o desincronización de contexto
  }

  try {
    locale = useLocale() || 'es';
  } catch (_) {
    locale = 'es';
  }

  const router = useRouter();
  const pathname = usePathname() || '';

  const setLocale = useCallback((newLocale: string) => {
    const query = typeof window !== 'undefined' && window.location.search ? window.location.search : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    
    // El pathname nativo de next/navigation incluye el prefijo actual (ej. /es/dashboard)
    // Lo removemos usando el locale actual.
    let strippedPath = pathname;
    if (pathname.startsWith('/' + locale + '/')) {
      strippedPath = pathname.substring(locale.length + 1);
    } else if (pathname === '/' + locale) {
      strippedPath = '/';
    }

    const normLocale = newLocale.toLowerCase();
    let newPath = '/' + normLocale;
    if (strippedPath && strippedPath !== '/') {
      // Si strippedPath no empieza con /, agregamos uno
      if (!strippedPath.startsWith('/')) {
        newPath += '/';
      }
      newPath += strippedPath;
    }
    
    newPath += query + hash;

    if (typeof window !== "undefined") {
      localStorage.setItem("cfh_language", normLocale);
      document.cookie = `cfh_language=${normLocale}; path=/; max-age=31536000; SameSite=Lax`;
      document.cookie = `NEXT_LOCALE=${normLocale}; path=/; max-age=31536000; SameSite=Lax`;
      window.dispatchEvent(new Event("languageChange"));
      window.location.href = newPath;
    }
  }, [locale, pathname, router]);

  const t = useCallback((
    keyString: string,
    arg2?: string | Record<string, any>,
    arg3?: string | Record<string, any>
  ) => {
    let params: Record<string, any> | undefined = undefined;
    let fallbackText: string | undefined = undefined;

    if (typeof arg2 === 'string') {
      fallbackText = arg2;
      if (typeof arg3 === 'object') params = arg3;
    } else if (typeof arg2 === 'object' && arg2 !== null) {
      params = arg2;
      if (typeof arg3 === 'string') fallbackText = arg3;
    }

    try {
      if (!tNextIntl) {
        return fallbackText || keyString;
      }
      let res;
      if (params && Object.keys(params).length > 0) {
        res = tNextIntl(keyString as any, params as any);
      } else {
        res = tNextIntl(keyString as any);
      }
      if (res === keyString && fallbackText) {
        return fallbackText;
      }
      return res;
    } catch (e) {
      return fallbackText || keyString;
    }
  }, [tNextIntl]);

  return { t, locale, setLocale };
}

// We also export an empty provider just in case it's used in layout
export function TranslationProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
