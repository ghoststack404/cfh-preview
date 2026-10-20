"use server";

import { getAuthenticatedUser } from "@/app/actions/onboarding";
import { prisma } from "@/lib/db";
import { sendMailSafely } from "@/lib/mail";
import { env } from "@/lib/env";
import { refreshCoachReputation } from "@/lib/coach";
import { revalidatePath } from "next/cache";

function parseLocalDate(dateInput: string | Date): { year: number; month: number; day: number; weekday: number } {
  if (dateInput instanceof Date) {
    return {
      year: dateInput.getFullYear(),
      month: dateInput.getMonth(),
      day: dateInput.getDate(),
      weekday: dateInput.getDay(),
    };
  }
  const cleanStr = (dateInput || "").trim();
  const datePart = cleanStr.includes("T") ? cleanStr.split("T")[0] : cleanStr;
  const parts = datePart ? datePart.split("-") : [];
  if (parts.length === 3) {
    const year = parseInt(parts[0]!, 10);
    const month = parseInt(parts[1]!, 10) - 1;
    const day = parseInt(parts[2]!, 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const noon = new Date(year, month, day, 12, 0, 0);
      return {
        year,
        month,
        day,
        weekday: noon.getDay(),
      };
    }
  }
  const d = new Date(dateInput);
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
    weekday: d.getDay(),
  };
}

export async function getAvailableSlots(coachId: string, dateStr: string, isFreeIntro: boolean = false) {
  try {
    const { year, month, day, weekday } = parseLocalDate(dateStr);
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return { success: false, error: "Fecha inválida" };
    }

    // 1. Get coach profile and their availability rules
    const profile = await prisma.coachProfile.findFirst({
      where: {
        OR: [
          { id: coachId },
          { userId: coachId },
          { slug: coachId }
        ]
      },
      include: {
        availabilityRules: true
      }
    });

    if (!profile) {
      return { success: false, error: "Coach no encontrado" };
    }

    // 2. Comprobar si la fecha seleccionada ya pasó completamente
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const selectedDay = new Date(year, month, day, 0, 0, 0, 0);

    if (selectedDay.getTime() < todayStart.getTime()) {
      return { success: true, slots: [] };
    }

    // 3. Validaciones para Prueba Gratuita
    if (isFreeIntro) {
      if (profile.freeIntroEnabled === false) {
        return { success: true, slots: [] };
      }

      let freeIntroMeta: any = {};
      if (profile.rejectionReason) {
        try {
          freeIntroMeta = JSON.parse(profile.rejectionReason);
        } catch {}
      }

      const allowedWeekdays: number[] | null = Array.isArray(freeIntroMeta.freeIntroWeekdays)
        ? freeIntroMeta.freeIntroWeekdays
        : (freeIntroMeta.freeIntroWeekday !== null && freeIntroMeta.freeIntroWeekday !== undefined ? [freeIntroMeta.freeIntroWeekday] : null);

      if (allowedWeekdays !== null && !allowedWeekdays.includes(weekday)) {
        // En este día el coach no ofrece llamadas de prueba gratuita
        return { success: true, slots: [] };
      }
    }

    // 4. Reglas de disponibilidad del coach para este día
    let effectiveRules = profile.availabilityRules.filter(r => r.weekday === weekday && r.isActive);

    // Fallback estándar: Si el coach aún no ha definido reglas personalizadas, proveer horario habitual de lunes a viernes (09:00 a 18:00)
    if (profile.availabilityRules.length === 0 && weekday >= 1 && weekday <= 5) {
      effectiveRules = [{
        id: `default-${profile.id}-${weekday}`,
        coachProfileId: profile.id,
        weekday,
        startMinute: 540,  // 09:00 AM
        endMinute: 1080,   // 06:00 PM
        isActive: true,
        createdAt: new Date(),
      } as any];
    }

    if (effectiveRules.length === 0) {
      return { success: true, slots: [] };
    }

    const slotDuration = isFreeIntro ? (profile.freeIntroMinutes || 15) : 60;

    // 5. Generar franjas horarias candidatas basadas en las horas de trabajo reales del coach
    interface CandidateSlot {
      startAt: Date;
      endAt: Date;
      displayStr: string;
    }
    const candidateSlots: CandidateSlot[] = [];

    effectiveRules.forEach(rule => {
      for (let m = rule.startMinute; m + slotDuration <= rule.endMinute; m += slotDuration) {
        const hours = Math.floor(m / 60);
        const minutes = m % 60;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 === 0 ? 12 : hours % 12;
        const displayMinutes = minutes.toString().padStart(2, '0');
        const displayStr = `${displayHours.toString().padStart(2, '0')}:${displayMinutes} ${ampm}`;

        const slotStart = new Date(year, month, day, hours, minutes, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000);

        candidateSlots.push({
          startAt: slotStart,
          endAt: slotEnd,
          displayStr,
        });
      }
    });

    // 6. Consultar reservas activas del coach para todo el día
    const dayStartQuery = new Date(year, month, day, 0, 0, 0, 0);
    const dayEndQuery = new Date(year, month, day, 23, 59, 59, 999);

    const existingBookings = await prisma.booking.findMany({
      where: {
        coachId: profile.userId,
        status: {
          not: "CANCELED"
        },
        startAt: { lte: dayEndQuery },
        endAt: { gte: dayStartQuery },
      }
    });

    // 7. Filtrado matemático de colisiones / solapamiento entre sesiones (15m y 60m)
    const isToday = selectedDay.getTime() === todayStart.getTime();
    const nowTime = now.getTime();

    const availableSlots = candidateSlots.filter(candidate => {
      // Si la fecha es hoy, descartar horarios pasados
      if (isToday && candidate.startAt.getTime() <= nowTime) {
        return false;
      }

      // Descartar si se solapa con CUALQUIER reserva activa existente:
      // slotStart < booking.endAt && slotEnd > booking.startAt
      const hasCollision = existingBookings.some(b => {
        const bStart = b.startAt.getTime();
        const bEnd = b.endAt.getTime();
        const cStart = candidate.startAt.getTime();
        const cEnd = candidate.endAt.getTime();
        return cStart < bEnd && cEnd > bStart;
      });

      return !hasCollision;
    });

    return {
      success: true,
      slots: availableSlots.map(s => s.displayStr)
    };
  } catch (error: any) {
    console.error("Error en getAvailableSlots:", error);
    return { success: false, error: "Error al obtener disponibilidad" };
  }
}

export interface CreateBookingWithLockInput {
  studentId: string;
  coachId: string;
  startAt: Date;
  endAt: Date;
  notes?: string | null;
  isFreeIntro?: boolean;
  priceCents?: number;
  platformFeeCents?: number;
  currency?: string;
  status?: "REQUESTED" | "CONFIRMED" | "PENDING_PAYMENT";
  videoRoomName?: string;
}

export async function createBookingWithLock(data: CreateBookingWithLockInput) {
  const lockKey = `booking_lock_${data.coachId}_${data.startAt.getTime()}`;
  try {
    return await prisma.$transaction(
      async (tx) => {
        // 1. Transaction-level locking: Acquire MySQL advisory lock or row-level lock
        try {
          await tx.$executeRaw`SELECT GET_LOCK(${lockKey}, 10)`;
        } catch {}
        try {
          await tx.$executeRaw`SELECT id FROM CoachProfile WHERE userId = ${data.coachId} FOR UPDATE`;
        } catch {}

        // 2. Strict collision checking inside transaction under lock
        const [coachCollisionTx, studentCollisionTx] = await Promise.all([
          tx.booking.findFirst({
            where: {
              coachId: data.coachId,
              status: { notIn: ["CANCELED", "REFUNDED", "NO_SHOW"] },
              startAt: { lt: data.endAt },
              endAt: { gt: data.startAt },
            },
            select: { id: true },
          }),
          tx.booking.findFirst({
            where: {
              studentId: data.studentId,
              status: { notIn: ["CANCELED", "REFUNDED", "NO_SHOW"] },
              startAt: { lt: data.endAt },
              endAt: { gt: data.startAt },
            },
            select: { id: true },
          }),
        ]);

        if (coachCollisionTx) {
          const err = new Error("Este horario ya fue reservado por otro usuario.");
          (err as any).code = "SLOT_CONFLICT";
          (err as any).status = 409;
          throw err;
        }

        if (studentCollisionTx) {
          const err = new Error("Ya tienes otra sesión en ese horario.");
          (err as any).code = "SLOT_CONFLICT";
          (err as any).status = 409;
          throw err;
        }

        const videoRoomName = data.videoRoomName || `cfh-${crypto.randomUUID()}`;

        // 3. Atomically create the booking
        const created = await tx.booking.create({
          data: {
            studentId: data.studentId,
            coachId: data.coachId,
            startAt: data.startAt,
            endAt: data.endAt,
            notes: data.notes || null,
            isFreeIntro: data.isFreeIntro ?? false,
            priceCents: data.priceCents ?? 0,
            platformFeeCents: data.platformFeeCents ?? 0,
            currency: data.currency || "USD",
            status: data.status || "REQUESTED",
            videoRoomName,
          },
        });

        // Create or find conversation between student and coach
        const existingConv = await tx.conversation.findFirst({
          where: {
            studentId: data.studentId,
            coachId: data.coachId,
          },
        });
        if (!existingConv) {
          await tx.conversation.create({
            data: {
              studentId: data.studentId,
              coachId: data.coachId,
              bookingId: created.id,
            },
          });
        }

        return created;
      },
      {
        timeout: 15000,
        maxWait: 5000,
      }
    );
  } catch (err: any) {
    if (
      err?.code === "P2002" ||
      err?.code === "SLOT_CONFLICT" ||
      err?.status === 409 ||
      err?.message?.includes("SLOT_CONFLICT") ||
      err?.message?.includes("ya fue reservado")
    ) {
      const conflictError = new Error("Este horario ya fue reservado por otro usuario.");
      (conflictError as any).code = "SLOT_CONFLICT";
      (conflictError as any).status = 409;
      throw conflictError;
    }
    throw err;
  } finally {
    try {
      await prisma.$executeRaw`SELECT RELEASE_LOCK(${lockKey})`;
    } catch {}
  }
}

export async function createBooking(coachId: string, dateStr: string, timeStr: string, notes: string, isFreeIntro?: boolean) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "Debes iniciar sesión para agendar." };
    }
    // Parse timeStr like "09:00 AM" to actual date
    const [time, modifier] = timeStr.split(' ');
    if (!time) return { success: false, error: "Formato de hora inválido" };
    
    let parts = time.split(':').map(Number);
    let hours = parts[0] || 0;
    let minutes = parts[1] || 0;
    
    if (hours === 12) hours = 0;
    if (modifier === 'PM') hours += 12;

    const { year, month, day } = parseLocalDate(dateStr);
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return { success: false, error: "Fecha inválida" };
    }

    const startAt = new Date(year, month, day, hours, minutes, 0, 0);

    // Evitar reservar en el pasado
    if (startAt.getTime() <= Date.now()) {
      return { success: false, error: "El horario seleccionado ya ha pasado. Por favor elige una hora futura." };
    }

    // Get coach to know their userId and user details
    const profile = await prisma.coachProfile.findFirst({
      where: {
        OR: [
          { id: coachId },
          { userId: coachId },
          { slug: coachId }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        }
      }
    });

    if (!profile) {
      return { success: false, error: "Coach no encontrado" };
    }

    const sessionIsFreeIntro = isFreeIntro !== undefined ? isFreeIntro : (profile.freeIntroEnabled ?? false);
    const durationMinutes = sessionIsFreeIntro ? (profile.freeIntroMinutes || 15) : 60;

    // Verificar si es prueba gratuita y si el alumno ya la utilizó con este coach
    if (sessionIsFreeIntro) {
      const priorFreeIntro = await prisma.booking.findFirst({
        where: {
          studentId: user.id,
          coachId: profile.userId,
          isFreeIntro: true,
          status: {
            not: "CANCELED"
          }
        }
      });

      if (priorFreeIntro) {
        return {
          success: false,
          error: "Ya has disfrutado de tu sesión de prueba gratuita de 15 minutos con este coach. Por favor selecciona una sesión regular de 60 minutos."
        };
      }
    }

    const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

    // Fast check before transaction (more strict than origin/dev)
    const fastCheck = await prisma.booking.findFirst({
      where: {
        coachId: profile.userId,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        status: { notIn: ["CANCELED", "REFUNDED", "NO_SHOW"] },
      },
      select: { id: true },
    });

    if (fastCheck) {
      return {
        success: false,
        error: "Este horario ya fue reservado por otro usuario.",
        code: "SLOT_CONFLICT",
      };
    }

    // Atomic creation under transactional lock
    let booking;
    try {
      booking = await createBookingWithLock({
        studentId: user.id,
        coachId: profile.userId,
        startAt,
        endAt,
        notes,
        isFreeIntro: sessionIsFreeIntro,
        priceCents: sessionIsFreeIntro ? 0 : (profile.hourlyRateCents ?? 0),
        currency: profile.currency || "USD",
        status: "REQUESTED",
      });
    } catch (lockError: any) {
      if (
        lockError?.code === "SLOT_CONFLICT" ||
        lockError?.code === "P2002" ||
        lockError?.status === 409 ||
        lockError?.message?.includes("SLOT_CONFLICT") ||
        lockError?.message?.includes("ya fue reservado")
      ) {
        return {
          success: false,
          error: "Este horario ya fue reservado por otro usuario.",
          code: "SLOT_CONFLICT",
        };
      }
      throw lockError;
    }

    // Create notifications for coach and student
    try {
      const formattedDate = startAt.toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });

      const coachAgendaLink = `/coach/dashboard#booking-${booking.id}`;

      await prisma.notification.createMany({
        data: [
          {
            userId: profile.userId,
            type: "BOOKING",
            title: "🔴 Solicitud de Cita Pendiente (Importante)",
            body: `${user.name || "Un aprendiz"} ha solicitado una sesión para el ${formattedDate} a las ${timeStr}. Por favor confirma la cita en tu agenda antes de la hora programada.`,
            link: coachAgendaLink
          },
          {
            userId: user.id,
            type: "BOOKING",
            title: "Sesión agendada",
            body: `Tu solicitud de sesión con ${profile.user?.name || profile.headline || "tu coach"} para el ${formattedDate} ha sido registrada.`,
            link: "/dashboard#agenda"
          }
        ]
      });

      // Enviar correo al Coach con enlace directo para revisar y aceptar/rechazar
      if (profile.user?.email) {
        const appUrl = env().APP_URL || "http://localhost:3000";
        const directReviewUrl = `${appUrl}${coachAgendaLink}`;

        await sendMailSafely({
          to: profile.user.email,
          subject: `Nueva solicitud de cita de ${user.name || "un aprendiz"} - Coaching From Home`,
          text: `Hola ${profile.user.name || "Coach"},\n\n${user.name || "Un aprendiz"} ha solicitado una sesión contigo para el ${formattedDate} a las ${timeStr}.\n\nPara revisar los detalles y ACEPTAR o RECHAZAR la cita, entra al siguiente enlace:\n${directReviewUrl}\n\nSi no has iniciado sesión, se te pedirá ingresar tus credenciales y te llevará directo a tu agenda de sesiones.\n\nAtentamente,\nEquipo de Coaching From Home`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded: 16px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h2 style="color: #061528; margin: 0;">Coaching<span style="color: #10b981;">FromHome</span></h2>
                <p style="color: #10b981; font-weight: bold; font-size: 15px; margin-top: 4px;">Nueva Solicitud de Sesión de 60 min</p>
              </div>
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #edf2f7;">
                <p style="margin: 0 0 12px; color: #1e293b; font-size: 15px;"><strong>¡Hola, ${profile.user.name || "Coach"}!</strong></p>
                <p style="margin: 0 0 8px; color: #475569; font-size: 14px;"><strong>${user.name || "Un aprendiz"}</strong> ha solicitado agendar una sesión contigo.</p>
                <p style="margin: 0 0 8px; color: #475569; font-size: 14px;"><strong>Fecha y Hora:</strong> ${formattedDate} a las ${timeStr}</p>
                ${notes ? `<p style="margin: 0 0 8px; color: #475569; font-size: 14px;"><strong>Tema / Consulta:</strong> "${notes}"</p>` : ""}
                <p style="margin: 0; color: #475569; font-size: 14px;"><strong>Tipo de Sesión:</strong> ${sessionIsFreeIntro ? "Llamada de Prueba Gratuita (15 min)" : "Clase Regular (60 min)"}</p>
              </div>
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${directReviewUrl}" style="background-color: #061528; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block;">
                  Revisar Cita (Aceptar o Rechazar)
                </a>
              </div>
              <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                Si aún no has iniciado sesión en este dispositivo, podrás iniciarla y serás dirigido a tu agenda.
              </p>
            </div>
          `
        }, "correo de nueva solicitud al coach");
      }
    } catch (notifErr) {
      console.error("No se pudieron crear las notificaciones o enviar correo:", notifErr);
    }

    revalidatePath(`/coaches/${coachId}`);
    revalidatePath("/dashboard");
    revalidatePath("/coach/dashboard");
    return { success: true, bookingId: booking.id };
  } catch (error: any) {
    console.error("Error en createBooking:", error);
    if (
      error?.code === "SLOT_CONFLICT" ||
      error?.code === "P2002" ||
      error?.status === 409 ||
      error?.message?.includes("SLOT_CONFLICT") ||
      error?.message?.includes("ya fue reservado")
    ) {
      return {
        success: false,
        error: "Este horario ya fue reservado por otro usuario.",
        code: "SLOT_CONFLICT",
      };
    }
    return { success: false, error: "Error interno al agendar la sesión" };
  }
}

export async function getStudentBookings() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autenticado", bookings: [], pastBookings: [] };
    }

    const allBookings = await prisma.booking.findMany({
      where: {
        studentId: user.id,
      },
      include: {
        coach: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            coachProfile: {
              select: {
                id: true,
                headline: true,
                slug: true
              }
            }
          }
        },
        review: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        startAt: "desc"
      }
    });

    const now = new Date();
    const nowMs = now.getTime();

    // Auto-cancelar en DB y liberar fondos de cualquier solicitud que lleve más de 48 horas sin respuesta del Coach
    const expired48h = allBookings.filter(
      (b) => b.status === "REQUESTED" && (nowMs - new Date(b.createdAt).getTime()) >= 48 * 3600 * 1000
    );
    if (expired48h.length > 0) {
      try {
        const { stripe } = await import("@/lib/payments");
        for (const b of expired48h) {
          if (b.stripePaymentIntentId) {
            try {
              const pi = await stripe().paymentIntents.retrieve(b.stripePaymentIntentId);
              if (pi.status === "requires_capture") {
                await stripe().paymentIntents.cancel(b.stripePaymentIntentId);
              }
            } catch {}
          }
          await prisma.booking.update({
            where: { id: b.id },
            data: { status: "CANCELED", canceledAt: now }
          });
          b.status = "CANCELED";
        }
      } catch (err) {
        console.warn("Error cancelando reservas expiradas de 48h:", err);
      }
    }

    // Auto-completar en DB cualquier sesión que esté en IN_PROGRESS pero cuya fecha endAt ya haya pasado
    const expiredInProgress = allBookings.filter(
      (b) => b.status === "IN_PROGRESS" && b.endAt && new Date(b.endAt).getTime() <= nowMs
    );
    if (expiredInProgress.length > 0) {
      prisma.booking.updateMany({
        where: {
          id: { in: expiredInProgress.map((b) => b.id) },
          status: "IN_PROGRESS"
        },
        data: {
          status: "COMPLETED",
          completedAt: now
        }
      }).catch((err) => console.error("Error auto-completing expired bookings:", err));
    }

    const activeBookings = allBookings
      .filter((b) => b.status !== "COMPLETED" && !b.completedAt && b.status !== "CANCELED" && new Date(b.endAt).getTime() > nowMs)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    const pastBookings = allBookings
      .filter((b) => b.status === "COMPLETED" || !!b.completedAt || new Date(b.endAt).getTime() <= nowMs || b.status === "CANCELED")
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

    const formatBooking = (b: (typeof allBookings)[0]) => {
      const isPastOrExpired = !!b.completedAt || b.status === "COMPLETED" || new Date(b.endAt).getTime() <= nowMs;
      const displayStatus = isPastOrExpired ? (b.status === "CANCELED" ? "CANCELED" : "COMPLETED") : b.status;
      return {
        id: b.id,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        status: displayStatus,
        completedAt: b.completedAt ? b.completedAt.toISOString() : (isPastOrExpired && b.status !== "CANCELED" ? b.endAt.toISOString() : null),
        notes: b.notes,
        isFreeIntro: b.isFreeIntro,
        priceCents: b.priceCents,
        videoRoomName: b.videoRoomName,
        review: b.review ? {
          id: b.review.id,
          rating: b.review.rating,
          comment: b.review.comment,
          createdAt: b.review.createdAt.toISOString()
        } : null,
        coach: {
          id: b.coach.id,
          name: b.coach.name,
          avatarUrl: b.coach.avatarUrl,
          headline: b.coach.coachProfile?.headline || "Coach",
          profileId: b.coach.coachProfile?.id || b.coach.id,
          slug: b.coach.coachProfile?.slug || b.coach.coachProfile?.id || b.coach.id,
        }
      };
    };

    return {
      success: true,
      bookings: activeBookings.map(formatBooking),
      pastBookings: pastBookings.map(formatBooking)
    };
  } catch (error) {
    console.error("Error en getStudentBookings:", error);
    return { success: false, error: "Error al obtener las reservas", bookings: [], pastBookings: [] };
  }
}

export async function getBookingById(bookingId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        coach: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            coachProfile: {
              select: {
                headline: true,
                currentTier: true,
                level: true,
                timezone: true,
                freeIntroMinutes: true,
              }
            }
          }
        },
        student: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          }
        }
      }
    });

    if (!booking) {
      return { success: false, error: "Reserva no encontrada" };
    }

    const nowMs = Date.now();
    const isExpired = booking.endAt && booking.endAt.getTime() <= nowMs;
    const isCompleted = booking.status === "COMPLETED" || !!booking.completedAt || (isExpired && booking.status === "IN_PROGRESS");

    if (isExpired && booking.status === "IN_PROGRESS") {
      prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "COMPLETED",
          completedAt: new Date()
        }
      }).catch((err) => console.error("Error auto-completing booking in getBookingById:", err));
    }

    return {
      success: true,
      booking: {
        id: booking.id,
        startAt: booking.startAt.toISOString(),
        endAt: booking.endAt.toISOString(),
        status: isCompleted ? "COMPLETED" : booking.status,
        completedAt: booking.completedAt ? booking.completedAt.toISOString() : (isCompleted ? booking.endAt.toISOString() : null),
        notes: booking.notes,
        isFreeIntro: booking.isFreeIntro,
        durationMinutes: booking.isFreeIntro ? (booking.coach.coachProfile?.freeIntroMinutes || 15) : 60,
        videoRoomName: booking.videoRoomName,
        coach: {
          id: booking.coach.id,
          name: booking.coach.name,
          avatarUrl: booking.coach.avatarUrl,
          headline: booking.coach.coachProfile?.headline || "Coach",
          tier: booking.coach.coachProfile?.currentTier || "ELITE",
        },
        student: {
          id: booking.student.id,
          name: booking.student.name,
          avatarUrl: booking.student.avatarUrl,
        }
      }
    };
  } catch (error) {
    console.error("Error en getBookingById:", error);
    return { success: false, error: "Error al consultar la sesión" };
  }
}

export async function getCoachBookings() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autenticado", bookings: [] };
    }

    const bookings = await prisma.booking.findMany({
      where: {
        coachId: user.id,
        status: { notIn: ["CANCELED", "COMPLETED"] }
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        }
      },
      orderBy: {
        startAt: "asc"
      }
    });

    const nowMs = Date.now();

    // Auto-completar expiradas
    const expiredBookings = bookings.filter(b => b.status === "IN_PROGRESS" && b.endAt && b.endAt.getTime() <= nowMs);
    if (expiredBookings.length > 0) {
      prisma.booking.updateMany({
        where: { id: { in: expiredBookings.map(b => b.id) }, status: "IN_PROGRESS" },
        data: { status: "COMPLETED", completedAt: new Date() }
      }).catch((err) => console.error("Error auto-completing coach bookings:", err));
    }

    const activeBookings = bookings.filter(
      (b) => !b.completedAt && b.status !== "COMPLETED" && b.status !== "CANCELED" && new Date(b.endAt).getTime() > nowMs
    );

    return {
      success: true,
      bookings: activeBookings.map((b) => ({
        id: b.id,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        status: b.status,
        completedAt: b.completedAt ? b.completedAt.toISOString() : null,
        notes: b.notes,
        isFreeIntro: b.isFreeIntro,
        priceCents: b.priceCents,
        videoRoomName: b.videoRoomName,
        student: {
          id: b.student.id,
          name: b.student.name || "Aprendiz",
          avatarUrl: b.student.avatarUrl
        }
      }))
    };
  } catch (error) {
    console.error("Error en getCoachBookings:", error);
    return { success: false, error: "Error al obtener las reservas del coach", bookings: [] };
  }
}

export async function respondToBooking(bookingId: string, action: "CONFIRM" | "REJECT", reason?: string) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        coach: {
          select: {
            id: true,
            name: true,
            coachProfile: {
              select: {
                id: true,
                slug: true,
                headline: true,
              }
            }
          }
        },
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    if (!booking) {
      return { success: false, error: "Reserva no encontrada" };
    }

    if (booking.coachId !== user.id) {
      return { success: false, error: "No tienes permiso para responder a esta reserva" };
    }

    const newStatus = action === "CONFIRM" ? "CONFIRMED" : "CANCELED";

    // Si tiene cobro pre-autorizado en Stripe, capturar o cancelar según la decisión del Coach
    if (booking.stripePaymentIntentId) {
      try {
        const { stripe } = await import("@/lib/payments");
        const pi = await stripe().paymentIntents.retrieve(booking.stripePaymentIntentId);
        if (pi.status === "requires_capture") {
          if (action === "CONFIRM") {
            await stripe().paymentIntents.capture(booking.stripePaymentIntentId);
          } else {
            await stripe().paymentIntents.cancel(booking.stripePaymentIntentId);
          }
        }
      } catch (stripeErr: any) {
        console.error("Error procesando captura/cancelación de Stripe al responder reserva:", stripeErr);
      }
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: newStatus,
        canceledAt: action === "REJECT" ? new Date() : null,
      }
    });

    if (action === "CONFIRM") {
      await prisma.conversation.updateMany({
        where: { bookingId: booking.id },
        data: { contactUnlockedAt: new Date() }
      });
    }

    const formattedDate = booking.startAt.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });

    const coachDisplayName = booking.coach.name || booking.coach.coachProfile?.headline || "Tu Coach";
    const coachSlugOrId = booking.coach.coachProfile?.slug || booking.coach.coachProfile?.id || booking.coachId;

    const appUrl = env().APP_URL || "http://localhost:3000";

    if (action === "CONFIRM") {
      await prisma.notification.create({
        data: {
          userId: booking.studentId,
          type: "BOOKING",
          title: "¡Sesión Confirmada! 🎉",
          body: `El coach ${coachDisplayName} ha confirmado tu sesión para el ${formattedDate}. Prepárate para ingresar a la sala.`,
          link: `/sesion/${booking.id}?role=student`
        }
      });

      // Enviar correo al alumno con enlace directo al panel de aprendizaje (Horarios & Agenda)
      if (booking.student?.email) {
        const studentAgendaUrl = `${appUrl}/dashboard#agenda`;
        await sendMailSafely({
          to: booking.student.email,
          subject: `¡Tu sesión con ${coachDisplayName} ha sido confirmada! - Coaching From Home`,
          text: `Hola ${booking.student.name || "Aprendiz"},\n\n¡Excelentes noticias! El coach ${coachDisplayName} ha confirmado tu sesión para el ${formattedDate}.\n\nPuedes ver los detalles y entrar a la sala cuando corresponda en tu panel de aprendizaje:\n${studentAgendaUrl}\n\nSi no tienes tu sesión iniciada en este dispositivo, podrás iniciarla y serás llevado directamente a tu agenda.\n\nAtentamente,\nEquipo de Coaching From Home`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded: 16px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h2 style="color: #061528; margin: 0;">Coaching<span style="color: #10b981;">FromHome</span></h2>
                <p style="color: #10b981; font-weight: bold; font-size: 15px; margin-top: 4px;">¡Sesión de 60 min Confirmada! 🎉</p>
              </div>
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #edf2f7;">
                <p style="margin: 0 0 12px; color: #1e293b; font-size: 15px;"><strong>¡Hola, ${booking.student.name || "Aprendiz"}!</strong></p>
                <p style="margin: 0 0 8px; color: #475569; font-size: 14px;">Tu coach <strong>${coachDisplayName}</strong> ha aceptado tu solicitud de sesión.</p>
                <p style="margin: 0 0 8px; color: #475569; font-size: 14px;"><strong>Fecha y Hora:</strong> ${formattedDate}</p>
              </div>
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${studentAgendaUrl}" style="background-color: #10b981; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block;">
                  Ir a Mi Aprendizaje (Ver Agenda)
                </a>
              </div>
              <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                El botón para ingresar a la sala estará disponible en tu panel a la hora programada.
              </p>
            </div>
          `
        }, "correo de confirmación de sesión al alumno");
      }
    } else {
      const rejectDetails = reason?.trim() ? ` Motivo: "${reason.trim()}"` : "";
      await prisma.notification.create({
        data: {
          userId: booking.studentId,
          type: "BOOKING",
          title: "Sesión no disponible / Rechazada",
          body: `El coach ${coachDisplayName} no podrá atender tu sesión del ${formattedDate}.${rejectDetails} Puedes reagendar en otro horario disponible.`,
          link: `/dashboard#agenda`
        }
      });

      // Enviar correo al alumno informando del rechazo con link a reagendar
      if (booking.student?.email) {
        const rescheduleUrl = `${appUrl}/coaches/${coachSlugOrId}?book=1`;
        await sendMailSafely({
          to: booking.student.email,
          subject: `Actualización sobre tu sesión con ${coachDisplayName} - Coaching From Home`,
          text: `Hola ${booking.student.name || "Aprendiz"},\n\nEl coach ${coachDisplayName} no podrá atender tu solicitud de sesión programada para el ${formattedDate}.${rejectDetails}\n\nPuedes seleccionar un nuevo horario disponible en el siguiente enlace:\n${rescheduleUrl}\n\nAtentamente,\nEquipo de Coaching From Home`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded: 16px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h2 style="color: #061528; margin: 0;">Coaching<span style="color: #10b981;">FromHome</span></h2>
                <p style="color: #e11d48; font-weight: bold; font-size: 15px; margin-top: 4px;">Sesión no disponible</p>
              </div>
              <div style="background-color: #fff1f2; padding: 20px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #ffe4e6;">
                <p style="margin: 0 0 12px; color: #1e293b; font-size: 15px;"><strong>Hola, ${booking.student.name || "Aprendiz"}:</strong></p>
                <p style="margin: 0 0 8px; color: #475569; font-size: 14px;">El coach <strong>${coachDisplayName}</strong> no podrá atender tu sesión del <strong>${formattedDate}</strong>.</p>
                ${reason?.trim() ? `<p style="margin: 0; color: #9f1239; font-size: 14px;"><strong>Motivo indicado:</strong> "${reason.trim()}"</p>` : ""}
              </div>
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${rescheduleUrl}" style="background-color: #061528; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block;">
                  Reagendar en otro horario
                </a>
              </div>
            </div>
          `
        }, "correo de sesión rechazada al alumno");
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/coach/dashboard");
    revalidatePath(`/sesion/${bookingId}`);

    return {
      success: true,
      status: updatedBooking.status
    };
  } catch (error) {
    console.error("Error en respondToBooking:", error);
    return { success: false, error: "Error al actualizar la reserva" };
  }
}

export async function checkFreeIntroEligibility(coachId: string) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { eligible: true, isAuthenticated: false };
    }

    const profile = await prisma.coachProfile.findFirst({
      where: {
        OR: [
          { id: coachId },
          { userId: coachId },
          { slug: coachId }
        ]
      },
      select: { userId: true, freeIntroEnabled: true }
    });

    if (!profile || !profile.freeIntroEnabled) {
      return { eligible: false, isAuthenticated: true, reason: "El coach no tiene activas sesiones de prueba gratuita." };
    }

    const priorFreeIntro = await prisma.booking.findFirst({
      where: {
        studentId: user.id,
        coachId: profile.userId,
        isFreeIntro: true,
        status: {
          not: "CANCELED"
        }
      }
    });

    if (priorFreeIntro) {
      return {
        eligible: false,
        isAuthenticated: true,
        reason: "Ya has utilizado tu sesión de prueba gratuita de 15 minutos con este coach."
      };
    }

    return { eligible: true, isAuthenticated: true };
  } catch (error) {
    console.error("Error en checkFreeIntroEligibility:", error);
    return { eligible: true, isAuthenticated: false };
  }
}

export async function checkCoachDirectMessagingEligibility(coachId: string) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { canMessage: false, isAuthenticated: false, reason: "Inicia sesión para enviar mensajes." };
    }

    if (user.role === "ADMIN") {
      return { canMessage: true, isAuthenticated: true };
    }

    // Resolve coach userId
    let targetCoachUserId = coachId;
    const coachProfile = await prisma.coachProfile.findFirst({
      where: {
        OR: [
          { id: coachId },
          { userId: coachId },
          { slug: coachId }
        ]
      },
      select: { userId: true }
    });

    if (coachProfile) {
      targetCoachUserId = coachProfile.userId;
    }

    // If current user is the coach themselves
    if (user.id === targetCoachUserId) {
      return { canMessage: false, isAuthenticated: true, reason: "No puedes enviarte mensajes a ti mismo." };
    }

    // Check if student has any confirmed/completed paid booking with this coach
    const paidBooking = await prisma.booking.findFirst({
      where: {
        studentId: user.id,
        coachId: targetCoachUserId,
        isFreeIntro: false,
        status: {
          in: ["CONFIRMED", "COMPLETED", "IN_PROGRESS"]
        }
      }
    });

    if (paidBooking) {
      return { canMessage: true, isAuthenticated: true };
    }

    // Check if student is actively enrolled in any course created by this coach
    const courseEnrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: user.id,
        status: {
          in: ["ACTIVE", "COMPLETED"]
        },
        course: {
          coachId: targetCoachUserId
        }
      }
    });

    if (courseEnrollment) {
      return { canMessage: true, isAuthenticated: true };
    }

    return {
      canMessage: false,
      isAuthenticated: true,
      reason: "Para enviar mensajes directos a este coach, debes reservar una clase pagada o adquirir uno de sus cursos."
    };
  } catch (error) {
    console.error("Error en checkCoachDirectMessagingEligibility:", error);
    return { canMessage: false, isAuthenticated: false, reason: "Error al verificar permisos de mensajería." };
  }
}

export async function joinBookingSession(bookingId: string) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        student: { select: { id: true, name: true } },
        coach: {
          select: {
            id: true,
            name: true,
            coachProfile: { select: { freeIntroMinutes: true } }
          }
        },
      }
    });

    if (!booking) {
      return { success: false, error: "Reserva no encontrada" };
    }

    if (booking.studentId !== user.id && booking.coachId !== user.id) {
      return { success: false, error: "No tienes permiso para esta sesión" };
    }

    const nowMs = Date.now();
    const durationMinutes = booking.isFreeIntro ? 15 : 60;

    // Si la sesión ya fue completada o cancelada, NUNCA revivirla ni cambiar estado
    if (booking.status === "COMPLETED" || booking.completedAt || booking.status === "CANCELED") {
      return {
        success: true,
        status: booking.status,
        endAt: booking.endAt ? booking.endAt.toISOString() : new Date().toISOString(),
        durationMinutes,
        isCompleted: true,
      };
    }

    // Si la sesión estaba en progreso pero el tiempo límite ya expiró, marcar como completada
    if (booking.endAt && booking.endAt.getTime() <= nowMs) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      try {
        await refreshCoachReputation(booking.coachId);
      } catch (repErr) {
        console.error("Error al refrescar reputación del coach:", repErr);
      }

      revalidatePath("/dashboard");
      revalidatePath("/coach/dashboard");
      revalidatePath(`/sesion/${bookingId}`);

      return {
        success: true,
        status: "COMPLETED",
        endAt: booking.endAt.toISOString(),
        durationMinutes,
        isCompleted: true,
      };
    }

    let effectiveEndAt = booking.endAt;

    // Solo si la sesión apenas va a iniciar (CONFIRMED) o no tiene endAt asignado:
    const shouldResetEndAt = booking.status === "CONFIRMED" || !booking.endAt;

    if (shouldResetEndAt) {
      effectiveEndAt = new Date(nowMs + durationMinutes * 60 * 1000);
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "IN_PROGRESS",
          endAt: effectiveEndAt,
        },
      });

      const isStudent = user.id === booking.studentId;
      const targetUserId = isStudent ? booking.coachId : booking.studentId;
      const targetRole = isStudent ? "coach" : "student";
      const senderName = user.name || (isStudent ? "Tu aprendiz" : "Tu coach");

      try {
        await prisma.notification.create({
          data: {
            userId: targetUserId,
            type: "BOOKING",
            title: `¡${senderName} ya está en la sala! 📹`,
            body: `${senderName} ha ingresado a la sesión en vivo. Haz clic para unirte ahora.`,
            link: `/sesion/${booking.id}?role=${targetRole}`,
          },
        });
      } catch (notifErr) {
        console.error("Error creating join notification:", notifErr);
      }

      revalidatePath("/dashboard");
      revalidatePath("/coach/dashboard");
      revalidatePath(`/sesion/${bookingId}`);
    }

    return {
      success: true,
      status: "IN_PROGRESS",
      endAt: (effectiveEndAt || new Date()).toISOString(),
      durationMinutes
    };
  } catch (err) {
    console.error("Error en joinBookingSession:", err);
    return { success: false, error: "Error al registrar ingreso a la sesión" };
  }
}

export async function completeBookingSession(bookingId: string) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        coach: {
          select: {
            id: true,
            name: true,
            coachProfile: {
              select: {
                id: true,
                headline: true,
                slug: true
              }
            }
          }
        },
        student: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        review: true
      }
    });

    if (!booking) {
      return { success: false, error: "Reserva no encontrada" };
    }

    if (user.role !== "ADMIN" && booking.studentId !== user.id && booking.coachId !== user.id) {
      return { success: false, error: "No tienes permiso para finalizar esta sesión" };
    }

    if (booking.status === "REQUESTED" || booking.status === "CANCELED") {
      return { success: false, error: "No se puede completar una sesión no confirmada o cancelada" };
    }

    if (booking.status !== "COMPLETED") {
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "COMPLETED",
          completedAt: new Date()
        }
      });

      try {
        await refreshCoachReputation(booking.coachId);
      } catch (repErr) {
        console.error("Error al refrescar reputación del coach:", repErr);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/coach/dashboard");
    revalidatePath(`/sesion/${bookingId}`);

    return {
      success: true,
      hasReview: Boolean(booking.review),
      booking: {
        id: booking.id,
        coachId: booking.coachId,
        coachProfileId: booking.coach.coachProfile?.id || booking.coachId,
        coachSlug: booking.coach.coachProfile?.slug || booking.coach.coachProfile?.id || booking.coachId,
        coachName: booking.coach.name || "Coach",
        studentId: booking.studentId,
        studentName: booking.student.name || "Aprendiz",
        isFreeIntro: booking.isFreeIntro
      }
    };
  } catch (error) {
    console.error("Error en completeBookingSession:", error);
    return { success: false, error: "Error al completar la sesión" };
  }
}

export async function submitBookingReview(bookingId: string, rating: number, comment?: string) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "Debes iniciar sesión para calificar" };
    }

    if (!rating || rating < 1 || rating > 5) {
      return { success: false, error: "La calificación debe ser de 1 a 5 estrellas" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        review: true
      }
    });

    if (!booking) {
      return { success: false, error: "Sesión no encontrada" };
    }

    if (user.role !== "ADMIN" && booking.studentId !== user.id) {
      return { success: false, error: "Solo el alumno de la sesión puede dejar una reseña" };
    }

    if (booking.review) {
      if (comment || rating) {
        await prisma.review.update({
          where: { id: booking.review.id },
          data: {
            rating,
            comment: comment?.trim() || booking.review.comment,
          }
        });
        await refreshCoachReputation(booking.coachId);
      }
      return { success: true, reviewId: booking.review.id };
    }

    if (booking.status !== "COMPLETED") {
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "COMPLETED",
          completedAt: new Date()
        }
      });
    }

    const review = await prisma.review.create({
      data: {
        bookingId: booking.id,
        authorId: user.id,
        coachId: booking.coachId,
        rating,
        comment: comment?.trim() || null,
        isVisible: true
      }
    });

    await refreshCoachReputation(booking.coachId);

    revalidatePath(`/coaches/${booking.coachId}`);
    revalidatePath("/dashboard");

    return { success: true, reviewId: review.id };
  } catch (error) {
    console.error("Error en submitBookingReview:", error);
    return { success: false, error: "Error al registrar la reseña" };
  }
}

