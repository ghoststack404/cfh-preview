"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";
  const error = searchParams.get("error");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
        {success ? (
          <>
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">¡Correo verificado!</h1>
            <p className="text-gray-500 mb-8">Tu dirección de correo electrónico ha sido verificada exitosamente. Ya puedes utilizar todas las funciones de Coaching From Home.</p>
            <Link href="/dashboard" className="block w-full py-3 px-4 bg-cfh-dark-green text-white font-bold rounded-xl hover:bg-[#111] transition-colors">
              Ir al Dashboard
            </Link>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Error de verificación</h1>
            <p className="text-gray-500 mb-8">
              {error === "InvalidToken" ? "El enlace de verificación no es válido o ha expirado." :
               error === "MissingToken" ? "No se proporcionó un token de verificación." :
               error === "UserNotFound" ? "El usuario asociado a este enlace no existe." :
               "Ocurrió un error al intentar verificar tu correo."}
            </p>
            <Link href="/" className="block w-full py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
              Volver al inicio
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50">Cargando...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
