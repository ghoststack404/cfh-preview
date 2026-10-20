"use client";

import { motion } from 'framer-motion';
import { useTranslation } from '@/components/TranslationProvider';
import { useParams } from 'next/navigation';

export default function MisionPage() {
  const { t } = useTranslation();
  const params = useParams();
  const locale = params.locale as string;

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
        <div className="bg-[#081B33] dark:bg-slate-950 px-8 py-10 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cfh-light-green/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          <h1 className="text-3xl font-extrabold tracking-tight relative z-10">{t('Footer.mission', 'Nuestra Misión')}</h1>
          <p className="mt-2 text-[#A7D4B6] relative z-10">Coaching From Home</p>
        </div>
        
        <div className="p-8 sm:p-12 text-gray-700 dark:text-slate-300 space-y-8 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Nuestra Misión</h2>
            <p className="mb-4">
              Democratizar el acceso a la mentoría profesional y técnica de la más alta calidad, conectando a aprendices motivados con coaches expertos verificados a través de sesiones de 60 min por videollamada en vivo, cursos asíncronos prácticos y herramientas de Inteligencia Artificial — todo desde la comodidad del hogar.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Conexión humana auténtica sin barreras físicas.</li>
              <li>Tecnología de IA que asiste tanto al alumno como al coach.</li>
              <li>Ingresos justos y proyección profesional para mentores.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Nuestra Visión</h2>
            <p className="mb-4">
              Convertirnos en el ecosistema líder de coaching en vivo de habla hispana en el mundo, reconocido por la excelencia de sus mentores, la innovación constante en sus herramientas inteligentes y el impacto verificable en la vida y el empleo de millones de personas.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>La mayor red de mentores certificados en habla hispana.</li>
              <li>Certificaciones oficiales reconocidas por el mercado laboral.</li>
              <li>Impulso permanente a la economía del conocimiento en LATAM.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Nuestros Valores</h2>
            <p className="mb-4">En Coaching From Home, cada decisión se guía por nuestros principios innegociables:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Propósito claro:</strong> Acortar la distancia entre el conocimiento y quien lo necesita.</li>
              <li><strong>Comunidad primero:</strong> Construir relaciones auténticas basadas en la confianza mutua.</li>
              <li><strong>Innovación e IA:</strong> Asistir a nuestros mentores y alumnos con la mejor tecnología.</li>
              <li><strong>Resultados medibles:</strong> Garantizar transformación real, retroalimentación y metas claras.</li>
              <li><strong>Calidez humana:</strong> Recordar que la empatía en la educación siempre será irreemplazable.</li>
            </ul>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
