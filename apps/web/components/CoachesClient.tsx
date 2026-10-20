"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations, useLocale } from 'next-intl';
import { useAuthModal } from "../context/AuthModalContext";
import { AutoTranslate } from "./AutoTranslate";
import { useScrollLock } from "@/lib/scroll-lock";
import { Search, Loader2, PlayCircle, Star, Users, CheckCircle2, ChevronDown, Check, Lock, ArrowRight, UserCheck, Sparkles, SlidersHorizontal, Award } from 'lucide-react';

function CustomSelect({ 
  value, 
  onChange, 
  options, 
  placeholder,
  className = ""
}: { 
  value: string; 
  onChange: (val: string) => void; 
  options: {value: string, label: string}[]; 
  placeholder: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value);

  return (
    <div className={`relative ${className}`}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 py-3 px-4 rounded-xl shadow-sm cursor-pointer flex justify-between items-center hover:border-cfh-light-green transition-colors"
      >
        <span className="text-sm font-medium truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="max-h-60 overflow-y-auto py-1">
                {options.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`px-4 py-3 text-sm cursor-pointer flex items-center justify-between transition-colors ${
                      value === opt.value
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-cfh-dark-green dark:text-cfh-light-green font-bold'
                        : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {value === opt.value && <Check className="w-4 h-4 text-cfh-light-green flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Certificate {
  id: string;
  title: string;
  fileUrl: string;
  fileType: string;
  fileName: string;
  fileSize?: number | null;
  issuedBy?: string | null;
  issuedAt?: string | null;
}

interface Coach {
  id: string;
  displayName?: string | null;
  photoUrl?: string | null;
  user: {
    id: string;
    name: string;
    avatarUrl: string;
    countryCode: string | null;
  };
  headline: string;
  biography: string;
  hourlyRateCents: number;
  averageRating: number;
  reviewCount: number;
  completedSessionCount: number;
  introVideoUrl: string;
  currentTier: string;
  categories: Category[];
  showCertificates?: boolean;
  certificates?: Certificate[];
}

export default function CoachesClient({ initialCategories = [], initialUser = null }: { initialCategories?: Category[], initialUser?: any }) {
  const t = useTranslations("CoachesDirectory");
  const tRoot = useTranslations();
  const locale = useLocale();

  const translateCategory = (catName: string) => {
    if (!catName) return "";
    const key = catName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const translation = tRoot(`Categories.${key}`);
    return translation === `Categories.${key}` ? catName : translation;
  };

  const translateCoachName = (name: string) => {
    if (!name) return "";
    const match = name.match(/^Coach Experto (\d+)$/i);
    if (match) {
      return t("coach_name", { n: match[1] || "" });
    }
    return name;
  };

  const translateCoachHeadline = (headline: string) => {
    if (!headline) return "Coach";
    const match = headline.match(/^Experto en (.+)$/i);
    if (match) {
      const rawTopic = match[1]?.trim() || "";
      const key = rawTopic
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      const translatedTopic = t(`topics.${key}`);
      return t("expert_in", { topic: translatedTopic });
    }
    return headline;
  };

  const translateCoachBio = (bio: string, translatedName: string) => {
    if (!bio) return "";
    const match = bio.match(/^Soy el Coach Experto (\d+),/i);
    if (match) {
      return t("bio", { coachName: translatedName, n: match[1] || "" });
    }
    return bio;
  };

  const getCertifiedSpecialty = (coach: Coach) => {
    if (selectedCategory) {
      const selectedCat = initialCategories.find(c => c.slug === selectedCategory);
      if (selectedCat) return translateCategory(selectedCat.name) || selectedCat.name;
      const coachCat = coach.categories?.find(c => c.slug === selectedCategory);
      if (coachCat) return translateCategory(coachCat.name) || coachCat.name;
    }
    const firstCat = coach.categories?.[0];
    if (firstCat) {
      const rawName = (firstCat as any).name || (firstCat as any).category?.name || "";
      if (rawName) return translateCategory(rawName) || rawName;
    }
    return "su Especialidad";
  };

  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const { openLogin, openRegisterWithRole } = useAuthModal();
  
  const [currentUser, setCurrentUser] = useState<any>(initialUser);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [selectedCoachForBooking, setSelectedCoachForBooking] = useState<any>(null);
  
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filtros
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<number>(100);
  const [debouncedMaxPrice, setDebouncedMaxPrice] = useState<number>(100);
  const [sortBy, setSortBy] = useState<string>("level");
  const [nameSearch, setNameSearch] = useState<string>("");
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Ordenamiento reactivo de coaches según el criterio seleccionado
  const sortedCoaches = useMemo(() => {
    const list = [...coaches];
    if (sortBy === "level") {
      const tierWeight: Record<string, number> = {
        PLATINUM: 5,
        GOLD: 4,
        ELITE: 3,
        CURSOS_ONLY: 2,
        BASIC: 1,
      };
      return list.sort((a, b) => {
        const weightA = tierWeight[(a.currentTier || "").toUpperCase()] || 0;
        const weightB = tierWeight[(b.currentTier || "").toUpperCase()] || 0;
        if (weightB !== weightA) return weightB - weightA;
        if ((b.averageRating || 0) !== (a.averageRating || 0)) {
          return (b.averageRating || 0) - (a.averageRating || 0);
        }
        return (b.reviewCount || 0) - (a.reviewCount || 0);
      });
    }
    if (sortBy === "price_asc") {
      return list.sort((a, b) => (a.hourlyRateCents || 0) - (b.hourlyRateCents || 0));
    }
    if (sortBy === "price_desc") {
      return list.sort((a, b) => (b.hourlyRateCents || 0) - (a.hourlyRateCents || 0));
    }
    if (sortBy === "rating" || sortBy === "rating_desc") {
      return list.sort((a, b) => {
        const ratingDiff = (b.averageRating || 0) - (a.averageRating || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (b.reviewCount || 0) - (a.reviewCount || 0);
      });
    }
    if (sortBy === "rating_asc") {
      return list.sort((a, b) => {
        const ratingDiff = (a.averageRating || 0) - (b.averageRating || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (a.reviewCount || 0) - (b.reviewCount || 0);
      });
    }
    return list;
  }, [coaches, sortBy]);

  // Filtro por nombre (client-side, instantáneo)
  const filteredCoaches = useMemo(() => {
    if (!nameSearch.trim()) return sortedCoaches;
    const q = nameSearch.toLowerCase().trim();
    return sortedCoaches.filter(c => {
      const transName = translateCoachName(c.user?.name || "").toLowerCase();
      const nameMatch = (c.user?.name || "").toLowerCase().includes(q) || transName.includes(q);
      const transHeadline = translateCoachHeadline(c.headline || "").toLowerCase();
      const headlineMatch = (c.headline || "").toLowerCase().includes(q) || transHeadline.includes(q);
      const transBio = translateCoachBio(c.biography || "", transName).toLowerCase();
      const bioMatch = (c.biography || "").toLowerCase().includes(q) || transBio.includes(q);
      const categoryMatch = (c.categories || []).some(cat => {
        const transCat = translateCategory(cat.name || "").toLowerCase();
        return (cat.name || "").toLowerCase().includes(q) || transCat.includes(q);
      });
      return nameMatch || headlineMatch || bioMatch || categoryMatch;
    });
  }, [sortedCoaches, nameSearch, t]);

  // Debounce manual simple para el precio
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMaxPrice(maxPrice);
    }, 500);
    return () => clearTimeout(timer);
  }, [maxPrice]);

  const fetchCoaches = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (locale) params.append("lang", locale);
      if (selectedCategory) params.append("category", selectedCategory);
      if (debouncedMaxPrice < 100) params.append("maxPrice", debouncedMaxPrice.toString());
      
      const res = await fetch(`/api/coaches?${params.toString()}`);
      if (!res.ok) throw new Error("Error al cargar coaches");
      const data = await res.json();
      setCoaches(data.data || []);
    } catch (err) {
      setError(t("load_error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoaches();
  }, [selectedCategory, debouncedMaxPrice, locale]);

  

  const handleBookingClick = (coach: any, e: any) => {
    if (!currentUser) {
      e.preventDefault();
      setSelectedCoachForBooking(coach);
      setAuthPromptOpen(true);
    }
  };

  useScrollLock(authPromptOpen || Boolean(selectedVideo));

  useEffect(() => {
    if (!authPromptOpen && !selectedVideo) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (authPromptOpen) setAuthPromptOpen(false);
        if (selectedVideo) setSelectedVideo(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [authPromptOpen, selectedVideo]);

  const getTierBadge = (tier: string) => {
    switch(tier) {
      case 'ELITE': return "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case 'PLATINUM': return "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-300 dark:border-slate-700";
      case 'GOLD': return "bg-yellow-100 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800";
      case 'BASIC': return "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800";
      default: return "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-700";
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  const hasCoachProfile = !!currentUser?.coachProfile || currentUser?.role === "COACH" || currentUser?.activeRole === "COACH";

  return (
    <motion.div 
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-8"
    >
      {!hasCoachProfile && (
        <motion.div
          variants={itemVariants}
          className="bg-gradient-to-r from-[#081B33] via-[#0E2A50] to-[#153D73] rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 border border-blue-900/40"
        >
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

          <div className="relative z-10 max-w-2xl flex flex-col gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/50 border border-blue-400/30 text-blue-200 text-xs font-bold uppercase tracking-wider w-fit">
              <Sparkles className="w-3.5 h-3.5" />
              {t("for_pros")}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              {t("banner_title")}
            </h2>
            <p className="text-sm text-gray-300 leading-relaxed">
              {t("banner_desc")}
            </p>
          </div>

          <button
            onClick={() => {
              if (!currentUser) {
                openRegisterWithRole("COACH");
              } else {
                window.location.href = `/${locale}/coach/onboarding`;
              }
            }}
            className="z-10 bg-[#A7D4B6] hover:bg-white text-[#081B33] font-black text-sm sm:text-base px-6 py-4 rounded-2xl shadow-lg transition-all transform hover:scale-105 shrink-0 flex items-center gap-2"
          >
            {!currentUser ? t("register_as_coach") : t("become_coach")}
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      )}


      {/* 🔍 Barra de Búsqueda por Nombre / Especialidad y Filtros Rápidos */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="w-5 h-5 text-gray-400 dark:text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              placeholder={t("search_placeholder")}
              className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 pl-11 pr-10 py-3 rounded-2xl text-sm font-medium text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-cfh-light-green focus:ring-2 focus:ring-cfh-light-green/20 shadow-xs transition-all"
            />
            {nameSearch && (
              <button
                onClick={() => setNameSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-full"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 🌟 Apartado de acceso rápido: Mejor a Menor Calificado, Nivel y Precios */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-gray-400 dark:text-slate-500 font-extrabold uppercase tracking-wider text-xs sm:text-sm mr-1">
            {t("sortBy")}
          </span>
          <button
            type="button"
            onClick={() => setSortBy(sortBy === "rating" ? "level" : "rating")}
            className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shadow-xs ${
              sortBy === "rating" || sortBy === "rating_desc"
                ? "bg-amber-500 text-white shadow-amber-500/25 ring-2 ring-amber-400/50"
                : "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400"
            }`}
          >
            <Star className={`w-3.5 sm:w-4.5 h-3.5 sm:h-4.5 ${sortBy === "rating" || sortBy === "rating_desc" ? "fill-white text-white" : "fill-amber-400 text-amber-400"}`} />
            {t("sortRating")}
          </button>
          <button
            type="button"
            onClick={() => setSortBy("level")}
            className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shadow-xs ${
              sortBy === "level"
                ? "bg-cfh-dark-green text-white shadow-emerald-500/25 ring-2 ring-emerald-400/50"
                : "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            <Sparkles className="w-3.5 sm:w-4.5 h-3.5 sm:h-4.5 text-cfh-light-green" />
            {t("sortLevel")}
          </button>
          <button
            type="button"
            onClick={() => setSortBy("price_asc")}
            className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shadow-xs ${
              sortBy === "price_asc"
                ? "bg-emerald-600 text-white shadow-emerald-600/25 ring-2 ring-emerald-400/50"
                : "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            {t("sortPriceAsc")}
          </button>
          <button
            type="button"
            onClick={() => setSortBy("price_desc")}
            className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shadow-xs ${
              sortBy === "price_desc"
                ? "bg-emerald-600 text-white shadow-emerald-600/25 ring-2 ring-emerald-400/50"
                : "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-200 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            {t("sortPriceDesc")}
          </button>
        </div>

        {/* Botón de Filtros para Pantallas Pequeñas */}
        <div className="flex items-center gap-3 md:hidden pt-2">
          <button
            type="button"
            onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-gray-700 dark:text-slate-200 shadow-xs hover:border-cfh-light-green transition-all"
          >
            <SlidersHorizontal className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
            <span>{isMobileFiltersOpen ? "Ocultar Filtros" : "Mostrar Filtros"}</span>
            {(selectedCategory || maxPrice < 100) && (
              <span className="w-5 h-5 bg-cfh-dark-green text-white text-[11px] font-black rounded-full flex items-center justify-center">
                {(selectedCategory ? 1 : 0) + (maxPrice < 100 ? 1 : 0)}
              </span>
            )}
          </button>
        </div>
      </motion.div>

      {/* Contenedor Principal: Sidebar + Contenido */}
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* 🧭 SIDEBAR DE FILTROS (Formato idéntico a Cursos con toggle móvil) */}
        <motion.aside
          variants={itemVariants}
          className={`w-full md:w-72 flex-shrink-0 flex flex-col gap-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm ${
            isMobileFiltersOpen ? "block" : "hidden md:flex"
          }`}
        >
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
              <h2 className="font-extrabold text-lg text-cfh-dark-green dark:text-slate-100">{t("search_filters")}</h2>
            </div>
            {(selectedCategory || maxPrice < 100 || nameSearch) && (
              <button
                onClick={() => { setSelectedCategory(""); setMaxPrice(100); setNameSearch(""); }}
                className="text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 transition-colors"
              >
                {t("clear")}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-5">
            {/* Filtro por Especialidad */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {t("specialty")}
              </label>
              <CustomSelect
                value={selectedCategory}
                onChange={setSelectedCategory}
                options={[
                  { value: "", label: t("any_subject") },
                  ...initialCategories.map(cat => ({ value: cat.slug, label: translateCategory(cat.name) }))
                ]}
                placeholder={t("select_specialty")}
              />
            </div>

            {/* Filtro por Precio Máximo */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t("max_price")}</label>
                <span className="text-sm font-bold text-cfh-light-green">${maxPrice === 100 ? "100+" : maxPrice}/hr</span>
              </div>
              <input 
                type="range" 
                value={maxPrice}
                onChange={(e) => setMaxPrice(parseInt(e.target.value, 10))}
                className="w-full accent-cfh-light-green cursor-pointer"
                min="5"
                max="100"
                step="5"
              />
            </div>

            {/* Botón Restablecer Filtros */}
            {(selectedCategory || maxPrice < 100 || nameSearch) && (
              <button
                onClick={() => { setSelectedCategory(""); setMaxPrice(100); setNameSearch(""); }}
                className="mt-2 w-full py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 text-xs font-bold hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-400 transition-all flex items-center justify-center gap-1.5"
              >
                {t("reset_filters")}
              </button>
            )}
          </div>
        </motion.aside>

        {/* 📚 CONTENIDO: Header con Contador + Select de Ordenamiento + Cards */}
        <div className="flex-1 w-full flex flex-col gap-6">
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm"
          >
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-cfh-text dark:text-slate-100 tracking-tight flex items-center gap-2">
                <span>{loading ? "..." : filteredCoaches.length}</span>
                <span className="text-gray-500 dark:text-slate-400 font-medium text-lg sm:text-xl">
                  {t("coaches_available")}
                </span>
              </h1>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                {t("subtitle")}
              </p>
            </div>
          </motion.div>

          {/* Banner indicador cuando está activo el orden por calificación */}
          {(sortBy === "rating" || sortBy === "rating_desc") && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 px-4 py-3 bg-amber-500/10 border border-amber-400/30 rounded-2xl text-xs font-medium text-amber-900 dark:text-amber-200"
            >
              <Star className="w-4 h-4 fill-amber-400 text-amber-500 shrink-0" />
              <span>
                {t("activeSortLabel")} <strong>{t("activeSortRating")}</strong> {t("activeSortDesc")}
              </span>
            </motion.div>
          )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900">{error}</div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-16 shadow-sm flex flex-col items-center justify-center text-center">
            <Loader2 className="w-12 h-12 text-cfh-dark-green dark:text-cfh-light-green animate-spin mb-4" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">{t("loadingTitle")}</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{t("loadingDesc")}</p>
          </div>
        ) : filteredCoaches.length === 0 ? (
          // Estado Vacío
          <div className="text-center py-20 bg-gray-50 dark:bg-slate-900/60 rounded-3xl border border-gray-100 dark:border-slate-800">
            <Search className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">
              {nameSearch ? t("empty_title_query", { q: nameSearch }) : t('empty_title')}
            </h3>
            <p className="text-gray-500 dark:text-slate-400 text-sm">{t('empty_desc')}</p>
          </div>
        ) : (
          // Tarjetas de Coaches Filtradas
          filteredCoaches.map((coach) => (
            <motion.div variants={itemVariants} key={coach.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-lg transition-shadow flex flex-col lg:flex-row gap-6">
              
              {/* Izquierda: Video Thumbnail & Foto */}
              <div className="w-full lg:w-[280px] flex-shrink-0 relative group">
                <div className="w-full h-[180px] rounded-2xl overflow-hidden relative cursor-pointer bg-gray-900" onClick={() => setSelectedVideo(coach.introVideoUrl)}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 bg-white/90 dark:bg-slate-900/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <PlayCircle className="w-6 h-6 text-cfh-dark-green dark:text-cfh-light-green" />
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full border-4 border-white dark:border-slate-900 overflow-hidden shadow-md bg-white dark:bg-slate-900">
                  <img
                    src={(coach as any).photoUrl || coach.user.avatarUrl || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop"}
                    alt={coach.user.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(coach.user.name)}&background=081B33&color=A7D4B6&bold=true`;
                    }}
                  />
                </div>
              </div>

              {/* Medio: Información del Coach */}
              <div className="flex-1 min-w-0 pt-2 lg:pt-0 pl-0 lg:pl-4 mt-4 lg:mt-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <Link href={`/${locale}/coaches/${coach.id}`} className="hover:underline min-w-0">
                        <h3 className="text-xl sm:text-2xl font-black text-cfh-text dark:text-slate-100 flex items-center gap-2 break-words [overflow-wrap:anywhere]">
                          {translateCoachName(coach.displayName || coach.user.name)}
                          <CheckCircle2 className="w-5 h-5 text-cfh-light-green shrink-0" />
                        </h3>
                      </Link>
                      {coach.currentTier && (
                        <span className={`px-2 py-0.5 border text-xs font-extrabold uppercase rounded-full shrink-0 ${getTierBadge(coach.currentTier)}`}>
                          {coach.currentTier}
                        </span>
                      )}
                    </div>
                    <p className="text-base font-bold text-cfh-light-green break-words [overflow-wrap:anywhere] line-clamp-2">
                      <AutoTranslate text={coach.headline} fallback="Coach" />
                    </p>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <p className="text-2xl sm:text-3xl font-black text-cfh-dark-green dark:text-cfh-light-green">${(coach.hourlyRateCents / 100).toFixed(0)}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{t('per_hour')}</p>
                  </div>
                </div>

                {/* Distintivo de Certificaciones */}
                {coach.showCertificates && coach.certificates && coach.certificates.length > 0 && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs sm:text-sm font-extrabold mb-3 shadow-xs max-w-full">
                    <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">{t("coach_certified", { specialty: getCertifiedSpecialty(coach) })}</span>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs font-medium text-gray-600 dark:text-slate-300 mb-4">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-cfh-text dark:text-slate-100 font-bold">{coach.averageRating.toFixed(1)}</span>
                    <span className="text-gray-400 dark:text-slate-400">({coach.reviewCount} {t('reviews')})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                    <span>{coach.completedSessionCount} {t('students')}</span>
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed mb-4 line-clamp-3 break-words [overflow-wrap:anywhere] overflow-hidden">
                  <AutoTranslate text={coach.biography} />
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-auto">
                  {coach.categories.map(cat => (
                    <span key={cat.id} className="px-3.5 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 text-xs sm:text-sm font-bold rounded-full">
                      {translateCategory(cat.name)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="w-full lg:w-[180px] flex-shrink-0 flex flex-col justify-end gap-3 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-slate-800 pt-4 lg:pt-0 lg:pl-6">
                <Link href={`/${locale}/coaches/${coach.id}?book=1`} onClick={(e) => handleBookingClick(coach, e)} className="w-full">
                  <button className="w-full py-3 bg-cfh-dark-green hover:bg-[#061528] text-white text-sm font-bold rounded-xl transition-colors shadow-md cursor-pointer">
                    {t('book_session')}
                  </button>
                </Link>
                <Link href={`/${locale}/coaches/${coach.id}`} className="w-full">
                  <button className="w-full py-3 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 hover:border-cfh-light-green dark:hover:border-cfh-light-green text-cfh-text dark:text-slate-200 text-sm font-bold rounded-xl transition-colors cursor-pointer">
                    {t('view_profile')}
                  </button>
                </Link>
              </div>
            </motion.div>
          ))
        )}
        </div>
      </div>

      {/* Modal de Alerta / Requerimiento de Autenticación para Alumnos */}
      <AnimatePresence>
        {authPromptOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAuthPromptOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl relative text-center"
            >
              <button
                onClick={() => setAuthPromptOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-2 cursor-pointer"
              >
                ✕
              </button>

              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/50 text-cfh-dark-green dark:text-cfh-light-green rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 dark:border-blue-900 shadow-sm">
                <Lock className="w-8 h-8" />
              </div>

              <h3 className="text-2xl font-extrabold text-cfh-text dark:text-slate-100 mb-2">
                {t("login_to_book")}
              </h3>

              <p className="text-sm text-gray-600 dark:text-slate-300 mb-6 leading-relaxed">
                {t("login_to_book_desc_prefix")}{" "}
                <strong className="text-gray-900 dark:text-slate-100">{selectedCoachForBooking?.user?.name}</strong>
                {t("login_to_book_desc_suffix")}
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setAuthPromptOpen(false);
                    openRegisterWithRole("STUDENT");
                  }}
                  className="w-full py-3.5 bg-cfh-light-green text-cfh-dark-green font-extrabold text-sm rounded-xl shadow-md hover:bg-cfh-dark-green hover:text-white transition-all cursor-pointer"
                >
                  {t("register_student_btn")}
                </button>

                <button
                  onClick={() => {
                    setAuthPromptOpen(false);
                    openLogin();
                  }}
                  className="w-full py-3 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 text-cfh-text dark:text-slate-200 font-bold text-sm rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {t("login_btn")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Video */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedVideo(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedVideo(null)}
                className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors"
              >
                X
              </button>
              <video 
                src={selectedVideo} 
                controls 
                autoPlay 
                className="w-full h-full object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
