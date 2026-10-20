import { requireUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { calculatePlatformFee, fitsAvailability } from "@/lib/business";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { assertSameOrigin } from "@/lib/security";
import { bookingSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const student = await requireUser(["STUDENT"]);
    const input = bookingSchema.parse(await request.json());
    const startAt = new Date(input.startAt);
    if (startAt.getTime() < Date.now() + 30 * 60_000) {
      return Response.json(
        { error: "Elige un horario con al menos 30 minutos de anticipación." },
        { status: 422 }
      );
    }
    if (startAt.getTime() > Date.now() + 180 * 86_400_000) {
      return Response.json(
        { error: "Solo se puede reservar dentro de los próximos 180 días." },
        { status: 422 }
      );
    }
    const endAt = new Date(startAt.getTime() + input.durationMinutes * 60_000);
    const coach = await prisma.user.findUnique({
      where: { id: input.coachId },
      include: {
        coachProfile: { include: { availabilityRules: true } },
        coachSubscriptions: {
          where: { status: { in: ["ACTIVE", "TRIALING"] } },
          include: { plan: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (
      !coach?.coachProfile ||
      coach.role !== "COACH" ||
      coach.status !== "ACTIVE" ||
      coach.coachProfile.approvalStatus !== "APPROVED"
    ) {
      throw new Error("NOT_FOUND");
    }

    const effectiveRules = coach.coachProfile.availabilityRules.length > 0
      ? coach.coachProfile.availabilityRules
      : [1, 2, 3, 4, 5].map((weekday) => ({
          id: `default-${coach.coachProfile!.id}-${weekday}`,
          coachProfileId: coach.coachProfile!.id,
          weekday,
          startMinute: 540,
          endMinute: 1080,
          isActive: true,
          createdAt: new Date(),
        }));

    if (
      !fitsAvailability({
        startAt,
        endAt,
        timeZone: coach.coachProfile.timezone,
        rules: effectiveRules as any,
      })
    ) {
      return Response.json(
        { error: "La hora elegida está fuera de la disponibilidad del coach." },
        { status: 409 }
      );
    }

    // Fast preliminary check
    const [coachCollision, studentCollision] = await Promise.all([
      prisma.booking.findFirst({
        where: {
          coachId: coach.id,
          status: { notIn: ["CANCELED", "REFUNDED", "NO_SHOW"] },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
        select: { id: true },
      }),
      prisma.booking.findFirst({
        where: {
          studentId: student.id,
          status: { notIn: ["CANCELED", "REFUNDED", "NO_SHOW"] },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
        select: { id: true },
      }),
    ]);

    if (coachCollision) {
      return Response.json(
        {
          error: "Este horario ya fue reservado por otro usuario.",
          code: "SLOT_CONFLICT",
        },
        { status: 409 }
      );
    }
    if (studentCollision) {
      return Response.json(
        {
          error: "Ya tienes otra sesión en ese horario.",
          code: "SLOT_CONFLICT",
        },
        { status: 409 }
      );
    }

    let isFreeIntro = false;
    if (input.durationMinutes === 15) {
      if (!coach.coachProfile.freeIntroEnabled) {
        return Response.json(
          { error: "Este coach no ofrece sesión gratuita." },
          { status: 422 }
        );
      }
      const prior = await prisma.booking.findFirst({
        where: {
          studentId: student.id,
          coachId: coach.id,
          isFreeIntro: true,
          status: { notIn: ["CANCELED", "REFUNDED"] },
        },
        select: { id: true },
      });
      if (prior) {
        return Response.json(
          { error: "La sesión gratuita solo puede usarse una vez con cada coach." },
          { status: 409 }
        );
      }
      isFreeIntro = true;
    }

    const priceCents = isFreeIntro
      ? 0
      : Math.round((coach.coachProfile.hourlyRateCents * input.durationMinutes) / 60);
    const plan = coach.coachSubscriptions[0]?.plan;
    const platformFeeCents = priceCents
      ? calculatePlatformFee(priceCents, coach.region, plan)
      : 0;
    const status = isFreeIntro ? ("CONFIRMED" as const) : ("PENDING_PAYMENT" as const);
    const roomName = `cfh-${crypto.randomUUID()}`;

    // Transactional locking key
    const lockKey = `booking_lock_${coach.id}_${startAt.getTime()}`;
    let booking;

    try {
      booking = await prisma.$transaction(
        async (tx) => {
          // 1. Transaction-level row lock / MySQL advisory lock
          try {
            await tx.$executeRaw`SELECT GET_LOCK(${lockKey}, 10)`;
          } catch {}
          try {
            await tx.$executeRaw`SELECT id FROM CoachProfile WHERE userId = ${coach.id} FOR UPDATE`;
          } catch {}

          // 2. Strict collision checking inside transaction under lock
          const [coachCollisionTx, studentCollisionTx] = await Promise.all([
            tx.booking.findFirst({
              where: {
                coachId: coach.id,
                status: { notIn: ["CANCELED", "REFUNDED", "NO_SHOW"] },
                startAt: { lt: endAt },
                endAt: { gt: startAt },
              },
              select: { id: true },
            }),
            tx.booking.findFirst({
              where: {
                studentId: student.id,
                status: { notIn: ["CANCELED", "REFUNDED", "NO_SHOW"] },
                startAt: { lt: endAt },
                endAt: { gt: startAt },
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

          // 3. Atomically create the booking
          const created = await tx.booking.create({
            data: {
              studentId: student.id,
              coachId: coach.id,
              startAt,
              endAt,
              status,
              isFreeIntro,
              priceCents,
              platformFeeCents,
              currency: coach.coachProfile?.currency ?? "MXN",
              notes: input.notes || null,
              videoRoomName: roomName,
            },
          });

          await tx.conversation.create({
            data: {
              bookingId: created.id,
              studentId: student.id,
              coachId: coach.id,
              contactUnlockedAt: null,
            },
          });

          await tx.notification.createMany({
            data: [
              {
                userId: student.id,
                type: "BOOKING",
                title: "Reserva creada",
                body: `Tu sesión con ${coach.name} quedó registrada.`,
                link: "/dashboard/bookings",
              },
              {
                userId: coach.id,
                type: "BOOKING",
                title: "Nueva reserva",
                body: `${student.name} reservó una sesión.`,
                link: "/dashboard/bookings",
              },
            ],
          });

          return created;
        },
        {
          timeout: 15000,
          maxWait: 5000,
        }
      );
    } catch (dbError: any) {
      if (
        dbError.code === "P2002" ||
        dbError.code === "SLOT_CONFLICT" ||
        dbError.status === 409 ||
        dbError.message?.includes("SLOT_CONFLICT") ||
        dbError.message?.includes("ya fue reservado")
      ) {
        return Response.json(
          {
            error: "Este horario ya fue reservado por otro usuario.",
            code: "SLOT_CONFLICT",
          },
          { status: 409 }
        );
      }
      throw dbError;
    } finally {
      try {
        await prisma.$executeRaw`SELECT RELEASE_LOCK(${lockKey})`;
      } catch {}
    }

    await audit({
      actorId: student.id,
      action: "BOOKING_CREATED",
      entityType: "Booking",
      entityId: booking.id,
      metadata: { isFreeIntro, priceCents },
    });

    await Promise.all([
      sendMail({
        to: student.email,
        subject: "Tu reserva en Coaching From Home",
        text: `Tu sesión con ${coach.name} está ${isFreeIntro ? "confirmada" : "pendiente de pago"}.`,
      }),
      sendMail({
        to: coach.email,
        subject: "Nueva reserva",
        text: `${student.name} reservó una sesión para ${startAt.toISOString()}.`,
      }),
    ]);

    return ok({ booking, requiresPayment: !isFreeIntro }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
