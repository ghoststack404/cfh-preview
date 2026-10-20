"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "./TranslationProvider";
import { fetchDynamicTranslation } from "@/lib/i18n-helpers";

interface AutoTranslateProps {
  text?: string | null;
  as?: React.ElementType;
  className?: string;
  fallback?: string;
}

/**
 * Componente React que traduce texto dinámico (proveniente de Base de Datos o inputs de usuario)
 * de forma reactiva al idioma actual de la aplicación, usando caché en memoria.
 */
export function AutoTranslate({
  text,
  as: Component = "span",
  className,
  fallback = "",
}: AutoTranslateProps) {
  const { locale } = useTranslation();
  const [translated, setTranslated] = useState<string>(text || fallback);

  useEffect(() => {
    if (!text || !text.trim()) {
      setTranslated(fallback);
      return;
    }

    const currentLang = locale?.toLowerCase() || "es";
    if (currentLang === "es") {
      setTranslated(text);
      return;
    }

    let isMounted = true;
    fetchDynamicTranslation(text, currentLang, "es").then((res) => {
      if (isMounted && res) {
        setTranslated(res);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [text, locale, fallback]);

  return <Component className={className}>{translated}</Component>;
}

export default AutoTranslate;
