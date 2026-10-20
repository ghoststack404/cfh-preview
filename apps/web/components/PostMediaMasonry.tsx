"use client";

import React from "react";
import { Eye, Images, ZoomIn } from "lucide-react";

export interface PostMediaMasonryProps {
  images: string[];
  isModal?: boolean;
  onOpenLightbox?: (images: string[], index: number) => void;
  className?: string;
}

/**
 * Componente Fotos: Renderizado en mampostería (grid / collage) para posts con imágenes.
 * Soporta de 1 a 8 fotos con layouts adaptativos optimizados:
 * - 1 imagen: Contenedor individual con max-height y botón "Ver completa"
 * - 2 imágenes: Cuadrícula simétrica 2 columnas
 * - 3 imágenes: Mampostería asimétrica (1 destacada 2/3 + 2 apiladas 1/3)
 * - 4 imágenes: Cuadrícula armónica 2x2
 * - 5 imágenes: Mampostería 2 arriba + 3 abajo
 * - 6+ imágenes: Mampostería 2 arriba + 3 abajo con overlay "+N" interactivo
 */
export function PostMediaMasonry({
  images,
  isModal = false,
  onOpenLightbox,
  className = "",
}: PostMediaMasonryProps) {
  if (!images || images.length === 0) return null;

  const count = images.length;

  const handleClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    onOpenLightbox?.(images, index);
  };

  // 1 IMAGEN
  if (count === 1) {
    return (
      <div
        className={`mb-3 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800 bg-gray-900/5 dark:bg-black/40 flex items-center justify-center relative group ${className}`}
      >
        <img
          src={images[0]}
          alt="Imagen adjunta"
          className={`w-auto max-w-full h-auto ${
            isModal ? "max-h-[380px]" : "max-h-[420px]"
          } object-contain cursor-pointer rounded-2xl group-hover:opacity-95 transition-opacity`}
          onClick={(e) => handleClick(e, 0)}
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            // Si falla, intentamos una vez más o si es una URL local relativa, aseguramos que cargue
            if (!target.dataset.retried && images[0]) {
              target.dataset.retried = "true";
              target.src = images[0];
            } else {
              target.style.display = "none";
            }
          }}
        />
        <button
          type="button"
          onClick={(e) => handleClick(e, 0)}
          className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-xs text-white text-xs font-semibold flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md"
          title="Ver imagen completa"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Ver completa</span>
        </button>
      </div>
    );
  }

  // 2 IMÁGENES
  if (count === 2) {
    return (
      <div
        className={`mb-3 grid grid-cols-2 gap-2 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800 bg-black/5 dark:bg-slate-950/40 ${className}`}
      >
        {images.slice(0, 2).map((img, idx) => (
          <div
            key={idx}
            className="relative aspect-[16/10] sm:aspect-[16/9] bg-gray-100 dark:bg-slate-800 overflow-hidden group cursor-pointer"
            onClick={(e) => handleClick(e, idx)}
          >
            <img
              src={img}
              alt={`Imagen ${idx + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-end p-2.5 opacity-0 group-hover:opacity-100">
              <span className="p-1.5 rounded-lg bg-black/60 text-white backdrop-blur-xs">
                <ZoomIn className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 3 IMÁGENES: MAMPOSTERÍA ASIMÉTRICA (1 dominante izquierda + 2 apiladas derecha)
  if (count === 3) {
    return (
      <div
        className={`mb-3 grid grid-cols-3 grid-rows-2 gap-2 h-[280px] sm:h-[340px] rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800 bg-black/5 dark:bg-slate-950/40 ${className}`}
      >
        {/* Imagen principal (ocupa 2 columnas y 2 filas) */}
        <div
          className="col-span-2 row-span-2 relative w-full h-full bg-gray-100 dark:bg-slate-800 overflow-hidden group cursor-pointer"
          onClick={(e) => handleClick(e, 0)}
        >
          <img
            src={images[0]}
            alt="Imagen 1"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-end p-2.5 opacity-0 group-hover:opacity-100">
            <span className="p-1.5 rounded-lg bg-black/60 text-white backdrop-blur-xs">
              <ZoomIn className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Imágenes secundarias apiladas a la derecha */}
        {images.slice(1, 3).map((img, idx) => (
          <div
            key={idx + 1}
            className="col-span-1 row-span-1 relative w-full h-full bg-gray-100 dark:bg-slate-800 overflow-hidden group cursor-pointer"
            onClick={(e) => handleClick(e, idx + 1)}
          >
            <img
              src={img}
              alt={`Imagen ${idx + 2}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-end p-2 opacity-0 group-hover:opacity-100">
              <span className="p-1 rounded-md bg-black/60 text-white backdrop-blur-xs">
                <ZoomIn className="w-3 h-3" />
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 4 IMÁGENES: CUADRÍCULA ARMÓNICA 2x2
  if (count === 4) {
    return (
      <div
        className={`mb-3 grid grid-cols-2 grid-rows-2 gap-2 h-[300px] sm:h-[360px] rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800 bg-black/5 dark:bg-slate-950/40 ${className}`}
      >
        {images.slice(0, 4).map((img, idx) => (
          <div
            key={idx}
            className="relative w-full h-full bg-gray-100 dark:bg-slate-800 overflow-hidden group cursor-pointer"
            onClick={(e) => handleClick(e, idx)}
          >
            <img
              src={img}
              alt={`Imagen ${idx + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-end p-2 opacity-0 group-hover:opacity-100">
              <span className="p-1.5 rounded-lg bg-black/60 text-white backdrop-blur-xs">
                <ZoomIn className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 5 O MÁS IMÁGENES: MAMPOSTERÍA (2 arriba + 3 abajo, con contador en la última si > 5)
  const displayImages = images.slice(0, 5);
  const remainingCount = count > 5 ? count - 5 : 0;

  return (
    <div
      className={`mb-3 grid grid-cols-6 grid-rows-2 gap-2 h-[320px] sm:h-[380px] rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800 bg-black/5 dark:bg-slate-950/40 ${className}`}
    >
      {/* Fila superior: 2 imágenes (ocupan 3 columnas cada una) */}
      {displayImages.slice(0, 2).map((img, idx) => (
        <div
          key={idx}
          className="col-span-3 row-span-1 relative w-full h-full bg-gray-100 dark:bg-slate-800 overflow-hidden group cursor-pointer"
          onClick={(e) => handleClick(e, idx)}
        >
          <img
            src={img}
            alt={`Imagen ${idx + 1}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-end p-2 opacity-0 group-hover:opacity-100">
            <span className="p-1.5 rounded-lg bg-black/60 text-white backdrop-blur-xs">
              <ZoomIn className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      ))}

      {/* Fila inferior: 3 imágenes (ocupan 2 columnas cada una) */}
      {displayImages.slice(2, 5).map((img, idx) => {
        const actualIndex = idx + 2;
        const isLastVisible = actualIndex === 4 && remainingCount > 0;

        return (
          <div
            key={actualIndex}
            className="col-span-2 row-span-1 relative w-full h-full bg-gray-100 dark:bg-slate-800 overflow-hidden group cursor-pointer"
            onClick={(e) => handleClick(e, actualIndex)}
          >
            <img
              src={img}
              alt={`Imagen ${actualIndex + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />

            {isLastVisible ? (
              <div className="absolute inset-0 bg-black/70 hover:bg-black/60 transition-colors flex flex-col items-center justify-center text-white backdrop-blur-[2px]">
                <div className="flex items-center gap-1.5 text-lg sm:text-xl font-black">
                  <Images className="w-5 h-5 text-cfh-light-green" />
                  <span>+{remainingCount + 1}</span>
                </div>
                <span className="text-xs sm:text-sm font-medium text-white/90">
                  más fotos
                </span>
              </div>
            ) : (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-end p-2 opacity-0 group-hover:opacity-100">
                <span className="p-1 rounded-md bg-black/60 text-white backdrop-blur-xs">
                  <ZoomIn className="w-3 h-3" />
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
