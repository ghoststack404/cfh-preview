"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { ChevronDown, Search, Check, FolderOpen, X } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface CategorySelectDropdownProps {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function CategorySelectDropdown({
  categories,
  value,
  onChange,
  placeholder = "Selecciona una categoría",
  disabled = false,
}: CategorySelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState<{
    direction: "up" | "down";
    maxHeight: number;
  }>({ direction: "down", maxHeight: 260 });
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Buscar categoría seleccionada actualmente
  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === value);
  }, [categories, value]);

  // Filtrado reactivo de categorías por término de búsqueda
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, searchQuery]);

  // Calcular de forma precisa y reactiva si debe abrir hacia arriba o hacia abajo
  const updatePlacement = useCallback(() => {
    if (!dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const bottomBarHeight = 75; // Margen para el ticker/banner inferior fijo de 48px + holgura
    const topMargin = 75; // Margen para el header superior fijo
    const spaceBelow = window.innerHeight - rect.bottom - bottomBarHeight;
    const spaceAbove = rect.top - topMargin;

    // Si el espacio debajo es menor a 310px o si arriba hay claramente más espacio: abrir hacia arriba
    const shouldOpenUp = spaceBelow < 310 || (spaceAbove > 260 && spaceAbove > spaceBelow);
    const availableHeight = shouldOpenUp ? spaceAbove : spaceBelow;
    // La altura total de la tarjeta flotante no puede exceder el espacio disponible
    const calculatedCardHeight = Math.max(160, Math.min(270, availableHeight - 10));

    setMenuPlacement({
      direction: shouldOpenUp ? "up" : "down",
      maxHeight: calculatedCardHeight,
    });
  }, []);

  // Calcular sincronizado al abrir
  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePlacement();
    }
    setIsOpen((prev) => !prev);
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePlacement();
      window.addEventListener("resize", updatePlacement);
      window.addEventListener("scroll", updatePlacement, true);
      return () => {
        window.removeEventListener("resize", updatePlacement);
        window.removeEventListener("scroll", updatePlacement, true);
      };
    }
  }, [isOpen, updatePlacement]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Enfocar el input de búsqueda al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Botón Disparador Principal */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full px-4 py-2.5 rounded-xl border flex items-center justify-between text-left transition-all duration-200 outline-none cursor-pointer ${
          isOpen
            ? "border-cfh-dark-green ring-2 ring-cfh-dark-green/20 bg-white dark:bg-slate-800 shadow-sm"
            : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600"
        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <div className="w-7 h-7 rounded-lg bg-cfh-light-green/15 dark:bg-cfh-light-green/10 flex items-center justify-center shrink-0 text-cfh-dark-green dark:text-cfh-light-green">
            <FolderOpen className="w-3.5 h-3.5" />
          </div>
          {selectedCategory ? (
            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
              {selectedCategory.name}
            </span>
          ) : (
            <span className="text-sm font-medium text-gray-400 dark:text-slate-500 truncate">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-gray-400 dark:text-slate-500">
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen
                ? menuPlacement.direction === "up"
                  ? ""
                  : "rotate-180 text-cfh-dark-green dark:text-cfh-light-green"
                : menuPlacement.direction === "up"
                ? "rotate-180"
                : ""
            }`}
          />
        </div>
      </button>

      {/* Menú Desplegable Flotante (Con apertura estricta y altura contenida) */}
      {isOpen && (
        <div
          style={{ maxHeight: `${menuPlacement.maxHeight}px` }}
          className={`absolute z-[90] left-0 right-0 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xl p-2.5 animate-in fade-in zoom-in-95 duration-150 flex flex-col ${
            menuPlacement.direction === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {/* Barra de Búsqueda rápida */}
          <div className="relative mb-2 shrink-0">
            <Search className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar categoría..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-gray-50 dark:bg-slate-800/80 border border-gray-200/80 dark:border-slate-700/80 text-xs font-medium text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 outline-none focus:border-cfh-dark-green focus:ring-1 focus:ring-cfh-dark-green/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-full cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Lista de Opciones con scrollbar prémium sin flechas de Windows */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1.5 cfh-dropdown-scroll min-h-0">
            {/* Opción para limpiar selección */}
            <button
              type="button"
              onClick={() => handleSelect("")}
              className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                !value
                  ? "bg-cfh-light-green/15 text-cfh-dark-green dark:text-cfh-light-green font-bold"
                  : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <span>{placeholder}</span>
              {!value && <Check className="w-3.5 h-3.5 text-cfh-dark-green dark:text-cfh-light-green" />}
            </button>

            {filteredCategories.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400 dark:text-slate-500">
                No se encontraron categorías con &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              filteredCategories.map((c) => {
                const isSelected = c.id === value;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c.id)}
                    className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-cfh-dark-green text-white font-bold shadow-xs"
                        : "text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="truncate pr-2">{c.name}</span>
                    {isSelected && <Check className="w-4 h-4 shrink-0 text-white" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
