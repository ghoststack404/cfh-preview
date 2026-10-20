"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export default function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Placeholder invisible/estático durante SSR para evitar hydration mismatch
    return (
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full sm:rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 opacity-50" />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full sm:rounded-xl bg-white hover:bg-gray-50 sm:bg-gray-50/90 sm:hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-gray-200/90 dark:border-slate-700 shadow-sm text-gray-700 dark:text-amber-400 transition-colors cursor-pointer overflow-hidden"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isDark ? "dark-icon" : "light-icon"}
          initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center"
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-amber-400 stroke-[2.2]" />
          ) : (
            <Moon className="w-5 h-5 text-slate-600 hover:text-cfh-dark-green stroke-[2.2]" />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}
