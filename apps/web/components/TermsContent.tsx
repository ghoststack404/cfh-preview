"use client";

import React, { useMemo } from 'react';
import { useTranslation } from '@/components/TranslationProvider';
import termsTranslationsRaw from '@/lib/terms-translations.json';

const termsTranslations = termsTranslationsRaw as Record<string, any>;

interface TermsContentProps {
  locale?: string;
}

export default function TermsContent({ locale: propLocale }: TermsContentProps) {
  const { locale: contextLocale } = useTranslation();

  // El idioma de visualización de los términos: propLocale > contextLocale > 'es'
  const activeLocale = useMemo(() => {
    const raw = (propLocale || contextLocale || 'es').toLowerCase();
    if (termsTranslations[raw]) return raw;
    return 'es';
  }, [propLocale, contextLocale]);

  const terms = termsTranslations[activeLocale] || termsTranslations['en'] || termsTranslations['es'];
  const isRTL = activeLocale === 'ar';

  if (!terms) {
    return null;
  }

  return (
    <div className={`w-full ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Documento legal completamente traducido */}
      <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-slate-300 space-y-6">
        <h1 className="text-3xl font-extrabold mb-6 text-gray-900 dark:text-white tracking-tight">
          {terms.title}
        </h1>

        {terms.intro_p1 && <p className="leading-relaxed">{terms.intro_p1}</p>}
        {terms.intro_p2 && <p className="leading-relaxed font-semibold text-gray-800 dark:text-slate-100">{terms.intro_p2}</p>}
        {terms.intro_p3 && <p className="leading-relaxed text-sm text-gray-500 dark:text-slate-400">{terms.intro_p3}</p>}

        {/* Descripción de la Plataforma */}
        {terms.desc_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.desc_title}</h2>}
        {terms.desc_p1 && <p className="leading-relaxed">{terms.desc_p1}</p>}
        {terms.desc_p2 && <p className="leading-relaxed">{terms.desc_p2}</p>}
        {terms.desc_p3 && <p className="leading-relaxed">{terms.desc_p3}</p>}
        {terms.desc_p4 && <p className="leading-relaxed">{terms.desc_p4}</p>}
        {terms.desc_p5 && <p className="leading-relaxed">{terms.desc_p5}</p>}

        {terms.desc_modalities_title && (
          <p className="mt-4 mb-2 font-bold text-gray-900 dark:text-white">{terms.desc_modalities_title}</p>
        )}
        {terms.desc_modalities_items && (
          <ul className={`list-disc space-y-2 mb-4 ${isRTL ? 'pr-6' : 'pl-6'}`}>
            {terms.desc_modalities_items.map((item: string, idx: number) => (
              <li key={idx} className="leading-relaxed">{item}</li>
            ))}
          </ul>
        )}
        {terms.desc_p6 && <p className="leading-relaxed">{terms.desc_p6}</p>}
        {terms.desc_p7 && <p className="leading-relaxed">{terms.desc_p7}</p>}

        {/* Naturaleza de la Plataforma */}
        {terms.nature_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.nature_title}</h2>}
        {terms.nature_p1 && <p className="leading-relaxed">{terms.nature_p1}</p>}
        {terms.nature_p2 && <p className="leading-relaxed">{terms.nature_p2}</p>}
        {terms.nature_p3 && <p className="leading-relaxed">{terms.nature_p3}</p>}

        {/* Responsabilidad de los Usuarios */}
        {terms.user_resp_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.user_resp_title}</h2>}
        {terms.user_resp_p1 && <p className="leading-relaxed">{terms.user_resp_p1}</p>}
        {terms.user_resp_p2 && <p className="leading-relaxed">{terms.user_resp_p2}</p>}
        {terms.user_resp_p3 && <p className="leading-relaxed">{terms.user_resp_p3}</p>}

        {/* Propiedad Intelectual */}
        {terms.ip_conf_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.ip_conf_title}</h2>}
        {terms.ip_conf_p1 && <p className="leading-relaxed">{terms.ip_conf_p1}</p>}
        {terms.ip_conf_p2 && <p className="leading-relaxed">{terms.ip_conf_p2}</p>}
        {terms.ip_conf_p3 && <p className="leading-relaxed">{terms.ip_conf_p3}</p>}

        {/* Verificación */}
        {terms.verification_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.verification_title}</h2>}
        {terms.verification_p1 && <p className="leading-relaxed">{terms.verification_p1}</p>}
        {terms.verification_p2 && <p className="leading-relaxed font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50">{terms.verification_p2}</p>}

        {/* Responsabilidad por Servicios de Coaches */}
        {terms.coach_services_resp_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.coach_services_resp_title}</h2>}
        {terms.coach_services_resp_p1 && <p className="leading-relaxed">{terms.coach_services_resp_p1}</p>}
        {terms.coach_services_resp_p2 && <p className="leading-relaxed">{terms.coach_services_resp_p2}</p>}
        {terms.coach_services_resp_p3 && <p className="leading-relaxed">{terms.coach_services_resp_p3}</p>}

        {/* Interacciones */}
        {terms.interactions_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.interactions_title}</h2>}
        {terms.interactions_p1 && <p className="leading-relaxed">{terms.interactions_p1}</p>}
        {terms.interactions_p2 && <p className="leading-relaxed">{terms.interactions_p2}</p>}
        {terms.interactions_p3 && <p className="leading-relaxed">{terms.interactions_p3}</p>}

        {/* Conductas Prohibidas */}
        {terms.prohibited_conduct_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.prohibited_conduct_title}</h2>}
        {terms.prohibited_conduct_p1 && <p className="leading-relaxed">{terms.prohibited_conduct_p1}</p>}
        {terms.prohibited_conduct_p2 && <p className="leading-relaxed">{terms.prohibited_conduct_p2}</p>}

        {/* Disponibilidad */}
        {terms.availability_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.availability_title}</h2>}
        {terms.availability_p1 && <p className="leading-relaxed">{terms.availability_p1}</p>}

        {/* Servicios Principales */}
        {terms.main_services_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.main_services_title}</h2>}
        {terms.main_services_items && (
          <ul className={`list-disc space-y-2 mb-4 ${isRTL ? 'pr-6' : 'pl-6'}`}>
            {terms.main_services_items.map((item: string, idx: number) => (
              <li key={idx} className="leading-relaxed">{item}</li>
            ))}
          </ul>
        )}

        {/* Registro y Cuentas */}
        {terms.registration_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.registration_title}</h2>}
        {terms.registration_p1 && <p className="leading-relaxed">{terms.registration_p1}</p>}

        {/* Planes y Suscripciones */}
        {terms.plans_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.plans_title}</h2>}
        {terms.plans_items && (
          <ul className={`list-disc space-y-2 mb-4 ${isRTL ? 'pr-6' : 'pl-6'}`}>
            {terms.plans_items.map((item: string, idx: number) => (
              <li key={idx} className="leading-relaxed">{item}</li>
            ))}
          </ul>
        )}

        {/* Cancelaciones y Reembolsos */}
        {terms.cancellation_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.cancellation_title}</h2>}
        {terms.refund_notice && (
          <p className="mb-4 text-gray-800 dark:text-gray-100 font-semibold bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800">
            {terms.refund_notice}
          </p>
        )}
        {terms.cancellation_p1 && <p className="leading-relaxed">{terms.cancellation_p1}</p>}
        {terms.cancellation_p2 && <p className="leading-relaxed">{terms.cancellation_p2}</p>}

        {/* Cursos en Video */}
        {terms.courses_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.courses_title}</h2>}
        {terms.courses_notice && (
          <p className="mb-4 text-red-700 dark:text-red-300 font-bold bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-800/60">
            {terms.courses_notice}
          </p>
        )}
        {terms.courses_p1 && <p className="leading-relaxed">{terms.courses_p1}</p>}

        {/* Pagos y Facturación */}
        {terms.payments_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.payments_title}</h2>}
        {terms.payments_p1 && <p className="leading-relaxed">{terms.payments_p1}</p>}

        {/* Strikes */}
        {terms.strikes_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.strikes_title}</h2>}
        {terms.strikes_items && (
          <ul className={`list-disc space-y-2 mb-4 ${isRTL ? 'pr-6' : 'pl-6'}`}>
            {terms.strikes_items.map((item: string, idx: number) => (
              <li key={idx} className="leading-relaxed font-semibold">{item}</li>
            ))}
          </ul>
        )}

        {/* Privacidad */}
        {terms.privacy_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.privacy_title}</h2>}
        {terms.privacy_p1 && <p className="leading-relaxed">{terms.privacy_p1}</p>}

        {/* Contacto */}
        {terms.contact_title && <h2 className="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-slate-800">{terms.contact_title}</h2>}
        {terms.contact_p1 && (
          <p className="leading-relaxed p-4 rounded-xl bg-cfh-light-green/10 dark:bg-cfh-light-green/20 border border-cfh-light-green/30 text-cfh-dark-green dark:text-cfh-light-green font-bold">
            {terms.contact_p1}
          </p>
        )}
      </div>
    </div>
  );
}
