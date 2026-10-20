'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CertificateFileType } from '../../types';
import { DocumentIcon } from './DocumentIcon';

interface LazyDocumentPreviewProps {
  fileUrl: string;
  fileType: CertificateFileType;
  alt?: string;
  className?: string;
  aspectRatio?: string;
}

export const LazyDocumentPreview: React.FC<LazyDocumentPreviewProps> = ({
  fileUrl,
  fileType,
  alt = 'Certificado',
  className = '',
  aspectRatio = 'aspect-[4/3]',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  const normalizedType = (fileType || '').toUpperCase();
  const urlLower = (fileUrl || '').toLowerCase();
  const isImage =
    normalizedType === 'JPG' ||
    normalizedType === 'JPEG' ||
    normalizedType === 'PNG' ||
    normalizedType === 'WEBP' ||
    urlLower.endsWith('.jpg') ||
    urlLower.endsWith('.jpeg') ||
    urlLower.endsWith('.png') ||
    urlLower.endsWith('.webp') ||
    urlLower.startsWith('data:image/') ||
    (urlLower.startsWith('blob:') && !normalizedType.includes('PDF'));

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center ${aspectRatio} ${className}`}
    >
      {(!isVisible || (isImage && !hasLoaded && !hasError)) && (
        <div className="absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-700/60 flex items-center justify-center">
          <DocumentIcon fileType={fileType} className="w-6 h-6 opacity-40 text-gray-400" />
        </div>
      )}

      {isVisible && (
        <>
          {isImage ? (
            hasError ? (
              <div className="flex flex-col items-center justify-center text-gray-400 p-2 text-center text-xs">
                <DocumentIcon fileType={fileType} className="w-6 h-6 mb-1 opacity-50" />
                <span>Error al cargar vista previa</span>
              </div>
            ) : (
              <img
                src={fileUrl}
                alt={alt}
                loading="lazy"
                onLoad={() => setHasLoaded(true)}
                onError={() => setHasError(true)}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  hasLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full p-2 text-center group-hover:scale-105 transition-transform duration-200 bg-red-50/60 dark:bg-red-950/20 select-none">
              <div className="p-2 sm:p-2.5 bg-red-100/90 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg shadow-2xs mb-1 border border-red-200/50 dark:border-red-800/40">
                <DocumentIcon fileType="PDF" className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wider line-clamp-1">
                PDF
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
