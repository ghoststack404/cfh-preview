import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <Loader2 className="w-12 h-12 text-cfh-dark-green animate-spin mb-4 dark:text-cfh-light-green" />
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Cargando...</h2>
      <p className="text-gray-500 dark:text-gray-400 mt-2">Preparando la información de este módulo</p>
    </div>
  );
}
