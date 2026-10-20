"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "cfh_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [mounted, setMounted] = useState(false);

  // Determinar si el sistema prefiere modo oscuro
  const getSystemTheme = (): ResolvedTheme => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  };

  // Aplicar o remover clase 'dark' en el elemento raíz <html>
  const applyThemeClass = (activeTheme: ResolvedTheme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (activeTheme === "light") {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    } else {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    }
  };

  // Inicializar estado desde localStorage al montar en el cliente
  useEffect(() => {
    let savedTheme: Theme = "dark";
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme;
      if (stored === "light" || stored === "dark" || stored === "system") {
        savedTheme = stored;
      }
    } catch {
      // Ignorar errores de acceso a almacenamiento
    }
    setThemeState(savedTheme);

    const active = savedTheme === "system" ? getSystemTheme() : savedTheme;
    setResolvedTheme(active);
    applyThemeClass(active);
    try {
      document.cookie = `${STORAGE_KEY}=${active}; path=/; max-age=31536000; SameSite=Lax`;
    } catch (_) {}
    setMounted(true);
  }, []);

  // Guardar y cambiar tema
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
      // Guardar cookie ligera para persistencia opcional del lado servidor
      document.cookie = `${STORAGE_KEY}=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Ignorar errores de almacenamiento
    }

    const active = newTheme === "system" ? getSystemTheme() : newTheme;
    setResolvedTheme(active);
    applyThemeClass(active);
  };

  // Alternar entre claro y oscuro
  const toggleTheme = () => {
    const nextTheme: Theme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  // Escuchar cambios en la preferencia del sistema operativo si el tema es 'system'
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      let currentStored: Theme = theme;
      try {
        const stored = localStorage.getItem(STORAGE_KEY) as Theme;
        if (stored) currentStored = stored;
      } catch {}

      if (currentStored === "system") {
        const active: ResolvedTheme = mediaQuery.matches ? "dark" : "light";
        setResolvedTheme(active);
        applyThemeClass(active);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Sincronización multi-pestaña (StorageEvent)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const val = e.newValue as Theme;
        if (val === "light" || val === "dark" || val === "system") {
          setThemeState(val);
          const active = val === "system" ? getSystemTheme() : val;
          setResolvedTheme(active);
          applyThemeClass(active);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme debe ser utilizado dentro de un ThemeProvider");
  }
  return context;
}
