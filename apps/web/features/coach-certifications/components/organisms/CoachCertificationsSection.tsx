'use client';

import React, { useRef, useEffect } from 'react';
import { CoachCertificate } from '../../types';
import { useCertificateUpload } from '../../hooks/useCertificateUpload';
import { CertificateUploaderItem } from '../molecules/CertificateUploaderItem';

interface CoachCertificationsSectionProps {
  showCertificates: boolean;
  onShowCertificatesChange: (show: boolean) => void;
  certificates?: CoachCertificate[];
  onCertificatesChange: (certs: CoachCertificate[]) => void;
}

export const CoachCertificationsSection: React.FC<CoachCertificationsSectionProps> = ({
  showCertificates,
  onShowCertificatesChange,
  certificates = [],
  onCertificatesChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    items,
    isUploading,
    addFiles,
    updateTitle,
    removeItem,
    getValidCertificates,
  } = useCertificateUpload(certificates);

  // Synchronize items with parent form state whenever items update
  useEffect(() => {
    const valid = getValidCertificates();
    onCertificatesChange(valid);
  }, [items, getValidCertificates]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      // Reset input value so same file can be re-selected if removed
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
      {/* Header & Toggle Checkbox */}
      <div className="flex items-start gap-3">
        <div className="flex h-6 items-center">
          <input
            id="showCertificates"
            name="showCertificates"
            type="checkbox"
            checked={showCertificates}
            onChange={(e) => onShowCertificatesChange(e.target.checked)}
            className="h-5 w-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary/20 dark:border-gray-700 dark:bg-gray-800 cursor-pointer"
          />
        </div>
        <div className="text-sm">
          <label
            htmlFor="showCertificates"
            className="font-medium text-gray-900 dark:text-gray-100 cursor-pointer select-none"
          >
            ¿Deseas mostrar tus certificaciones y títulos en tu perfil público?
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Aumenta tu credibilidad mostrando tus diplomas, certificaciones deportivas o títulos académicos a tus futuros clientes.
          </p>
        </div>
      </div>

      {/* Conditional DOM Rendering: only mounted when showCertificates is true */}
      {showCertificates && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4 animate-in fade-in duration-200">
          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:border-brand-primary dark:hover:border-brand-primary bg-gray-50/50 dark:bg-gray-800/30 hover:bg-brand-primary/5 transition-all cursor-pointer text-center"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="w-12 h-12 mb-3 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>

            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              <span className="text-brand-primary underline">Haz clic para subir</span> o arrastra y suelta tus archivos aquí
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Archivos permitidos: PDF, JPG, PNG (máx. 15MB por archivo). Puedes subir tanto imágenes como documentos PDF.
            </p>
          </div>

          {/* List of uploaded items */}
          {items.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Certificaciones cargadas ({items.length})
              </h4>
              <div className="grid gap-3">
                {items.map((item) => (
                  <CertificateUploaderItem
                    key={item.id}
                    item={item}
                    onTitleChange={(newTitle) => updateTitle(item.id, newTitle)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {isUploading && (
            <div className="flex items-center gap-2 text-xs text-brand-primary">
              <div className="w-3 h-3 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
              <span>Subiendo archivos, por favor espera...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
