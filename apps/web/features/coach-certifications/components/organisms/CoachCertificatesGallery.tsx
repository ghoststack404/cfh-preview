'use client';

import React, { useState, useEffect } from 'react';
import { CoachCertificate } from '../../types';
import { CertificateCard } from '../molecules/CertificateCard';
import { CertificateBadge } from '../atoms/CertificateBadge';
import { useScrollLock } from '@/lib/scroll-lock';

interface CoachCertificatesGalleryProps {
  certificates?: CoachCertificate[];
  showCertificates?: boolean;
  className?: string;
}

export const CoachCertificatesGallery: React.FC<CoachCertificatesGalleryProps> = ({
  certificates = [],
  showCertificates = true,
  className = '',
}) => {
  // If visibility flag is false or no certificates exist, do not render
  if (!showCertificates || !certificates || certificates.length === 0) {
    return null;
  }

  const [selectedCert, setSelectedCert] = useState<CoachCertificate | null>(null);

  useScrollLock(Boolean(selectedCert));

  // Close modal on Escape key
  useEffect(() => {
    if (!selectedCert) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedCert(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedCert]);

  return (
    <section className={`space-y-4 ${className}`} aria-label="Certificaciones del Coach">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Certificaciones y Títulos
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Credenciales profesionales verificadas
            </p>
          </div>
        </div>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
          {certificates.length} {certificates.length === 1 ? 'certificado' : 'certificados'}
        </span>
      </div>

      {/* Grid of atomic cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {certificates.map((cert, index) => (
          <CertificateCard
            key={cert.id || index}
            certificate={cert}
            onView={(c) => setSelectedCert(c)}
          />
        ))}
      </div>

      {/* Visor / Lightbox Modal */}
      {selectedCert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedCert(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base line-clamp-1">
                  {(() => {
                    const t = (selectedCert.title || '').trim();
                    if (/^(descarga|download)(\s*\(\d+\))?$/i.test(t) || /^[a-f0-9-]{12,}$/i.test(t)) {
                      return 'Certificado de Acreditación';
                    }
                    return t.replace(/\.(pdf|jpe?g|png|webp)$/i, '') || 'Certificado de Acreditación';
                  })()}
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={selectedCert.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Abrir en pestaña nueva"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedCert(null)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Cerrar visor"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body: Document Preview */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[400px] max-h-[75vh] bg-gray-100/50 dark:bg-black/30">
              {(selectedCert.fileType || '').toUpperCase() === 'PDF' ||
              selectedCert.fileUrl.toLowerCase().endsWith('.pdf') ? (
                <div className="w-full h-full min-h-[500px] flex flex-col">
                  <iframe
                    src={`${selectedCert.fileUrl}#toolbar=0`}
                    className="w-full h-[600px] rounded-lg border border-gray-200 dark:border-gray-800"
                    title={selectedCert.title}
                  />
                  <div className="mt-2 text-center">
                    <a
                      href={selectedCert.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-primary underline"
                    >
                      ¿Problemas para ver el PDF? Haz clic aquí para descargarlo o abrirlo en pantalla completa.
                    </a>
                  </div>
                </div>
              ) : (
                <img
                  src={selectedCert.fileUrl}
                  alt={selectedCert.title}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
