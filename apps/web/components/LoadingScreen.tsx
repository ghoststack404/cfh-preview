"use client";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/components/TranslationProvider";

export default function Loading() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-transparent transition-colors">
      <Loader2 className="w-12 h-12 text-cfh-dark-green animate-spin mb-4 dark:text-cfh-light-green" />
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t("Loading.title", "Cargando...")}</h2>
      <p className="text-gray-500 dark:text-gray-400 mt-2">{t("Loading.subtitle", "Preparando la información de este módulo...")}</p>
    </div>
  );
}
