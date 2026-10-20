"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from './TranslationProvider';
import { locales } from '@/i18n';

const languages = [
  { code: 'ES', name: 'Español', region: 'América Latina / España' },
  { code: 'EN', name: 'English', region: 'Global / US' },
  { code: 'PT', name: 'Português', region: 'Brasil / Portugal' },
  { code: 'FR', name: 'Français', region: 'France / Canada' },
  { code: 'DE', name: 'Deutsch', region: 'Deutschland' },
  { code: 'IT', name: 'Italiano', region: 'Italia' },
  { code: 'ZH', name: '中文 (Mandarín)', region: 'China / Global' },
  { code: 'JA', name: '日本語', region: 'Japan' },
  { code: 'KO', name: '한국어', region: 'South Korea' },
  { code: 'RU', name: 'Русский', region: 'Russia / CIS' },
  { code: 'AR', name: 'العربية', region: 'Middle East' },
  { code: 'HI', name: 'हिन्दी', region: 'India' },
];

const LATAM_COUNTRIES = ['MX', 'CO', 'AR', 'PE', 'VE', 'CL', 'GT', 'EC', 'BO', 'HT', 'CU', 'DO', 'HN', 'PY', 'NI', 'SV', 'CR', 'PA', 'UY', 'ES'];
const BRASIL_COUNTRIES = ['BR', 'PT'];
const FR_COUNTRIES = ['FR', 'CA', 'BE', 'CH'];
const DE_COUNTRIES = ['DE', 'AT', 'CH'];
const IT_COUNTRIES = ['IT', 'CH'];

export default function RegionSelector() {
  const [show, setShow] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const { t, locale } = useTranslation();

  useEffect(() => {
    const initRegion = async () => {
      // 1. Respetar selección previa del usuario si ya existe en localStorage
      const savedLang = typeof window !== 'undefined' ? localStorage.getItem('cfh_language') : null;

      if (savedLang) {
        return; // El usuario ya seleccionó o descartó previamente su idioma
      }

      // 2. Si no hay idioma guardado, detectar por IP
      let langCode = 'ES';
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (data && data.country_code) {
          const cc = data.country_code.toUpperCase();
          if (LATAM_COUNTRIES.includes(cc)) langCode = 'ES';
          else if (BRASIL_COUNTRIES.includes(cc)) langCode = 'PT';
          else if (FR_COUNTRIES.includes(cc)) langCode = 'FR';
          else if (DE_COUNTRIES.includes(cc)) langCode = 'DE';
          else if (IT_COUNTRIES.includes(cc)) langCode = 'IT';
          else langCode = 'EN';
        }
      } catch {
        if (typeof navigator !== 'undefined' && navigator.language) {
          const nav = navigator.language.slice(0, 2).toUpperCase();
          if (languages.some(l => l.code === nav)) {
            langCode = nav;
          }
        }
      }
      setDetectedLang(langCode);

      const timer = setTimeout(() => {
        setShow(true);
      }, 500);
      return () => clearTimeout(timer);
    };
    initRegion();
  }, []);

  const handleSelect = (code: string) => {
    const lowerCode = code.toLowerCase();

    // Guardar preferencia persistente
    if (typeof window !== 'undefined') {
      localStorage.setItem('cfh_language', lowerCode);
      document.cookie = `cfh_language=${lowerCode}; path=/; max-age=31536000; SameSite=Lax`;
      document.cookie = `NEXT_LOCALE=${lowerCode}; path=/; max-age=31536000; SameSite=Lax`;
      window.dispatchEvent(new Event('languageChange'));
    }

    setShow(false);

    // Si ya estamos en la ruta de ese locale, no recargar
    if (locale && locale.toLowerCase() === lowerCode) {
      return;
    }

    // Redirigir de inmediato a la ruta con el nuevo locale para traducir toda la página
    const currentPath = window.location.pathname;
    const currentSearch = window.location.search || '';
    const currentHash = window.location.hash || '';

    let stripped = currentPath;
    for (const loc of locales) {
      if (stripped === `/${loc}` || stripped === `/${loc}/`) {
        stripped = '/';
        break;
      } else if (stripped.startsWith(`/${loc}/`)) {
        stripped = stripped.substring(loc.length + 1);
        break;
      }
    }

    if (!stripped.startsWith('/')) stripped = '/' + stripped;
    const targetPath = stripped === '/' ? `/${lowerCode}` : `/${lowerCode}${stripped}`;
    window.location.href = `${targetPath}${currentSearch}${currentHash}`;
  };

  const handleDismiss = () => {
    const fallback = (detectedLang || locale || 'es').toLowerCase();
    if (typeof window !== 'undefined') {
      localStorage.setItem('cfh_language', fallback);
      document.cookie = `cfh_language=${fallback}; path=/; max-age=31536000; SameSite=Lax`;
      document.cookie = `NEXT_LOCALE=${fallback}; path=/; max-age=31536000; SameSite=Lax`;
    }
    setShow(false);
  };

  const filteredLanguages = languages.filter(lang => 
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    lang.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Ordenamos para que el detectado aparezca primero
  const sortedLanguages = [...filteredLanguages].sort((a, b) => {
    if (a.code === detectedLang) return -1;
    if (b.code === detectedLang) return 1;
    return 0;
  });

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-cfh-dark-green/90 flex items-center justify-center p-4 backdrop-blur-sm"
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative overflow-hidden"
        >
          {/* Botón de cerrar */}
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-cfh-dark-green rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-extrabold text-2xl tracking-tighter">CFH</span>
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold text-cfh-dark-green mb-1">{t('RegionSelector.title')}</h2>
            <p className="text-gray-500 font-medium text-sm">{t('RegionSelector.subtitle')}</p>
          </div>

          {/* Search Input */}
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <input
              type="text"
              placeholder={t('RegionSelector.search_placeholder')}
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-cfh-light-green focus:border-cfh-light-green block pl-10 p-3 outline-none transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Language List */}
          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
            {sortedLanguages.length > 0 ? (
              sortedLanguages.map((lang, index) => (
                <motion.button
                  key={lang.code}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSelect(lang.code)}
                  className={`w-full text-left p-4 rounded-xl border transition-all group flex items-center justify-between shadow-sm ${lang.code === detectedLang ? 'bg-cfh-dark-green/5 border-cfh-light-green/50' : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-cfh-light-green/30'}`}
                >
                  <div>
                    <div className="font-bold text-gray-900 group-hover:text-cfh-dark-green transition-colors">{lang.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{lang.region}</div>
                  </div>
                  {/* Etiqueta de Auto-Detección por IP */}
                  {lang.code === detectedLang && !searchQuery && (
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold bg-cfh-dark-green/10 text-cfh-dark-green px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
                        {t('RegionSelector.ip_detected')}
                      </span>
                    </div>
                  )}
                </motion.button>
              ))
            ) : (
              <div className="text-center py-4 text-gray-400 text-sm">
                {t('RegionSelector.no_results')} "{searchQuery}"
              </div>
            )}
          </div>

          <div className="mt-8 text-center text-xs text-gray-400 font-medium">
            CoachingFromHome · EdTech Platform
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
