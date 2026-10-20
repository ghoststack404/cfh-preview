'use client';

import React from 'react';
import { CertificateUploadItem } from '../../types';
import { CertificateBadge } from '../atoms/CertificateBadge';
import { LazyDocumentPreview } from '../atoms/LazyDocumentPreview';

interface CertificateUploaderItemProps {
  item: CertificateUploadItem;
  onTitleChange: (title: string) => void;
  onRemove: () => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const CertificateUploaderItem: React.FC<CertificateUploaderItemProps> = ({
  item,
  onTitleChange,
  onRemove,
}) => {
  const isUploading = item.status === 'uploading';
  const isError = item.status === 'error';
  const isSuccess = item.status === 'success';

  return (
    <div
      className={`group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
        isError
          ? 'border-red-300 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20'
          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/80 shadow-sm hover:border-brand-primary/40'
      }`}
    >
      {/* Document thumbnail / instant preview */}
      <div
        onClick={() => {
          const targetUrl = item.uploadedUrl || item.previewUrl || item.fileUrl;
          if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }}
        className="group/thumb relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-brand-primary/60 transition-all shadow-xs"
        title="Haz clic para ver el archivo en pantalla completa"
      >
        {item.previewUrl || item.uploadedUrl || item.fileUrl ? (
          <LazyDocumentPreview
            fileUrl={item.uploadedUrl || item.previewUrl || item.fileUrl || ''}
            fileType={item.fileType}
            alt={item.title}
            aspectRatio="aspect-square"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400">
            <span className="text-xs">Sin archivo</span>
          </div>
        )}

        {/* Hover preview eye badge */}
        {!isUploading && (item.previewUrl || item.uploadedUrl || item.fileUrl) && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
            <svg className="w-5 h-5 drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
        )}

        {/* Uploading overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center text-white">
            <svg
              className="animate-spin h-6 w-6 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="text-[10px] font-semibold mt-1">Subiendo...</span>
          </div>
        )}
      </div>

      {/* Details & Editable Title */}
      <div className="flex-1 w-full min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <CertificateBadge fileType={item.fileType} />
          {item.fileSize ? (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileSize(item.fileSize)}
            </span>
          ) : null}
          {isSuccess && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Listo
            </span>
          )}
          {(item.uploadedUrl || item.previewUrl || item.fileUrl) && (
            <button
              type="button"
              onClick={() => {
                const targetUrl = item.uploadedUrl || item.previewUrl || item.fileUrl;
                if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer');
              }}
              className="text-xs text-brand-primary hover:underline font-medium inline-flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Ver archivo
            </button>
          )}
        </div>

        {/* Title Input */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Título o nombre del certificado
          </label>
          <input
            type="text"
            value={item.title}
            onChange={(e) => onTitleChange(e.target.value)}
            disabled={isUploading}
            placeholder="Ej. Certificación Internacional Kettlebell L1"
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all disabled:opacity-50"
          />
        </div>

        {/* Error message if any */}
        {isError && item.error && (
          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>{item.error}</span>
          </p>
        )}
      </div>

      {/* Action: Delete / Remove */}
      <div className="self-end sm:self-center flex-shrink-0">
        <button
          type="button"
          onClick={onRemove}
          title="Eliminar certificado"
          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
