"use client";

import React from "react";
import { CertificateFileType } from "../../types";

interface CertificateBadgeProps {
  fileType: CertificateFileType;
  className?: string;
}

export function CertificateBadge({ fileType, className = "" }: CertificateBadgeProps) {
  const normalized = (fileType || "").toLowerCase();

  let badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let label = "DOC";

  if (normalized.includes("pdf")) {
    badgeStyle = "bg-rose-50 text-rose-700 border-rose-200";
    label = "PDF";
  } else if (normalized.includes("jpg") || normalized.includes("jpeg")) {
    badgeStyle = "bg-sky-50 text-sky-700 border-sky-200";
    label = "JPG";
  } else if (normalized.includes("png")) {
    badgeStyle = "bg-violet-50 text-violet-700 border-violet-200";
    label = "PNG";
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs sm:text-sm font-extrabold uppercase tracking-wide border shadow-2xs ${badgeStyle} ${className}`}
    >
      {label}
    </span>
  );
}
