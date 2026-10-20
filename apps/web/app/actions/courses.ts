"use server";

import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/app/actions/onboarding";
import { slugify } from "@/lib/slug";
import type { CourseStatus } from "@prisma/client";
import { cookies } from "next/headers";
import crypto from "crypto";
import { checkFeatureAccess } from "@/lib/subscription-gating";
import { moderateCourseContent, CourseModerationResult, CourseModerationViolation } from "@/lib/courseModeration";

export interface CoachCourseDTO {
  id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  thumbnailUrl: string | null;
  introVideoUrl: string | null;
  priceCents: number;
  currency: string;
  status: CourseStatus;
  estimatedMinutes: number;
  averageRating: number;
  enrollmentCount: number;
  categoryId: string | null;
  categoryName?: string | null;
  modulesCount: number;
  lessonsCount: number;
  createdAt: string;
  updatedAt: string;
  isScheduledForDeletion?: boolean;
  scheduledDeletionDate?: string | null;
  isUnderMaintenance?: boolean;
  modules?: {
    id: string;
    title: string;
    lessons: {
      id: string;
      title: string;
      durationMinutes: number;
      kind: string;
      videoUrl: string | null;
      isPreview: boolean;
    }[];
  }[];
}

export interface SaveCourseInput {
  id?: string;
  title: string;
  summary: string;
  description: string;
  priceCents: number;
  currency?: string;
  categoryId?: string;
  thumbnailUrl?: string;
  introVideoUrl?: string;       // NEW
  estimatedMinutes?: number;
  status?: CourseStatus;
  certificateEnabled?: boolean;  // NEW
  whatYouWillLearn?: string[];   // NEW - learning objectives
  modules?: {                    // NEW - course modules with lessons
    title: string;
    lessons: {
      title: string;
      durationMinutes: number;
      kind?: 'CONTENT' | 'ASSIGNMENT' | 'PROJECT';
      videoUrl?: string;
      isPreview?: boolean;
    }[];
  }[];
}

export async function getCoachCourses() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autenticado", courses: [], categories: [] };
    }

    const [courses, categories] = await Promise.all([
      prisma.course.findMany({
        where: { coachId: user.id },
        include: {
          category: { select: { id: true, name: true } },
          modules: {
            orderBy: { position: "asc" },
            include: {
              lessons: { orderBy: { position: "asc" } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const formattedCourses: CoachCourseDTO[] = courses.map((c) => {
      const lessonsCount = c.modules.reduce((acc, m) => acc + m.lessons.length, 0);

      // Detección de baja programada (3 días hábiles)
      let isScheduledForDeletion = false;
      let scheduledDeletionDate: string | null = null;
      if (c.description?.includes("[CFH_SCHEDULED_DELETION:")) {
        try {
          const match = c.description.match(/\[CFH_SCHEDULED_DELETION:([\s\S]*?)\]/);
          if (match && match[1]) {
            const parsed = JSON.parse(match[1]);
            isScheduledForDeletion = true;
            scheduledDeletionDate = parsed.scheduledFor;
          }
        } catch (e) {}
      }

      // Detección de modo mantenimiento / pausa
      const isUnderMaintenance = !!c.description?.includes("[CFH_MAINTENANCE_MODE:true]");

      return {
        id: c.id,
        title: c.title,
        slug: c.slug,
        summary: c.summary,
        description: c.description,
        thumbnailUrl: c.thumbnailUrl,
        introVideoUrl: c.introVideoUrl,
        priceCents: c.priceCents,
        currency: c.currency,
        status: c.status,
        estimatedMinutes: c.estimatedMinutes,
        averageRating: c.averageRating,
        enrollmentCount: c.enrollmentCount,
        categoryId: c.categoryId,
        categoryName: c.category?.name || null,
        modulesCount: c.modules.length,
        lessonsCount,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        isScheduledForDeletion,
        scheduledDeletionDate,
        isUnderMaintenance,
        modules: c.modules.map((m) => ({
          id: m.id,
          title: m.title,
          lessons: m.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            durationMinutes: l.durationMinutes || 0,
            kind: l.kind,
            videoUrl: l.videoUrl || null,
            isPreview: l.isPreview,
          })),
        })),
      };
    });

    return {
      success: true,
      courses: formattedCourses,
      categories,
    };
  } catch (error: any) {
    console.error("Error al obtener cursos del coach:", error);
    return { success: false, error: error?.message || "Error al cargar cursos", courses: [], categories: [] };
  }
}

// Cargar un curso específico con módulos y lecciones completos para edición
export async function getCoachCourseForEdit(courseId: string) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "No autenticado" };

    const course = await prisma.course.findFirst({
      where: { id: courseId, coachId: user.id },
      include: {
        modules: {
          orderBy: { position: "asc" },
          include: {
            lessons: {
              orderBy: { position: "asc" },
              select: {
                id: true,
                title: true,
                durationMinutes: true,
                videoUrl: true,
                isPreview: true,
                kind: true,
              },
            },
          },
        },
      },
    });

    if (!course) return { success: false, error: "Curso no encontrado" };

    // Extraer whatYouWillLearn de la descripción si está en formato markdown
    const wylMatch = course.description?.match(/### Lo que aprenderás\n([\s\S]*?)(?:\n###|$)/);
    let whatYouWillLearn: string[] = [];
    if (wylMatch?.[1]) {
      whatYouWillLearn = wylMatch[1]
        .split("\n")
        .map((l) => l.replace(/^-\s*/, "").trim())
        .filter(Boolean);
    }

    return {
      success: true,
      course: {
        whatYouWillLearn,
        certificateEnabled: course.certificateEnabled,
        modules: course.modules.map((m) => ({
          id: m.id,
          title: m.title,
          lessons: m.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            durationMinutes: l.durationMinutes,
            videoUrl: l.videoUrl ?? undefined,
            isPreview: l.isPreview,
            kind: l.kind as 'CONTENT' | 'ASSIGNMENT' | 'PROJECT',
          })),
        })),
      },
    };
  } catch (error: any) {
    console.error("Error al cargar curso para edición:", error);
    return { success: false, error: error?.message || "Error al cargar el curso" };
  }
}

async function logCourseModerationAudit(
  actorId: string,
  action: string,
  courseId: string,
  metadata?: Record<string, unknown>
) {
  try {
    let ipAddress: string | undefined;
    try {
      const { headers } = await import("next/headers");
      const list = await headers();
      ipAddress = list.get("x-forwarded-for")?.split(",")[0]?.trim() ?? list.get("x-real-ip") ?? undefined;
    } catch {}

    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType: "Course",
        entityId: courseId,
        metadata: metadata ? (metadata as any) : undefined,
        ipAddress,
      },
    });
  } catch (err) {
    console.error(`[audit] Error registrando ${action} para curso ${courseId}:`, err);
  }
}

async function syncCourseModulesAndLessons(courseId: string, modules: NonNullable<SaveCourseInput["modules"]>) {
  for (let mi = 0; mi < modules.length; mi++) {
    const mod = modules[mi];
    if (!mod || !mod.title.trim()) continue;
    const createdModule = await prisma.courseModule.create({
      data: {
        courseId,
        title: mod.title.trim(),
        position: mi + 1,
      },
    });
    if (mod.lessons && mod.lessons.length > 0) {
      for (let li = 0; li < mod.lessons.length; li++) {
        const lesson = mod.lessons[li];
        if (!lesson || !lesson.title.trim()) continue;
        await prisma.courseLesson.create({
          data: {
            moduleId: createdModule.id,
            title: lesson.title.trim(),
            position: li + 1,
            durationMinutes: lesson.durationMinutes || 10,
            kind: lesson.kind || "CONTENT",
            videoUrl: lesson.videoUrl || null,
            isPreview: lesson.isPreview || false,
          },
        });
      }
    }
  }
}

export async function saveCoachCourse(input: SaveCourseInput) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autorizado. Inicia sesión para continuar." };
    }

    const hasAccess = await checkFeatureAccess(user.id, "hasCourseBuilder");
    if (!hasAccess) {
      return {
        success: false,
        error: "Tu plan actual no permite esta función.",
        code: "FEATURE_LOCKED",
      };
    }

    const title = input.title?.trim();
    if (!title || title.length < 5) {
      return { success: false, error: "El título debe tener al menos 5 caracteres." };
    }

    const summary = input.summary?.trim() || "";
    const description = input.description?.trim() || summary;
    const priceCents = Math.max(0, Number(input.priceCents) || 0);
    const currency = input.currency || "USD";
    const estimatedMinutes = Number(input.estimatedMinutes) || 60;
    const requestedStatus: CourseStatus = input.status || "DRAFT";
    const thumbnailUrl = input.thumbnailUrl?.trim() || null;
    const categoryId = input.categoryId || null;
    const introVideoUrl = input.introVideoUrl?.trim() || null;
    const certificateEnabled = input.certificateEnabled !== false;

    let fullDescription = description;
    if (input.whatYouWillLearn && input.whatYouWillLearn.length > 0) {
      const learnList = input.whatYouWillLearn.filter((s) => s.trim()).map((s) => `- ${s.trim()}`).join("\n");
      if (learnList) fullDescription += `\n\n### Lo que aprenderás\n${learnList}`;
    }

    // Si el coach solicita publicar directamente (status === "PUBLISHED"), ejecutar inspección de moderación con IA obligatoria
    if (requestedStatus === "PUBLISHED") {
      // Si no vienen módulos en el input pero es una edición, cargar los módulos actuales de la base de datos para inspección
      let modulesToInspect = input.modules;
      if (input.id && (!modulesToInspect || modulesToInspect.length === 0)) {
        const existingModules = await prisma.courseModule.findMany({
          where: { courseId: input.id },
          include: { lessons: true },
        });
        if (existingModules.length > 0) {
          modulesToInspect = existingModules.map((m) => ({
            title: m.title,
            lessons: m.lessons.map((l) => ({
              title: l.title,
              durationMinutes: l.durationMinutes,
              videoUrl: l.videoUrl || undefined,
            })),
          }));
        }
      }

      const moderation = await moderateCourseContent({
        title,
        summary,
        description: fullDescription,
        whatYouWillLearn: input.whatYouWillLearn,
        priceCents,
        currency,
        thumbnailUrl,
        introVideoUrl,
        estimatedMinutes,
        modules: modulesToInspect,
      });

      // CASO A: Falló la inspección automatizada por IA (contenido inapropiado, toxicidad, bypass o estructura incompleta)
      if (!moderation.allowed) {
        let courseId = input.id;

        if (input.id) {
          // Mantener o revertir curso a DRAFT
          const existing = await prisma.course.findUnique({ where: { id: input.id } });
          if (!existing || existing.coachId !== user.id) {
            return { success: false, error: "Curso no encontrado o sin permisos de edición." };
          }

          await prisma.course.update({
            where: { id: input.id },
            data: {
              title,
              summary,
              description: fullDescription,
              priceCents,
              currency,
              estimatedMinutes,
              status: "DRAFT",
              publishedAt: null,
              thumbnailUrl,
              introVideoUrl,
              certificateEnabled,
              categoryId,
            },
          });

          if (input.modules && input.modules.length > 0) {
            await prisma.courseModule.deleteMany({ where: { courseId: input.id } });
            await syncCourseModulesAndLessons(input.id, input.modules);
          }
        } else {
          // Crear curso nuevo como DRAFT para no perder el progreso del usuario
          let baseSlug = slugify(title);
          if (!baseSlug) baseSlug = `curso-${Date.now().toString(36)}`;
          const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

          const created = await prisma.course.create({
            data: {
              coachId: user.id,
              title,
              slug,
              summary,
              description: fullDescription,
              priceCents,
              currency,
              estimatedMinutes,
              status: "DRAFT",
              publishedAt: null,
              thumbnailUrl,
              introVideoUrl,
              certificateEnabled,
              categoryId,
            },
          });
          courseId = created.id;

          if (input.modules && input.modules.length > 0) {
            await syncCourseModulesAndLessons(created.id, input.modules);
          }
        }

        // Registrar rechazo en AuditLog
        await logCourseModerationAudit(user.id, "COURSE_MODERATION_REJECTED", courseId!, {
          violations: moderation.violations,
          reasons: moderation.reasons,
          score: moderation.score,
          reviewedBy: moderation.reviewedBy,
        });

        return {
          success: false,
          code: "MODERATION_FAILED",
          error: "La publicación fue detenida por la moderación con IA. Corrige los problemas indicados.",
          violations: moderation.violations,
          reasons: moderation.reasons,
          courseId,
        };
      }

      // CASO B: Aprobado por la inspección de IA -> Publicar directamente
      if (input.id) {
        const existing = await prisma.course.findUnique({ where: { id: input.id } });
        if (!existing || existing.coachId !== user.id) {
          return { success: false, error: "Curso no encontrado o sin permisos de edición." };
        }

        const updated = await prisma.course.update({
          where: { id: input.id },
          data: {
            title,
            summary,
            description: fullDescription,
            priceCents,
            currency,
            estimatedMinutes,
            status: "PUBLISHED",
            publishedAt: existing.publishedAt || new Date(),
            thumbnailUrl,
            introVideoUrl,
            certificateEnabled,
            categoryId,
          },
        });

        if (input.modules && input.modules.length > 0) {
          await prisma.courseModule.deleteMany({ where: { courseId: input.id } });
          await syncCourseModulesAndLessons(input.id, input.modules);
        }

        await logCourseModerationAudit(user.id, "COURSE_MODERATION_APPROVED", updated.id, {
          score: moderation.score,
          reviewedBy: moderation.reviewedBy,
        });

        return {
          success: true,
          status: "PUBLISHED",
          courseId: updated.id,
          message: "¡Tu curso superó la verificación de calidad e IA y ha sido publicado con éxito!",
        };
      } else {
        let baseSlug = slugify(title);
        if (!baseSlug) baseSlug = `curso-${Date.now().toString(36)}`;
        const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

        const created = await prisma.course.create({
          data: {
            coachId: user.id,
            title,
            slug,
            summary,
            description: fullDescription,
            priceCents,
            currency,
            estimatedMinutes,
            status: "PUBLISHED",
            publishedAt: new Date(),
            thumbnailUrl,
            introVideoUrl,
            certificateEnabled,
            categoryId,
          },
        });

        if (input.modules && input.modules.length > 0) {
          await syncCourseModulesAndLessons(created.id, input.modules);
        }

        await logCourseModerationAudit(user.id, "COURSE_MODERATION_APPROVED", created.id, {
          score: moderation.score,
          reviewedBy: moderation.reviewedBy,
        });

        return {
          success: true,
          status: "PUBLISHED",
          courseId: created.id,
          message: "¡Tu curso superó la verificación de calidad e IA y ha sido publicado con éxito!",
        };
      }
    }

    // CASO C: Guardado como Borrador (DRAFT) sin publicación
    if (input.id) {
      const existing = await prisma.course.findUnique({
        where: { id: input.id },
      });

      if (!existing || existing.coachId !== user.id) {
        return { success: false, error: "Curso no encontrado o sin permisos de edición." };
      }

      const updated = await prisma.course.update({
        where: { id: input.id },
        data: {
          title,
          summary,
          description: fullDescription,
          priceCents,
          currency,
          estimatedMinutes,
          status: "DRAFT",
          publishedAt: null,
          thumbnailUrl,
          introVideoUrl,
          certificateEnabled,
          categoryId,
        },
      });

      if (input.modules && input.modules.length > 0) {
        await prisma.courseModule.deleteMany({ where: { courseId: input.id } });
        await syncCourseModulesAndLessons(input.id, input.modules);
      }

      await logCourseModerationAudit(user.id, "COURSE_UPDATED", updated.id);

      return { success: true, status: "DRAFT", courseId: updated.id, message: "Curso guardado como borrador correctamente." };
    } else {
      let baseSlug = slugify(title);
      if (!baseSlug) baseSlug = `curso-${Date.now().toString(36)}`;
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

      const created = await prisma.course.create({
        data: {
          coachId: user.id,
          title,
          slug,
          summary,
          description: fullDescription,
          priceCents,
          currency,
          estimatedMinutes,
          status: "DRAFT",
          publishedAt: null,
          thumbnailUrl,
          introVideoUrl,
          certificateEnabled,
          categoryId,
        },
      });

      if (input.modules && input.modules.length > 0) {
        await syncCourseModulesAndLessons(created.id, input.modules);
      }

      await logCourseModerationAudit(user.id, "COURSE_CREATED", created.id);

      return { success: true, status: "DRAFT", courseId: created.id, message: "Borrador de curso creado exitosamente." };
    }
  } catch (error: any) {
    console.error("Error al guardar curso:", error);
    return { success: false, error: error?.message || "Ocurrió un error al guardar el curso." };
  }
}

function calculateBusinessDays(startDate: Date, days: number): Date {
  let count = 0;
  const cur = new Date(startDate);
  while (count < days) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay(); // 0 = Domingo, 6 = Sábado
    if (day !== 0 && day !== 6) {
      count++;
    }
  }
  cur.setHours(23, 59, 59, 999);
  return cur;
}

export async function cancelCoachCourseDeletion(courseId: string) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autorizado." };
    }

    const existing = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        enrollments: {
          select: { studentId: true },
        },
      },
    });

    if (!existing || existing.coachId !== user.id) {
      return { success: false, error: "Curso no encontrado." };
    }

    const cleanDesc = existing.description.replace(/\[CFH_SCHEDULED_DELETION:[\s\S]*?\]/g, "").trim();

    await prisma.course.update({
      where: { id: courseId },
      data: {
        status: "PUBLISHED",
        description: cleanDesc,
      },
    });

    // Notificar a los alumnos inscritos que la baja fue cancelada
    for (const enrollment of existing.enrollments) {
      try {
        await prisma.notification.create({
          data: {
            userId: enrollment.studentId,
            type: "SYSTEM",
            title: `✅ Baja cancelada: "${existing.title}" continúa activo`,
            body: `El coach ha cancelado la solicitud de baja de "${existing.title}". El curso continúa disponible con normalidad en tu biblioteca.`,
            link: `/cursos/${existing.id}`,
          },
        });
      } catch (notifErr) {}
    }

    await logCourseModerationAudit(user.id, "COURSE_DELETION_CANCELED", courseId);

    return {
      success: true,
      message: "Se ha cancelado la baja programada. El curso vuelve a estar activo y tus alumnos fueron notificados.",
    };
  } catch (error: any) {
    console.error("Error al cancelar baja de curso:", error);
    return { success: false, error: error?.message || "Error al cancelar la baja." };
  }
}

export async function toggleCourseMaintenanceMode(courseId: string, enabled: boolean) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autorizado." };
    }

    const existing = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!existing || existing.coachId !== user.id) {
      return { success: false, error: "Curso no encontrado." };
    }

    let cleanDesc = existing.description.replace(/\[CFH_MAINTENANCE_MODE:true\]/g, "").trim();
    if (enabled) {
      cleanDesc = `${cleanDesc}\n\n[CFH_MAINTENANCE_MODE:true]`;
    }

    await prisma.course.update({
      where: { id: courseId },
      data: { description: cleanDesc },
    });

    await logCourseModerationAudit(user.id, enabled ? "COURSE_MAINTENANCE_ENABLED" : "COURSE_MAINTENANCE_DISABLED", courseId);

    return {
      success: true,
      isUnderMaintenance: enabled,
      message: enabled
        ? "Modo mantenimiento activado. Las nuevas compras están pausadas y los alumnos inscritos verán un aviso de actualización de contenidos."
        : "Modo mantenimiento desactivado. El curso vuelve a operar normalmente.",
    };
  } catch (error: any) {
    console.error("Error cambiando modo mantenimiento:", error);
    return { success: false, error: error?.message || "Error al actualizar modo mantenimiento." };
  }
}

export async function deleteCoachCourse(courseId: string) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autorizado." };
    }

    const existing = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        enrollments: {
          select: { studentId: true },
        },
      },
    });

    if (!existing || existing.coachId !== user.id) {
      return { success: false, error: "Curso no encontrado." };
    }

    // Si NO tiene alumnos inscritos, se elimina de inmediato
    if (existing.enrollments.length === 0) {
      await prisma.course.delete({ where: { id: courseId } });
      await logCourseModerationAudit(user.id, "COURSE_DELETED_IMMEDIATE", courseId);
      return { success: true, isDeleted: true, message: "Curso eliminado correctamente." };
    }

    // Si TIENE alumnos inscritos: política obligatoria de 3 días hábiles
    const scheduledDate = calculateBusinessDays(new Date(), 3);
    const scheduledIso = scheduledDate.toISOString();
    const formattedDate = scheduledDate.toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // 1. Limpiar marcador previo si existía y agregar el nuevo
    const cleanDesc = existing.description.replace(/\[CFH_SCHEDULED_DELETION:[\s\S]*?\]/g, "").trim();
    const updatedDesc = `${cleanDesc}\n\n[CFH_SCHEDULED_DELETION:{"scheduledFor":"${scheduledIso}","requestedAt":"${new Date().toISOString()}"}]`;

    // 2. Despublicar inmediatamente del catálogo para que nadie más lo compre
    await prisma.course.update({
      where: { id: courseId },
      data: {
        status: "ARCHIVED",
        description: updatedDesc,
      },
    });

    // 3. Enviar notificación urgente a todos los alumnos inscritos
    for (const enrollment of existing.enrollments) {
      try {
        await prisma.notification.create({
          data: {
            userId: enrollment.studentId,
            type: "SYSTEM",
            title: `⚠️ Aviso de baja programada: "${existing.title}"`,
            body: `El coach ha programado la baja de este curso para el ${formattedDate} (plazo de 3 días hábiles). El curso ha sido retirado de la tienda para nuevos usuarios. Cuentas con este plazo para concluir tus lecciones y descargar tus materiales antes del cierre definitivo.`,
            link: `/cursos/${existing.id}`,
          },
        });
      } catch (notifErr) {
        console.warn("Error creando notificación para alumno:", notifErr);
      }
    }

    await logCourseModerationAudit(user.id, "COURSE_DELETION_SCHEDULED", courseId);

    return {
      success: true,
      isScheduled: true,
      scheduledFor: scheduledIso,
      formattedDate,
      enrollmentCount: existing.enrollments.length,
      message: `Se ha programado la baja del curso para el ${formattedDate} (3 días hábiles). El curso ya no está a la venta y se ha enviado un aviso a tus ${existing.enrollments.length} alumnos inscritos.`,
    };
  } catch (error: any) {
    console.error("Error al eliminar curso:", error);
    return { success: false, error: error?.message || "Error al procesar la baja del curso." };
  }
}

export interface UserProfileCourseItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  thumbnailUrl: string | null;
  priceCents: number;
  currency: string;
  status: CourseStatus;
  estimatedMinutes: number;
  enrollmentCount: number;
  averageRating: number;
  modulesCount: number;
  lessonsCount: number;
  categoryName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileStudentCourseItem {
  enrollmentId: string;
  courseId: string;
  title: string;
  slug: string;
  summary: string;
  thumbnailUrl: string | null;
  status: "PENDING_PAYMENT" | "ACTIVE" | "COMPLETED" | "WITHDRAWN" | "REFUNDED";
  coachName: string;
  coachAvatarUrl: string | null;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
  enrolledAt: string | null;
  completedAt: string | null;
  certificateCode: string | null;
}

export interface UserProfileStudentCertificateItem {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  thumbnailUrl: string | null;
  coachName: string;
  coachAvatarUrl: string | null;
  completedAt: string;
  certificateCode: string;
  pdfDownloadUrl: string;
}

export interface UserProfileCoachCertificateItem {
  id: string;
  title: string;
  fileUrl: string;
  fileType: string;
  fileName: string;
  fileSize: number | null;
  issuedBy: string | null;
  createdAt: string;
}

export interface UserProfileCoursesAndCertificatesResponse {
  success: boolean;
  error?: string;
  isCoach: boolean;
  effectiveRole: "COACH" | "STUDENT" | string;
  coachCourses: UserProfileCourseItem[];
  studentCourses: UserProfileStudentCourseItem[];
  studentCertificates: UserProfileStudentCertificateItem[];
  coachCertificates: UserProfileCoachCertificateItem[];
}

export async function getUserProfileCoursesAndCertificates(): Promise<UserProfileCoursesAndCertificatesResponse> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return {
        success: false,
        error: "No autenticado",
        isCoach: false,
        effectiveRole: "STUDENT",
        coachCourses: [],
        studentCourses: [],
        studentCertificates: [],
        coachCertificates: [],
      };
    }

    const cookieStore = await cookies();
    const activeRoleCookie = cookieStore.get("cfh_active_role")?.value;
    const effectiveRole =
      activeRoleCookie === "COACH" || activeRoleCookie === "STUDENT"
        ? activeRoleCookie
        : user.role;
    const isCoach = effectiveRole === "COACH";

    // Consultas en paralelo para optimizar la carga
    const [rawCoachCourses, rawEnrollments, rawCoachCertificates] = await Promise.all([
      // 1. Cursos impartidos por el usuario (si es o fue coach)
      prisma.course.findMany({
        where: { coachId: user.id },
        include: {
          category: { select: { name: true } },
          modules: {
            include: {
              lessons: { select: { id: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),

      // 2. Cursos en los que está inscrito el usuario como estudiante
      prisma.enrollment.findMany({
        where: { studentId: user.id },
        include: {
          course: {
            include: {
              coach: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              },
              modules: {
                include: {
                  lessons: { select: { id: true } },
                },
              },
            },
          },
          progress: {
            select: {
              lessonId: true,
              completedAt: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),

      // 3. Certificaciones profesionales del perfil de coach
      prisma.coachCertificate.findMany({
        where: {
          coachProfile: {
            userId: user.id,
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Mapear cursos creados por el coach
    const coachCourses: UserProfileCourseItem[] = rawCoachCourses.map((c) => {
      const lessonsCount = c.modules.reduce((acc, m) => acc + m.lessons.length, 0);
      return {
        id: c.id,
        title: c.title,
        slug: c.slug,
        summary: c.summary,
        thumbnailUrl: c.thumbnailUrl,
        priceCents: c.priceCents,
        currency: c.currency,
        status: c.status,
        enrollmentCount: c.enrollmentCount,
        averageRating: c.averageRating,
        estimatedMinutes: (c as any).estimatedMinutes ?? 60,
        modulesCount: c.modules.length,
        lessonsCount,
        categoryName: c.category?.name || null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    });

    // Procesar inscripciones del estudiante y certificados
    const studentCourses: UserProfileStudentCourseItem[] = [];
    const studentCertificates: UserProfileStudentCertificateItem[] = [];

    for (const enrollment of rawEnrollments) {
      const course = enrollment.course;
      const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
      const completedLessons = enrollment.progress.filter((p) => p.completedAt !== null).length;

      let progressPercent = 0;
      if (enrollment.status === "COMPLETED") {
        progressPercent = 100;
      } else if (totalLessons > 0) {
        progressPercent = Math.min(99, Math.round((completedLessons / totalLessons) * 100));
      }

      // Si el curso está completado pero no tiene código de certificado, generar uno
      let certificateCode = enrollment.certificateCode;
      if (enrollment.status === "COMPLETED" && !certificateCode) {
        certificateCode = `CFH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
        // Actualizar en base de datos de manera resiliente
        prisma.enrollment
          .update({
            where: { id: enrollment.id },
            data: { certificateCode },
          })
          .catch((err) => console.error("Error auto-generando certificateCode:", err));
      }

      studentCourses.push({
        enrollmentId: enrollment.id,
        courseId: course.id,
        title: course.title,
        slug: course.slug,
        summary: course.summary,
        thumbnailUrl: course.thumbnailUrl,
        status: enrollment.status,
        coachName: course.coach?.name || "Coach CFH",
        coachAvatarUrl: course.coach?.avatarUrl || null,
        progressPercent,
        completedLessons,
        totalLessons,
        enrolledAt: enrollment.enrolledAt ? enrollment.enrolledAt.toISOString() : null,
        completedAt: enrollment.completedAt ? enrollment.completedAt.toISOString() : null,
        certificateCode,
      });

      // Si completó el curso o tiene certificateCode, agregar a los certificados de estudiante
      if (enrollment.status === "COMPLETED" && certificateCode) {
        studentCertificates.push({
          enrollmentId: enrollment.id,
          courseId: course.id,
          courseTitle: course.title,
          courseSlug: course.slug,
          thumbnailUrl: course.thumbnailUrl,
          coachName: course.coach?.name || "Coach CFH",
          coachAvatarUrl: course.coach?.avatarUrl || null,
          completedAt: (enrollment.completedAt || enrollment.updatedAt).toISOString(),
          certificateCode,
          pdfDownloadUrl: `/api/courses/${course.id}/certificate`,
        });
      }
    }

    // Mapear certificados profesionales de coach
    const coachCertificates: UserProfileCoachCertificateItem[] = rawCoachCertificates.map((cert) => ({
      id: cert.id,
      title: cert.title,
      fileUrl: cert.fileUrl,
      fileType: cert.fileType,
      fileName: cert.fileName,
      fileSize: cert.fileSize,
      issuedBy: cert.issuedBy,
      createdAt: cert.createdAt.toISOString(),
    }));

    return {
      success: true,
      isCoach,
      effectiveRole,
      coachCourses,
      studentCourses,
      studentCertificates,
      coachCertificates,
    };
  } catch (error: any) {
    console.error("[getUserProfileCoursesAndCertificates] Error:", error);
    return {
      success: false,
      error: error?.message || "Error al obtener cursos y certificados del perfil",
      isCoach: false,
      effectiveRole: "STUDENT",
      coachCourses: [],
      studentCourses: [],
      studentCertificates: [],
      coachCertificates: [],
    };
  }
}