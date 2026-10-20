"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Check, Globe, X, ChevronDown } from "lucide-react";
import { useTranslation } from "./TranslationProvider";

export interface LanguageItem {
  code: string;
  countryCode: string;
  name: string;
  nativeName: string;
  flag: string;
  region: string;
  dir?: "ltr" | "rtl";
}

export const languages: LanguageItem[] = [
  { code: "ES", countryCode: "es", name: "Español", nativeName: "Español", flag: "🇪🇸", region: "LATAM / España" },
  { code: "EN", countryCode: "us", name: "English", nativeName: "English", flag: "🇺🇸", region: "Global / US / UK" },
  { code: "PT", countryCode: "br", name: "Português", nativeName: "Português", flag: "🇧🇷", region: "Brasil / Portugal" },
  { code: "FR", countryCode: "fr", name: "Français", nativeName: "Français", flag: "🇫🇷", region: "France / Canada" },
  { code: "DE", countryCode: "de", name: "Deutsch", nativeName: "Deutsch", flag: "🇩🇪", region: "Deutschland" },
  { code: "IT", countryCode: "it", name: "Italiano", nativeName: "Italiano", flag: "🇮🇹", region: "Italia" },
  { code: "ZH", countryCode: "cn", name: "Chino Mandarín", nativeName: "中文", flag: "🇨🇳", region: "China / Global" },
  { code: "JA", countryCode: "jp", name: "Japonés", nativeName: "日本語", flag: "🇯🇵", region: "Japan" },
  { code: "KO", countryCode: "kr", name: "Coreano", nativeName: "한국어", flag: "🇰🇷", region: "South Korea" },
  { code: "RU", countryCode: "ru", name: "Ruso", nativeName: "Русский", flag: "🇷🇺", region: "Russia / CIS" },
  { code: "AR", countryCode: "sa", name: "Árabe", nativeName: "العربية", flag: "🇸🇦", region: "Middle East", dir: "rtl" },
  { code: "HI", countryCode: "in", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳", region: "India" },
];

export default function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { locale, setLocale, t } = useTranslation();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const currentLang: LanguageItem = useMemo(
    () => languages.find((l) => l.code.toUpperCase() === locale.toUpperCase()) || (languages[0] as LanguageItem),
    [locale]
  );

  // Filtrado reactivo en tiempo real
  const filteredLanguages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return languages;
    return languages.filter(
      (lang) =>
        lang.name.toLowerCase().includes(q) ||
        lang.nativeName.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q) ||
        lang.region.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Enfocar buscador al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Bloquear scroll de la página mientras el dropdown está abierto
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [isOpen]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);


  const handleSelect = (code: string) => {
    const lowerCode = code.toLowerCase();
    setLocale(lowerCode);
    if (typeof window !== "undefined") {
      localStorage.setItem("cfh_language", lowerCode);
      document.cookie = `cfh_language=${lowerCode}; path=/; max-age=31536000; SameSite=Lax`;
      document.cookie = `NEXT_LOCALE=${lowerCode}; path=/; max-age=31536000; SameSite=Lax`;
      window.dispatchEvent(new Event("languageChange"));
    }
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Botón Trigger (Visible en Móvil y Desktop) */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Cambiar idioma" suppressHydrationWarning
        className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-gray-700 dark:text-slate-200 hover:text-cfh-dark-green dark:hover:text-cfh-light-green cursor-pointer bg-white hover:bg-gray-50 sm:bg-gray-50/90 sm:hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 px-2.5 sm:px-3 py-1.5 rounded-full sm:rounded-xl border border-gray-200/90 dark:border-slate-700 shadow-sm hover:border-cfh-light-green dark:hover:border-cfh-light-green transition-all"
      >
        <Globe className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green shrink-0" />
        <span className="font-black text-xs sm:text-sm tracking-wider text-cfh-dark-green dark:text-cfh-light-green">
          {currentLang.code}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 dark:text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-cfh-dark-green dark:text-cfh-light-green" : ""
          }`}
        />
      </button>

      {/* Popover / Modal Flotante */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop / Overlay para click outside (solo en móvil como modal) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40 sm:hidden"
            />

            {/* Menú de selección */}
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed sm:absolute bottom-4 left-4 right-4 sm:bottom-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-80 bg-white dark:bg-slate-900 border border-gray-100 sm:border-gray-200 dark:border-slate-800 rounded-3xl sm:rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[460px]"
            >
              {/* Encabezado */}
              <div className="p-4 pb-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/70">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-cfh-light-green/20 text-cfh-dark-green dark:text-cfh-light-green flex items-center justify-center">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-900 dark:text-slate-100 leading-tight">
                      {t("LanguageSwitcher.title") || "Seleccionar Idioma"}
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400">
                      {languages.length} {t("LanguageSwitcher.available_count") || "idiomas disponibles"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-full hover:bg-gray-200/60 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Buscador reactivo */}
              <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      t("LanguageSwitcher.search_placeholder") || "Buscar idioma o país..."
                    }
                    className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:border-cfh-light-green focus:bg-white dark:focus:bg-slate-800 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-full"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de Idiomas */}
              <div className="overflow-y-auto p-2 space-y-1 flex-1">
                {filteredLanguages.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    <p className="font-semibold text-gray-600 dark:text-slate-300">
                      {t("LanguageSwitcher.no_results") || "No se encontraron idiomas"}
                    </p>
                    <p className="text-[11px] mt-1">Prueba buscando en español o inglés</p>
                  </div>
                ) : (
                  filteredLanguages.map((lang) => {
                    const isSelected = lang.code.toUpperCase() === locale.toUpperCase();
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleSelect(lang.code)}
                        className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between transition-all group ${
                          isSelected
                            ? "bg-emerald-50/90 dark:bg-emerald-950/40 text-cfh-dark-green dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs"
                            : "hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-5 rounded overflow-hidden shadow-xs border border-gray-200/80 dark:border-slate-700 flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-slate-800">
                            <img
                              src={`https://flagcdn.com/w40/${lang.countryCode}.png`}
                              alt={lang.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-slate-100 group-hover:text-cfh-dark-green dark:group-hover:text-cfh-light-green truncate">
                                {lang.nativeName}
                              </span>
                              {lang.nativeName !== lang.name && (
                                <span className="text-[11px] text-gray-400 truncate">
                                  · {lang.name}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{lang.region}</p>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                              {t("LanguageSwitcher.active") || "Activo"}
                            </span>
                            <div className="w-5 h-5 rounded-full bg-cfh-dark-green text-white flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

