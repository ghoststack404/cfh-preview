"use client";

import { useTranslation } from "./TranslationProvider";

export default function AnimatedTopBar() {
  const { t, locale } = useTranslation();
  
  const text = locale === 'en' 
    ? "¿Do you know how to do something that others want to learn? Sign up for free and start offering your knowledge to the world ✨"
    : "¿Sabes hacer algo que otras personas quieran aprender? Regístrate Gratis y empieza a ofrecer tus conocimientos al mundo ✨";

  const repeatedText = Array.from({ length: 4 }, (_, i) => (
    <span key={i} className="mx-6 shrink-0">{text}</span>
  ));

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-cfh-dark-green text-[#081d33] font-black h-12 w-full flex border-t-2 border-[#1e3a5f]/30 shadow-lg">
      
      {/* ===== MITAD IZQUIERDA ===== */}
      <div className="w-[calc(50%-20px)] h-full relative">
        {/* Contenedor con clip duro */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="flex items-center h-full">
            <div className="flex whitespace-nowrap text-sm sm:text-base font-black tracking-wide text-[#081d33] animate-marquee-slow">
              {repeatedText}
              {repeatedText}
            </div>
          </div>
        </div>
        {/* Fade en el borde derecho (interno) */}
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-cfh-dark-green to-transparent z-10 pointer-events-none" />
      </div>

      {/* ===== SEPARADOR CENTRAL (40px gap) ===== */}
      <div className="w-[40px] h-full flex items-center justify-center z-20 shrink-0">
        <div className="bg-[#081d33] text-white rounded-full p-2 shadow-lg border border-[#081d33]/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        </div>
      </div>

      {/* ===== MITAD DERECHA ===== */}
      <div className="w-[calc(50%-20px)] h-full relative">
        {/* Fade en el borde izquierdo (interno) */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-cfh-dark-green to-transparent z-10 pointer-events-none" />
        {/* Contenedor con clip duro */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="flex items-center h-full">
            <div className="flex whitespace-nowrap text-sm sm:text-base font-black tracking-wide text-[#081d33] animate-marquee-slow-reverse">
              {repeatedText}
              {repeatedText}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
