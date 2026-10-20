export type CertificateFileType = "PDF" | "JPG" | "PNG" | "pdf" | "jpg" | "png" | string;

export interface CoachCertificate {
  id?: string;
  coachProfileId?: string;
  title: string;
  fileUrl: string;
  fileType: CertificateFileType;
  fileName?: string | null;
  fileSize?: number | null;
  issuedBy?: string | null;
  issuedAt?: string | Date | null;
  createdAt?: string | Date;
}

export interface CertificateUploadItem {
  id: string;
  file?: File;
  title: string;
  fileUrl?: string;
  uploadedUrl?: string;
  fileType: CertificateFileType;
  fileName: string;
  fileSize?: number | null;
  previewUrl?: string;
  status: "idle" | "uploading" | "success" | "error";
  progress?: number;
  error?: string;
  errorMessage?: string;
}
