import { Suspense } from "react";
import { prisma } from "@/lib/db";
import CoachProfileClient, { CoachProfileData } from "./CoachProfileClient";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getAuthenticatedUser } from "@/app/actions/onboarding";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CoachProfilePage({ params }: Props) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id || "");
  const slugifiedId = slugify(decodedId);

  let coachData = await prisma.coachProfile.findFirst({
    where: {
      OR: [
        { id: id },
        { slug: id },
        { slug: decodedId },
        { slug: slugifiedId },
        { userId: id }
      ]
    },
    include: {
      user: {
        include: {
          receivedReviews: {
            include: { author: true },
            orderBy: { createdAt: "desc" }
          },
          courses: {
            where: { status: "PUBLISHED" }
          },
          coachSubscriptions: {
            where: { status: "ACTIVE" },
            include: { plan: true },
            orderBy: { createdAt: "desc" },
            take: 1
          }
        }
      },
      categories: {
        include: { category: true }
      },
      certificates: true,
      availabilityRules: true,
    }
  });

  if (!coachData) {
    notFound();
  }

  let freeIntroMeta: any = {};
  if (coachData.rejectionReason) {
    try {
      freeIntroMeta = JSON.parse(coachData.rejectionReason);
    } catch {}
  }
  const freeIntroWeekdays: number[] = Array.isArray(freeIntroMeta.freeIntroWeekdays)
    ? freeIntroMeta.freeIntroWeekdays
    : (freeIntroMeta.freeIntroWeekday !== null && freeIntroMeta.freeIntroWeekday !== undefined ? [freeIntroMeta.freeIntroWeekday] : [1, 2, 3, 4, 5]);

  const activeRules = coachData.availabilityRules ? coachData.availabilityRules.filter(r => r.isActive) : [];
  const regularWeekdays: number[] = activeRules.length > 0
    ? Array.from(new Set(activeRules.map(r => r.weekday)))
    : [1, 2, 3, 4, 5];

  const reviews = coachData.user.receivedReviews && coachData.user.receivedReviews.length > 0
    ? coachData.user.receivedReviews.map((r) => ({
        id: r.id,
        authorName: r.author.name,
        authorAvatar: r.author.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(r.author.name || "Aprendiz")}`,
        rating: r.rating,
        comment: r.comment || "",
        date: new Date(r.createdAt).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" })
      }))
    : [];

  const calculatedRating = reviews.length > 0
    ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1))
    : (coachData.averageRating || 0);

  const activeTier = coachData.user.coachSubscriptions?.[0]?.plan?.tier || coachData.currentTier || "BASIC";

  const coach: CoachProfileData = {
    id: coachData.id,
    userId: coachData.userId,
    slug: coachData.slug,
    name: coachData.displayName || coachData.user.name,
    email: coachData.user.email,
    avatarUrl: coachData.user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(coachData.displayName || coachData.user.name || "Coach")}`,    headline: coachData.headline || "Coach Profesional y Mentor Especialista",
    biography: coachData.biography || "Coach comprometido con el aprendizaje y crecimiento de sus alumnos.",
    introVideoUrl: coachData.introVideoUrl || "",
    bannerUrl: freeIntroMeta.bannerUrl || null,
    yearsExperience: coachData.yearsExperience || 0,
    hourlyRate: coachData.hourlyRateCents > 0 ? coachData.hourlyRateCents / 100 : 0,
    currency: coachData.currency || "USD",
    level: coachData.level || "BASIC",
    tier: activeTier,
    createdAt: coachData.createdAt ? coachData.createdAt.toISOString() : undefined,
    averageRating: calculatedRating,
    reviewCount: reviews.length > 0 ? reviews.length : (coachData.reviewCount || 0),
    completedSessionCount: coachData.completedSessionCount || 0,
    timezone: coachData.timezone || "America/Mexico_City",
    language: "Español",
    freeIntroEnabled: coachData.freeIntroEnabled ?? true,
    freeIntroMinutes: coachData.freeIntroMinutes || 15,
    freeIntroWeekdays,
    regularWeekdays,
    showCertificates: coachData.showCertificates,
    certificates: coachData.certificates.map(c => ({
      id: c.id,
      title: c.title,
      fileUrl: c.fileUrl,
      fileType: c.fileType as any,
      fileName: c.fileName || undefined,
      fileSize: c.fileSize || undefined,
      issuedBy: c.issuedBy || undefined,
      issuedAt: c.issuedAt ? c.issuedAt.toISOString() : undefined,
    })),
    categories: coachData.categories.length > 0 
      ? coachData.categories.map(c => c.category.name)
      : [],
    reviews,
    courses: coachData.user.courses
      ? coachData.user.courses.map(c => ({
          id: c.id,
          title: c.title,
          slug: c.slug,
          thumbnailUrl: c.thumbnailUrl,
          price: c.priceCents / 100,
          currency: c.currency
        }))
      : []
  };

  // Pre-calcular elegibilidad de llamada gratuita en el servidor para evitar flashes o botones activos por error
  const authUser = await getAuthenticatedUser();
  let initialEligibleForFreeIntro = true;
  let initialFreeIntroReason: string | null = null;
  let initialIsSecondChance = false;

  if (!coachData.freeIntroEnabled) {
    initialEligibleForFreeIntro = false;
    initialFreeIntroReason = "El coach no tiene activas sesiones de prueba gratuita.";
  } else if (authUser) {
    const priorFreeIntros = await prisma.booking.findMany({
      where: {
        studentId: authUser.id,
        coachId: coachData.userId,
        isFreeIntro: true,
        status: {
          not: "CANCELED"
        }
      },
      orderBy: { createdAt: "desc" }
    });

    if (priorFreeIntros.length > 0 && priorFreeIntros[0]) {
      const lastBooking = priorFreeIntros[0];
      const endedForAbsence = Boolean(
        (lastBooking.notes && (
          lastBooking.notes.toLowerCase().includes("ausencia") ||
          lastBooking.notes.toLowerCase().includes("inasistencia") ||
          lastBooking.notes.toLowerCase().includes("tolerancia de 5 minutos")
        )) ||
        (lastBooking as any).status === "NO_SHOW"
      );

      const hasUsedSecondChance = Boolean((authUser as any)?.secondChanceUsed);

      // Si la cita anterior fue finalizada por inasistencia y el usuario aún dispone de su segunda oportunidad
      if (endedForAbsence && !hasUsedSecondChance && priorFreeIntros.length === 1) {
        initialEligibleForFreeIntro = true;
        initialFreeIntroReason = null;
        initialIsSecondChance = true;
      } else {
        initialEligibleForFreeIntro = false;
        initialFreeIntroReason = "Ya has utilizado tu sesión de prueba gratuita de 15 minutos con este coach.";
      }
    }
  }

  const cookieStore = await cookies();
  const activeRoleCookie = cookieStore.get("cfh_active_role")?.value || null;
  const initialActiveRole = activeRoleCookie || authUser?.role || null;
  const initialCurrentUser = authUser ? {
    id: authUser.id,
    name: authUser.name,
    email: authUser.email,
    role: authUser.role,
    coachProfile: (authUser as any).coachProfile ? {
      id: (authUser as any).coachProfile.id,
      slug: (authUser as any).coachProfile.slug,
    } : undefined
  } : null;

  return (
    <Suspense fallback={<div className="min-h-screen bg-cfh-dark flex items-center justify-center text-white text-sm font-semibold">Cargando perfil del coach...</div>}>
      <CoachProfileClient
        coach={coach}
        initialEligibleForFreeIntro={initialEligibleForFreeIntro}
        initialFreeIntroReason={initialFreeIntroReason}
        initialIsSecondChance={initialIsSecondChance}
        initialCurrentUser={initialCurrentUser}
        initialActiveRole={initialActiveRole}
      />
    </Suspense>
  );
}

