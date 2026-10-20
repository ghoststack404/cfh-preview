'use client';

import { useState, useCallback, useEffect } from 'react';
import { CertificateUploadItem, CertificateFileType, CoachCertificate } from '../types';

function detectFileType(file: File): CertificateFileType | null {
  const mime = (file.type || '').toLowerCase();
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  if (mime.includes('pdf') || ext === 'pdf') {
    return 'PDF';
  }
  if (
    mime.includes('jpeg') ||
    mime.includes('jpg') ||
    mime.includes('pjpeg') ||
    ext === 'jpg' ||
    ext === 'jpeg'
  ) {
    return 'JPG';
  }
  if (mime.includes('png') || mime.includes('x-png') || ext === 'png') {
    return 'PNG';
  }
  if (mime.includes('webp') || ext === 'webp') {
    return 'PNG';
  }
  return null;
}

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export function useCertificateUpload(initialCertificates: CoachCertificate[] = []) {
  const [items, setItems] = useState<CertificateUploadItem[]>(() => {
    return initialCertificates.map((cert) => ({
      id: cert.id || `cert_${Math.random().toString(36).substring(2, 9)}`,
      title: cert.title,
      fileType: (cert.fileType || 'PDF').toUpperCase(),
      fileName: cert.fileName || 'documento',
      fileSize: cert.fileSize,
      fileUrl: cert.fileUrl,
      previewUrl: cert.fileUrl,
      uploadedUrl: cert.fileUrl,
      status: 'success',
      progress: 100,
    }));
  });

  const [activeUploadsCount, setActiveUploadsCount] = useState(0);
  const isUploading = activeUploadsCount > 0;

  // Sync if initialCertificates change externally and items was empty
  useEffect(() => {
    if (initialCertificates.length > 0 && items.length === 0) {
      setItems(
        initialCertificates.map((cert) => ({
          id: cert.id || `cert_${Math.random().toString(36).substring(2, 9)}`,
          title: cert.title,
          fileType: (cert.fileType || 'PDF').toUpperCase(),
          fileName: cert.fileName || 'documento',
          fileSize: cert.fileSize,
          fileUrl: cert.fileUrl,
          previewUrl: cert.fileUrl,
          uploadedUrl: cert.fileUrl,
          status: 'success',
          progress: 100,
        }))
      );
    }
  }, [initialCertificates]);

  const uploadFileToServer = async (itemId: string, file: File, detectedType: CertificateFileType) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/coach/certificates/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al subir el archivo');
      }

      const finalType = (data.fileType || detectedType || 'PDF').toUpperCase();

      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: 'success',
                progress: 100,
                uploadedUrl: data.url,
                fileName: data.fileName,
                fileType: finalType,
                fileSize: data.fileSize,
              }
            : item
        )
      );
    } catch (err: any) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: 'error',
                error: err.message || 'Error al procesar el archivo',
              }
            : item
        )
      );
    } finally {
      setActiveUploadsCount((prev) => Math.max(0, prev - 1));
    }
  };

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    const newUploadItems: { item: CertificateUploadItem; rawFile: File; detectedType: CertificateFileType }[] = [];

    for (const file of fileArray) {
      const fileType = detectFileType(file);
      const itemId = `cert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      if (!fileType) {
        newUploadItems.push({
          item: {
            id: itemId,
            file,
            title: file.name.replace(/\.[^/.]+$/, ''),
            fileType: 'PDF',
            fileName: file.name,
            fileSize: file.size,
            status: 'error',
            error: 'Formato no permitido. Solo se aceptan PDF, JPG o PNG.',
          },
          rawFile: file,
          detectedType: 'PDF',
        });
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        newUploadItems.push({
          item: {
            id: itemId,
            file,
            title: file.name.replace(/\.[^/.]+$/, ''),
            fileType,
            fileName: file.name,
            fileSize: file.size,
            status: 'error',
            error: 'El archivo excede el tamaño máximo permitido (15MB).',
          },
          rawFile: file,
          detectedType: fileType,
        });
        continue;
      }

      // Generate instant preview url
      const previewUrl = URL.createObjectURL(file);
      const rawName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
      const cleanTitle = (/^(descarga|download)(\s*\(\d+\))?$/i.test(rawName) || rawName.length < 3)
        ? 'Certificado Profesional'
        : rawName;

      newUploadItems.push({
        item: {
          id: itemId,
          file,
          title: cleanTitle,
          fileType,
          fileName: file.name,
          fileSize: file.size,
          previewUrl,
          fileUrl: previewUrl,
          uploadedUrl: '',
          status: 'uploading',
          progress: 30,
        },
        rawFile: file,
        detectedType: fileType,
      });
    }

    const itemsToUpload = newUploadItems.filter((n) => n.item.status === 'uploading');
    setActiveUploadsCount((prev) => prev + itemsToUpload.length);

    setItems((prev) => [...prev, ...newUploadItems.map((n) => n.item)]);

    // Trigger asynchronous upload for valid files
    for (const { item, rawFile, detectedType } of newUploadItems) {
      if (item.status === 'uploading') {
        uploadFileToServer(item.id, rawFile, detectedType);
      }
    }
  }, []);

  const updateTitle = useCallback((id: string, title: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title } : item))
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const itemToRemove = prev.find((item) => item.id === id);
      if (itemToRemove?.previewUrl && itemToRemove.previewUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(itemToRemove.previewUrl);
        } catch (_) {}
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const getValidCertificates = useCallback((): CoachCertificate[] => {
    return items
      .filter((item) => item.status === 'success' && (item.uploadedUrl || item.previewUrl))
      .map((item) => ({
        id: item.id.startsWith('cert_') ? undefined : item.id,
        title: item.title.trim() || item.fileName || 'Certificado',
        fileUrl: item.uploadedUrl || item.previewUrl || '',
        fileType: item.fileType,
        fileName: item.fileName,
        fileSize: item.fileSize,
      }));
  }, [items]);

  return {
    items,
    isUploading,
    addFiles,
    updateTitle,
    removeItem,
    getValidCertificates,
  };
}
