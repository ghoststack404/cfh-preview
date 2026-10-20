'use client';

import React from 'react';
import { CoachCertificate } from '../../types';
import { CertificateBadge } from '../atoms/CertificateBadge';
import { LazyDocumentPreview } from '../atoms/LazyDocumentPreview';

interface CertificateCardProps {
  certificate: CoachCertificate;
  onView?: (certificate: CoachCertificate) => void;
}

export const CertificateCard: React.FC<CertificateCardProps> = ({
  certificate,
  onView,
}) => {
  const isPdf =
    (certificate.fileType || '').toUpperCase() === 'PDF' ||
    certificate.fileUrl.toLowerCase().endsWith('.pdf');

  const handleClick = () => {
    if (onView) {
      onView(certificate);
    } else {
      window.open(certificate.fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const getFormattedTitle = (title?: string) => {
    if (!title) return 'Certificado Profesional';
    const trimmed = title.trim();
    // Si parece un nombre de descarga o archivo sin procesar
    if (/^(descarga|download)(\s*\(\d+\))?$/i.test(trimmed) || /^[a-f0-9-]{12,}$/i.test(trimmed)) {
      return 'Certificado de Acreditación';
    }
    // Remover extensiones residuales si las tuviera (.png, .jpg, .pdf)
    const withoutExt = trimmed.replace(/\.(pdf|jpe?g|png|webp)$/i, '');
    return withoutExt || 'Certificado Profesional';
  };

  const displayTitle = getFormattedTitle(certificate.title);

  return (
    <div
      onClick={handleClick}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-brand-primary/40 cursor-pointer"
    >
      {/* Lazy Document Preview */}
      <div className="relative w-full aspect-[4/3] bg-gray-50 dark:bg-gray-800/60 overflow-hidden">
        <LazyDocumentPreview
          fileUrl={certificate.fileUrl}
          fileType={certificate.fileType}
          alt={certificate.title}
          aspectRatio="aspect-full h-full w-full"
          className="w-full h-full transition-transform duration-300 group-hover:scale-105"
        />

        {/* Hover overlay hint */}
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 dark:bg-gray-900/90 text-xs font-semibold text-gray-900 dark:text-gray-100 shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            Ver documento
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h4
            className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 title-hover group-hover:text-brand-primary transition-colors"
            title={displayTitle}
          >
            {displayTitle}
          </h4>
          {certificate.issuedBy && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
              Emitido por: {certificate.issuedBy}
            </p>
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Verificado
          </span>
          <span className="text-brand-primary font-medium group-hover:underline inline-flex items-center gap-0.5">
            Abrir &rarr;
          </span>
        </div>
      </div>
    </div>
  );
};
