"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "./TranslationProvider";
import { translateCoachName, translateCategory as helperTranslateCategory } from "@/lib/i18n-helpers";
import { AutoTranslate } from "./AutoTranslate";
import AddToCartButton from "./AddToCartButton";
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  Check,
  Star,
  X,
  Filter,
  BookOpen,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  Tag,
  Heart,
  Flame,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowDownNarrowWide,
  ArrowUpWideNarrow,
} from "lucide-react";

export interface CourseItem {
  id: string;
  title: string;
  author: string;
  category?: string;
  categoryId?: string;
  rating: number;
  reviews: number;
  price: number;
  originalPrice: number;
  bestseller: boolean;
  img: string;
  createdAt?: string;
  isEnrolled?: boolean;
}

export default function CursosClient({
  courses,
  categories
}: {
  courses: CourseItem[];
  categories: string[];
}) {
  const { t } = useTranslation();

  const translateCategory = (cat: string) => {
    if (!cat) return "";
    return helperTranslateCategory(cat, t);
  };

  const translateCourseTitle = (course: CourseItem) => {
    if (course.id?.startsWith("sample-")) {
      return t(`SampleCourses.${course.id}.title`, course.title);
    }
    return course.title;
  };

  // Estados de Filtros y Ordenamiento
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"popular" | "rating" | "newest" | "price_asc" | "price_desc">("popular");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [savedCourseIds, setSavedCourseIds] = useState<string[]>([]);
  const [onlySaved, setOnlySaved] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Exclusión estricta de salud/medicina por motivos regulatorios y legales
  const HEALTH_EXCLUSION_REGEX = useMemo(() => {
    return /\b(salud|medicina|m[eé]dic[ao]s?|nutrici[oó]n|cl[ií]nic[ao]s?|psicolog[ií]a|farmac[ií]a|farmac[eé]utic[ao]s?|tratamientos?|diagn[oó]sticos?|terapia|hospital|m[eé]dic|terap[eé]utic[ao]s?|psiquiatr[ií]a|patolog[ií]a|enfermedad|s[ií]ntoma|rehabilitaci[oó]n)\b/i;
  }, []);

  // Categorías base sanitizadas sin categorías de salud médica
  const sanitizedCategories = useMemo(() => {
    return categories.filter((cat) => !HEALTH_EXCLUSION_REGEX.test(cat));
  }, [categories, HEALTH_EXCLUSION_REGEX]);

  // Lista de categorías para el sidebar: filtradas por búsqueda en tiempo real
  const visibleSidebarCategories = useMemo(() => {
    if (!categorySearch.trim()) return sanitizedCategories;
    const q = categorySearch.toLowerCase().trim();
    return sanitizedCategories.filter((cat) => {
      const translated = translateCategory(cat).toLowerCase();
      return cat.toLowerCase().includes(q) || translated.includes(q);
    });
  }, [sanitizedCategories, categorySearch]);

  // Cargar cursos guardados (Wishlist estilo Udemy) desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cfh_saved_courses");
      if (saved) {
        setSavedCourseIds(JSON.parse(saved));
      }
    } catch {}
  }, []);

  // Alternar guardado con actualización optimista instantánea
  const toggleSaveCourse = (courseId: string) => {
    setSavedCourseIds((prev) => {
      const next = prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId];
      try {
        localStorage.setItem("cfh_saved_courses", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setIsSortOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll de categorías con flechas estilo Udemy / YouTube
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollable = () => {
    const el = categoryScrollRef.current;
    if (el) {
      const hasOverflow = el.scrollWidth > el.clientWidth;
      setCanScrollLeft(el.scrollLeft > 10);
      setCanScrollRight(hasOverflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    }
  };

  useEffect(() => {
    // Verificar estado inicial tras renderizado
    const timer = setTimeout(checkScrollable, 100);
    const el = categoryScrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScrollable, { passive: true });
    window.addEventListener("resize", checkScrollable);
    return () => {
      clearTimeout(timer);
      el.removeEventListener("scroll", checkScrollable);
      window.removeEventListener("resize", checkScrollable);
    };
  }, [categories]);

  const handleScrollCategories = (direction: "left" | "right") => {
    const el = categoryScrollRef.current;
    if (el) {
      const scrollDistance = 280;
      el.scrollBy({
        left: direction === "left" ? -scrollDistance : scrollDistance,
        behavior: "smooth"
      });
      setTimeout(checkScrollable, 320);
    }
  };

  // Alternar selección de categoría (mantiene formato de checkboxes)
  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  // Alternar calificación
  const toggleRating = (rating: number) => {
    setSelectedRating((prev) => (prev === rating ? null : rating));
  };

  // Limpiar todos los filtros
  const clearAllFilters = () => {
    setSelectedCategories([]);
    setCategorySearch("");
    setSelectedRating(null);
    setSearchQuery("");
    setSortBy("popular");
    setOnlySaved(false);
  };

  const hasActiveFilters =
    selectedCategories.length > 0 || selectedRating !== null || searchQuery.trim() !== "" || onlySaved || categorySearch.trim() !== "";

  // Conteo de cursos por categoría
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    courses.forEach((c) => {
      if (c.category) {
        counts[c.category] = (counts[c.category] || 0) + 1;
      }
    });
    return counts;
  }, [courses]);

  // Conteo de cursos por calificación
  const ratingCounts = useMemo(() => {
    return {
      4.5: courses.filter((c) => c.rating >= 4.5).length,
      4.0: courses.filter((c) => c.rating >= 4.0).length,
      3.5: courses.filter((c) => c.rating >= 3.5).length,
      3.0: courses.filter((c) => c.rating >= 3.0).length,
    };
  }, [courses]);

  // Opciones de Ordenamiento con Iconos Profesionales Lucide
  const sortOptions = [
    {
      id: "popular" as const,
      label: t("CoursesDirectory.most_popular") || "Más Populares",
      icon: Flame,
      iconColor: "text-amber-500",
    },
    {
      id: "rating" as const,
      label: t("CoursesDirectory.highest_rated") || "Mejor Calificados",
      icon: Star,
      iconColor: "text-amber-400 fill-amber-400",
    },
    {
      id: "newest" as const,
      label: t("CoursesDirectory.newest") || "Más Nuevos",
      icon: Clock,
      iconColor: "text-sky-500",
    },
    {
      id: "price_asc" as const,
      label: t("CoursesDirectory.price_lower") || "Menor Precio",
      icon: ArrowDownNarrowWide,
      iconColor: "text-emerald-500",
    },
    {
      id: "price_desc" as const,
      label: t("CoursesDirectory.price_higher") || "Mayor Precio",
      icon: ArrowUpWideNarrow,
      iconColor: "text-indigo-500",
    },
  ];

  const currentSortOption =
    sortOptions.find((o) => o.id === sortBy) ?? sortOptions[0]!;

  // Lógica de Filtrado y Ordenamiento Reactiva
  const filteredCourses = useMemo(() => {
    return courses
      .filter((c) => {
        // Filtro de categorías
        if (selectedCategories.length > 0) {
          if (!c.category || !selectedCategories.includes(c.category)) {
            return false;
          }
        }

        // Filtro de calificación mínima
        if (selectedRating !== null) {
          if (c.rating < selectedRating) {
            return false;
          }
        }

        // Filtro de búsqueda por texto
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const translatedTitle = translateCourseTitle(c).toLowerCase();
          const matchTitle = c.title.toLowerCase().includes(q) || translatedTitle.includes(q);
          const translatedAuthor = translateCoachName(c.author, t).toLowerCase();
          const matchAuthor = c.author.toLowerCase().includes(q) || translatedAuthor.includes(q);
          const translatedCategory = translateCategory(c.category || "").toLowerCase();
          const matchCategory = (c.category || "").toLowerCase().includes(q) || translatedCategory.includes(q);
          if (!matchTitle && !matchAuthor && !matchCategory) {
            return false;
          }
        }

        // Filtro de solo guardados (Wishlist estilo Udemy)
        if (onlySaved) {
          if (!savedCourseIds.includes(c.id)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "popular") return b.reviews - a.reviews;
        if (sortBy === "rating") return b.rating - a.rating;
        if (sortBy === "newest") {
          return (
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );
        }
        if (sortBy === "price_asc") return a.price - b.price;
        if (sortBy === "price_desc") return b.price - a.price;
        return 0;
      });
  }, [courses, selectedCategories, selectedRating, searchQuery, sortBy, onlySaved, savedCourseIds, t]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-8"
    >
      {/* 🔍 Barra de Búsqueda y Botón Filtros Móvil */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search className="w-5 h-5 text-gray-400 dark:text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("CoursesDirectory.search_placeholder", "Buscar por título, temática o coach...")}
            className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 pl-11 pr-10 py-3 rounded-2xl text-sm font-medium text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-cfh-light-green focus:ring-2 focus:ring-cfh-light-green/20 shadow-xs transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Botón de Filtros para Pantallas Pequeñas */}
        <div className="flex items-center gap-3 md:hidden">
          <button
            type="button"
            onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-gray-700 dark:text-slate-200 shadow-xs hover:border-cfh-light-green transition-all"
          >
            <Filter className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
            <span>{t("CoursesDirectory.filters", "Filtros")}</span>
            {(selectedCategories.length > 0 || selectedRating !== null) && (
              <span className="w-5 h-5 bg-cfh-dark-green text-white text-[11px] font-black rounded-full flex items-center justify-center">
                {selectedCategories.length + (selectedRating !== null ? 1 : 0)}
              </span>
            )}
          </button>
        </div>
      </motion.div>

      {/* 🚀 Barra de Píldoras de Categorías y Guardados Estilo Udemy con Flechas de Navegación */}
      <motion.div variants={itemVariants} className="relative -mt-4 mb-2">
        {/* Flecha Izquierda con Desvanecido Suave */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center pr-8 bg-gradient-to-r from-slate-50 via-slate-50/95 to-transparent dark:from-[#080d1a] dark:via-[#080d1a]/95 pointer-events-none">
            <button
              type="button"
              onClick={() => handleScrollCategories("left")}
              className="pointer-events-auto w-8 h-8 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-md flex items-center justify-center text-gray-700 dark:text-slate-200 hover:text-cfh-dark-green dark:hover:text-cfh-light-green hover:scale-110 active:scale-95 transition-all cursor-pointer"
              title={t("Common.previous", "Ver anteriores")}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Contenedor Scrollable SIN la barra nativa del navegador */}
        <div
          ref={categoryScrollRef}
          onScroll={checkScrollable}
          className="flex items-center gap-2 overflow-x-auto py-1 px-1 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            onClick={() => {
              setSelectedCategories([]);
              setOnlySaved(false);
            }}
            className={`px-5 py-2.5 rounded-full text-sm sm:text-base font-extrabold transition-all whitespace-nowrap cursor-pointer shrink-0 shadow-2xs ${
              selectedCategories.length === 0 && !onlySaved
                ? "bg-cfh-dark-green text-white dark:bg-cfh-light-green dark:text-cfh-dark-green shadow-xs"
                : "bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-800 hover:border-cfh-light-green"
            }`}
          >
            {t("CoursesDirectory.all_courses", "Todos los cursos")}
          </button>

          {/* Botón Guardados (Wishlist estilo Udemy con Optimistic UI) */}
          <button
            type="button"
            onClick={() => setOnlySaved(!onlySaved)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 shadow-2xs ${
              onlySaved
                ? "bg-rose-500 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-800 hover:border-rose-400"
            }`}
          >
            <Heart className={`w-4 h-4 ${onlySaved ? "fill-white text-white" : "text-rose-500"}`} />
            <span>{t("CoursesDirectory.saved_wishlist", "Guardados")}</span>
            {savedCourseIds.length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
                onlySaved ? "bg-white/25 text-white" : "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
              }`}>
                {savedCourseIds.length}
              </span>
            )}
          </button>

          {/* Píldoras de Categorías */}
          {sanitizedCategories.map((cat) => {
            const isSelected = selectedCategories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setOnlySaved(false);
                  toggleCategory(cat);
                }}
                className={`px-5 py-2.5 rounded-full text-sm sm:text-base font-extrabold transition-all whitespace-nowrap cursor-pointer shrink-0 shadow-2xs ${
                  isSelected
                    ? "bg-cfh-dark-green text-white dark:bg-cfh-light-green dark:text-cfh-dark-green shadow-xs"
                    : "bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-800 hover:border-cfh-light-green"
                }`}
              >
                <AutoTranslate text={cat} fallback={translateCategory(cat)} />
              </button>
            );
          })}
        </div>

        {/* Flecha Derecha con Desvanecido Suave */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center pl-8 bg-gradient-to-l from-slate-50 via-slate-50/95 to-transparent dark:from-[#080d1a] dark:via-[#080d1a]/95 pointer-events-none">
            <button
              type="button"
              onClick={() => handleScrollCategories("right")}
              className="pointer-events-auto w-8 h-8 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-md flex items-center justify-center text-gray-700 dark:text-slate-200 hover:text-cfh-dark-green dark:hover:text-cfh-light-green hover:scale-110 active:scale-95 transition-all cursor-pointer"
              title={t("Common.next", "Ver más")}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </motion.div>

      {/* Contenedor Principal: Sidebar + Contenido */}
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* ========================================================================= */}
        {/* 🧭 SIDEBAR DE FILTROS (Formato de Categoría preservado + UI Calificación) */}
        {/* ========================================================================= */}
        <motion.aside
          variants={itemVariants}
          className={`w-full md:w-72 flex-shrink-0 flex flex-col gap-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm ${
            isMobileFiltersOpen ? "block" : "hidden md:flex"
          }`}
        >
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
              <h2 className="font-extrabold text-lg text-cfh-dark-green dark:text-slate-100">{t("CoursesDirectory.search_filters", "Filtros de Búsqueda")}</h2>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t("CoursesDirectory.clear", "Limpiar")}</span>
              </button>
            )}
          </div>

          {/* 1. SELECCIÓN DE CATEGORÍA (Formato de lista con checkboxes PRESERVADO + Búsqueda integrada) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-slate-100 uppercase tracking-wider">
                {t("CoursesDirectory.categories") || "Categorías"}
              </h3>
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => setSelectedCategories([])}
                  className="text-[11px] font-bold text-cfh-dark-green dark:text-cfh-light-green hover:underline cursor-pointer"
                >
                  {t("CoursesDirectory.reset", "Restablecer")}
                </button>
              )}
            </div>

            {/* 🔍 Barra de búsqueda integrada de categorías */}
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder={t("CoursesDirectory.search_categories", "Buscar categoría...")}
                className="w-full bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 pl-8 pr-7 py-1.5 rounded-xl text-xs font-medium text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-cfh-light-green focus:ring-1 focus:ring-cfh-light-green/30 transition-all"
              />
              {categorySearch && (
                <button
                  type="button"
                  onClick={() => setCategorySearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-0.5 rounded-full"
                  title="Borrar búsqueda"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Lista con scroll invisible (no-scrollbar), altura contenida (max-h-60) y lazy render optimizado */}
            <ul className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-0.5 no-scrollbar">
              {visibleSidebarCategories.length === 0 ? (
                <li className="py-4 text-center text-xs text-gray-400 dark:text-slate-500 font-medium">
                  {t("CoursesDirectory.no_categories_found", "No se encontraron categorías")}
                </li>
              ) : (
                visibleSidebarCategories.map((cat, i) => {
                  const isChecked = selectedCategories.includes(cat);
                  const count = categoryCounts[cat] || 0;
                  return (
                    <li key={cat || i}>
                      <label
                        onClick={() => toggleCategory(cat)}
                        className={`flex items-center justify-between gap-3 p-2.5 rounded-xl cursor-pointer transition-all select-none ${
                          isChecked
                            ? "bg-emerald-50/80 dark:bg-emerald-950/60 text-cfh-dark-green dark:text-cfh-light-green font-bold shadow-xs border border-emerald-200/60 dark:border-emerald-800"
                            : "text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                              isChecked
                                ? "bg-cfh-dark-green border-cfh-dark-green text-white"
                                : "border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="text-xs sm:text-sm truncate">
                            <AutoTranslate text={cat} fallback={translateCategory(cat)} />
                          </span>
                        </div>

                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                            isChecked
                              ? "bg-cfh-dark-green text-white"
                              : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"
                          }`}
                        >
                          {count}
                        </span>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800 my-1" />

          {/* 2. SELECCIÓN DE CALIFICACIÓN (UI Mejorada con estrellas visuales y estados interactivos) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-slate-100 uppercase tracking-wider">
                {t("CoursesDirectory.rating") || "Calificación"}
              </h3>
              {selectedRating !== null && (
                <button
                  onClick={() => setSelectedRating(null)}
                  className="text-[11px] font-bold text-cfh-dark-green dark:text-cfh-light-green hover:underline cursor-pointer"
                >
                  {t("CoursesDirectory.view_all", "Ver todas")}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {[4.5, 4.0, 3.5, 3.0].map((ratingVal) => {
                const isSelected = selectedRating === ratingVal;
                const count = ratingCounts[ratingVal as keyof typeof ratingCounts] || 0;

                return (
                  <button
                    key={ratingVal}
                    type="button"
                    onClick={() => toggleRating(ratingVal)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between group cursor-pointer ${
                      isSelected
                        ? "bg-amber-50/90 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 shadow-sm text-amber-950 dark:text-amber-300 font-bold"
                        : "bg-white dark:bg-slate-900 border-gray-200/80 dark:border-slate-800 hover:border-amber-200 dark:hover:border-amber-700 hover:bg-gray-50/80 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Badge con la nota */}
                      <span
                        className={`px-2 py-0.5 rounded-lg text-xs font-black flex items-center gap-0.5 ${
                          isSelected
                            ? "bg-amber-500 text-white shadow-xs"
                            : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 group-hover:bg-amber-100 dark:group-hover:bg-amber-950 group-hover:text-amber-800 dark:group-hover:text-amber-300"
                        }`}
                      >
                        {ratingVal.toFixed(1)}
                        <Star className="w-3 h-3 fill-current" />
                      </span>

                      {/* Estrellas Doradas */}
                      <div className="flex text-amber-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= Math.floor(ratingVal)
                                ? "fill-amber-400 text-amber-400"
                                : "fill-gray-200 dark:fill-slate-700 text-gray-200 dark:text-slate-700"
                            }`}
                          />
                        ))}
                      </div>

                      <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                        {t("CoursesDirectory.and_up") || "y más"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 dark:text-slate-400 font-semibold">
                        ({count})
                      </span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-amber-500 border-amber-500 text-white"
                            : "border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botón rápido para limpiar filtros */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="mt-2 w-full py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 text-xs font-bold hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t("CoursesDirectory.reset_filters", "Restablecer Filtros")}</span>
            </button>
          )}
        </motion.aside>

        {/* ========================================================================= */}
        {/* 📚 CONTENIDO: Header con selector "Más Populares" + Grid de Cursos        */}
        {/* ========================================================================= */}
        <div className="flex-1 w-full flex flex-col gap-6">
          {/* Header de Resultados y Selector "Más Populares" Mejorado */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm"
          >
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-cfh-text dark:text-slate-100 tracking-tight flex items-center gap-2">
                <span>{filteredCourses.length}</span>
                <span className="text-gray-500 dark:text-slate-400 font-medium text-lg sm:text-xl">
                  {t("CoursesDirectory.results") || "cursos disponibles"}
                </span>
              </h1>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                {t("CoursesDirectory.explore_desc", "Explora programas diseñados para transformar tu carrera profesional")}
              </p>
            </div>

            {/* 🌟 SELECTOR DE ORDENAMIENTO (UI MEJORADA: Reemplazo del select nativo) */}
            <div className="relative w-full sm:w-auto" ref={sortRef}>
              <button
                type="button"
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="w-full sm:w-64 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-cfh-light-green text-gray-800 dark:text-slate-100 px-5 py-3 rounded-2xl shadow-xs flex items-center justify-between gap-3 text-sm sm:text-base font-extrabold transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <currentSortOption.icon className={`w-4 h-4 shrink-0 ${currentSortOption.iconColor}`} />
                  <span className="text-gray-400 dark:text-slate-400 font-medium">{t("CoursesDirectory.sort_label", "Ordenar:")}</span>
                  <span className="text-cfh-dark-green dark:text-cfh-light-green font-extrabold truncate">
                    {currentSortOption.label}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 dark:text-slate-400 transition-transform duration-200 shrink-0 ${
                    isSortOpen ? "rotate-180 text-cfh-dark-green dark:text-cfh-light-green" : ""
                  }`}
                />
              </button>

              {/* Menú Desplegable con Animación Framer Motion */}
              <AnimatePresence>
                {isSortOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 mt-2 w-full sm:w-64 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-2xl z-40 p-1.5 overflow-hidden"
                  >
                    <div className="text-[10px] font-extrabold uppercase text-gray-400 dark:text-slate-500 px-3 py-1.5 tracking-wider">
                      {t("CoursesDirectory.sort_criteria", "Criterio de orden")}
                    </div>
                    {sortOptions.map((opt) => {
                      const isSelected = sortBy === opt.id;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSortBy(opt.id);
                            setIsSortOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between text-xs sm:text-sm transition-all cursor-pointer ${
                            isSelected
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-cfh-dark-green dark:text-cfh-light-green font-extrabold shadow-xs"
                              : "text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 font-medium"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? "bg-cfh-dark-green/10 dark:bg-cfh-light-green/20"
                                : "bg-gray-100 dark:bg-slate-800"
                            }`}>
                              <Icon className={`w-3.5 h-3.5 ${opt.iconColor}`} />
                            </span>
                            <span className="truncate">{opt.label}</span>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-cfh-light-green shrink-0 stroke-[2.5]" />
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Pastillas de Filtros Activos */}
          {hasActiveFilters && (
            <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-gray-400 dark:text-slate-400 mr-1">{t("CoursesDirectory.active_filters", "Filtros activos:")}</span>

              {searchQuery && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold">
                  <span>{t("CoursesDirectory.search_label", "Búsqueda:")} &ldquo;{searchQuery}&rdquo;</span>
                  <button onClick={() => setSearchQuery("")} className="hover:text-red-500 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}

              {selectedCategories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-cfh-dark-green dark:text-cfh-light-green border border-emerald-200/80 dark:border-emerald-800 text-xs font-bold"
                >
                  <Tag className="w-3 h-3 text-cfh-light-green" />
                  <span><AutoTranslate text={cat} fallback={translateCategory(cat)} /></span>
                  <button onClick={() => toggleCategory(cat)} className="hover:text-red-500 ml-0.5 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}

              {selectedRating !== null && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span>≥ {selectedRating.toFixed(1)} {t("CoursesDirectory.stars", "estrellas")}</span>
                  <button onClick={() => setSelectedRating(null)} className="hover:text-red-500 ml-0.5 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}

              <button
                onClick={clearAllFilters}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 font-bold ml-2 underline cursor-pointer"
              >
                {t("CoursesDirectory.clear_all", "Limpiar todo")}
              </button>
            </motion.div>
          )}

          {/* Grid de Cursos o Estado Vacío */}
          {filteredCourses.length === 0 ? (
            <motion.div
              key="empty-state"
              variants={itemVariants}
              className="text-center py-20 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-cfh-dark-green dark:text-cfh-light-green flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-cfh-light-green" />
              </div>
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-slate-100 mb-2">
                {t("CoursesDirectory.empty_title_filter", "No encontramos cursos con estos filtros")}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md mx-auto mb-6">
                {t("CoursesDirectory.empty_desc_filter", "Intenta seleccionar otra categoría, reducir el filtro de calificación o limpiar tu búsqueda.")}
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-6 py-3 bg-cfh-dark-green hover:bg-[#061528] text-white text-sm font-extrabold rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t("CoursesDirectory.reset_filters", "Restablecer Filtros")}</span>
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="course-grid"
              variants={containerVariants}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filteredCourses.map((course) => (
                <motion.div
                  key={course.id}
                  variants={itemVariants}
                  className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col h-full hover:-translate-y-1"
                >
                  {/* Imagen del Curso con Link */}
                  <Link
                    href={`/cursos/${course.id}`}
                    className="block relative pt-[56.25%] overflow-hidden bg-gray-100 dark:bg-slate-800 cursor-pointer"
                  >
                    <img
                      src={course.img}
                      alt={translateCourseTitle(course)}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-12 h-12 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-full flex items-center justify-center text-cfh-dark-green dark:text-cfh-light-green shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          stroke="none"
                        >
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                      </div>
                    </div>

                    {/* Badge Categoría o Inscrito sobre imagen */}
                    {course.isEnrolled ? (
                      <span className="absolute top-3 left-3 bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md z-10 flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Inscrito</span>
                      </span>
                    ) : course.category ? (
                      <span className="absolute top-3 left-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-cfh-dark-green dark:text-cfh-light-green text-[11px] font-extrabold px-3 py-1 rounded-full shadow-xs">
                        <AutoTranslate text={course.category} fallback={translateCategory(course.category)} />
                      </span>
                    ) : null}

                    {/* Botón Guardar / Wishlist estilo Udemy con actualización optimista */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleSaveCourse(course.id);
                      }}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-md flex items-center justify-center text-gray-400 hover:text-rose-500 transition-all hover:scale-110 active:scale-90 z-10 cursor-pointer"
                      title={savedCourseIds.includes(course.id) ? "Quitar de guardados" : "Guardar para ver después"}
                    >
                      <Heart
                        className={`w-4 h-4 transition-colors ${
                          savedCourseIds.includes(course.id)
                            ? "fill-rose-500 text-rose-500"
                            : "text-gray-400 hover:text-rose-500"
                        }`}
                      />
                    </button>
                  </Link>

                  {/* Info del Curso */}
                  <div className="p-5 flex flex-col flex-1">
                    <Link href={`/cursos/${course.id}`} className="block mb-1.5">
                      <h3 className="font-extrabold text-cfh-text dark:text-slate-100 text-base leading-snug hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors line-clamp-2">
                        <AutoTranslate text={course.title} fallback={translateCourseTitle(course)} />
                      </h3>
                    </Link>
                    <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-3">
                      {t("CoursesDirectory.by", "Por")}{" "}
                      <strong className="text-gray-700 dark:text-slate-300">{translateCoachName(course.author, t)}</strong>
                    </p>

                    {/* Calificación, Reseñas y Badge Bestseller */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                          {course.rating.toFixed(1)}
                        </span>
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3.5 h-3.5 ${
                                star <= Math.floor(course.rating)
                                  ? "fill-amber-400 text-amber-400"
                                  : "fill-gray-200 dark:fill-slate-700 text-gray-200 dark:text-slate-700"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">
                          ({course.reviews.toLocaleString()})
                        </span>
                      </div>

                      {/* Badge Bestseller alineado con la prueba social */}
                      {course.bestseller && (
                        <span className="inline-block bg-amber-100/90 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0 border border-amber-200/60 dark:border-amber-800/60 shadow-2xs">
                          {t("CoursesDirectory.bestseller") || "Bestseller"}
                        </span>
                      )}
                    </div>

                    {/* Precios y Carrito */}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100/80 dark:border-slate-800 gap-2">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-2xl font-black text-cfh-dark-green dark:text-cfh-light-green tracking-tight">
                          ${course.price}
                        </span>
                        {course.originalPrice > course.price && (
                          <>
                            <span className="text-xs text-gray-400 dark:text-slate-500 line-through font-medium">
                              ${course.originalPrice.toFixed(0)}
                            </span>
                            <span className="text-[10px] font-black bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded font-mono">
                              -{Math.round(((course.originalPrice - course.price) / course.originalPrice) * 100)}%
                            </span>
                          </>
                        )}
                      </div>

                      {/* Botón Carrito o Ir al Aula */}
                      {course.isEnrolled ? (
                        <Link
                          href={`/classroom/${course.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Ir al Aula</span>
                        </Link>
                      ) : (
                        <AddToCartButton
                          courseId={course.id}
                          courseTitle={translateCourseTitle(course)}
                          price={course.price}
                          author={course.author}
                          thumbnailUrl={course.img}
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

