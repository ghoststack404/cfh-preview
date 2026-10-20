"use client";

import React from "react";
import { FileText, Image as ImageIcon, Award, FileSpreadsheet } from "lucide-react";
import { CertificateFileType } from "../../types";

interface DocumentIconProps {
  fileType: CertificateFileType;
  className?: string;
  size?: number;
}

export function DocumentIcon({ fileType, className = "", size = 20 }: DocumentIconProps) {
  const normalized = (fileType || "").toLowerCase();

  if (normalized.includes("pdf")) {
    return <FileText size={size} className={`text-rose-500 ${className}`} />;
  }
  if (normalized.includes("jpg") || normalized.includes("jpeg") || normalized.includes("png")) {
    return <ImageIcon size={size} className={`text-sky-500 ${className}`} />;
  }
  return <Award size={size} className={`text-emerald-500 ${className}`} />;
}
