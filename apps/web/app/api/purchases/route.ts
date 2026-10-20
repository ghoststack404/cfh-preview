import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ purchases: [] });

    const enrollments = await prisma.enrollment.findMany({
      where: {
        studentId: user.id,
        status: {
          in: ["ACTIVE", "COMPLETED"],
        },
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            priceCents: true,
            currency: true,
            thumbnailUrl: true,
            coach: { select: { name: true } },
            reviews: {
              where: { studentId: user.id },
              select: { id: true, rating: true, comment: true }
            },
            modules: {
              select: {
                lessons: {
                  select: { id: true },
                },
              },
            },
          },
        },
        progress: {
          where: { completedAt: { not: null } },
          select: { lessonId: true },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });

    const formattedPurchases = enrollments.map((enr) => {
      const allLessons = enr.course?.modules?.flatMap((m) => m.lessons) || [];
      const totalLessons = allLessons.length;
      const completedLessons = enr.progress ? enr.progress.length : 0;
      const percentage =
        totalLessons > 0 ? Math.min(100, Math.round((completedLessons / totalLessons) * 100)) : 0;

      return {
        id: enr.id,
        status: enr.status,
        enrolledAt: enr.enrolledAt,
        completedAt: enr.completedAt,
        totalLessons,
        completedLessons,
        percentage,
        course: {
          id: enr.course.id,
          title: enr.course.title,
          priceCents: enr.course.priceCents,
          currency: enr.course.currency,
          thumbnailUrl: enr.course.thumbnailUrl,
          coach: enr.course.coach,
          review: enr.course.reviews?.[0] || null,
        },
      };
    });

    return NextResponse.json({ purchases: formattedPurchases });
  } catch (error) {
    console.error("GET Purchases Error", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
