"use client"; // Error components must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const tNav = useTranslations("Navigation");
  const tErr = useTranslations("Errors");

  useEffect(() => {
    // Aquí podríamos conectar a Sentry, Datadog, o loguear el error a nuestra DB
    console.error("Error global capturado por Next.js:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="relative w-32 h-32 sm:w-48 sm:h-48 mb-8 text-rose-500/20 dark:text-rose-400/20">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-full h-full"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 dark:text-slate-100 mb-4">
        {tErr("error_500_title")}
      </h1>
      <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-lg">
        {tErr("error_500_desc")}
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-3 rounded-xl font-bold bg-cfh-dark-green hover:bg-cfh-light-green text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
        >
          {tErr("try_again")}
        </button>
        <Link
          href="/"
          className="px-6 py-3 rounded-xl font-bold border-2 border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          {tNav("home")}
        </Link>
      </div>
    </div>
  );
}
