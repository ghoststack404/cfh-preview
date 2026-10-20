"use client";

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/components/TranslationProvider';
import TermsContent from '@/components/TermsContent';
import { useParams } from 'next/navigation';

const termsMeta: Record<string, { title: string; last_updated: string }> = {
  es: { title: 'Términos y Condiciones', last_updated: 'Última actualización' },
  en: { title: 'Terms and Conditions', last_updated: 'Last updated' },
  pt: { title: 'Termos e Condições', last_updated: 'Última atualização' },
  zh: { title: '条款与条件', last_updated: '最后更新' },
  de: { title: 'Allgemeine Geschäftsbedingungen', last_updated: 'Zuletzt aktualisiert' },
  fr: { title: 'Conditions Générales', last_updated: 'Dernière mise à jour' },
  it: { title: 'Termini e Condizioni', last_updated: 'Ultimo aggiornamento' },
  ja: { title: '利用規約', last_updated: '最終更新日' },
  ko: { title: '이용약관', last_updated: '최종 업데이트' },
  ru: { title: 'Условия и положения', last_updated: 'Последнее обновление' },
  ar: { title: 'الشروط والأحكام', last_updated: 'آخر تحديث' },
  hi: { title: 'नियम एवं शर्तें', last_updated: 'अंतिम अद्यतन' },
};

export default function TermsPage() {
  const { t, locale: contextLocale } = useTranslation();
  const params = useParams();

  const activeLocale = useMemo(() => {
    const raw = ((params?.locale as string) || contextLocale || 'es').toLowerCase();
    return termsMeta[raw] ? raw : 'es';
  }, [params, contextLocale]);

  const meta = termsMeta[activeLocale] ?? termsMeta['es'] ?? { title: 'Términos y Condiciones', last_updated: 'Última actualización' };
  const title = t('Terms.title', meta.title);
  const lastUpdated = t('Terms.last_updated', meta.last_updated);
  const isRTL = activeLocale === 'ar';

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="bg-gray-50 dark:bg-slate-950 min-h-screen py-16 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial="hidden"
        animate="show"
        variants={containerVariants}
        className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-transparent dark:border-slate-800 overflow-hidden"
      >
        <div className={`bg-[#081B33] dark:bg-slate-950 px-8 py-10 text-white relative overflow-hidden ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-cfh-light-green/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          <h1 className="text-3xl font-extrabold tracking-tight relative z-10">{title}</h1>
          <p className="mt-2 text-[#A7D4B6] relative z-10">{lastUpdated}</p>
        </div>
        
        <div className="p-8 sm:p-12 text-gray-700 dark:text-slate-300 space-y-8 leading-relaxed">
          <TermsContent locale={activeLocale} />
        </div>
      </motion.div>
    </div>
  );
}
