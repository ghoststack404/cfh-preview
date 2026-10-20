import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, handleRouteError } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser();
    
    // Fetch Enrolled Courses
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: user.id },
      include: {
        course: true,
      }
    });

    const myCourses = enrollments.map(e => ({
      id: e.course.id,
      title: e.course.title,
      progress: 0, // Real progress logic would go here
      lastClass: "Introducción",
      img: e.course.thumbnailUrl || "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=400&fit=crop",
    }));

    // Fetch upcoming sessions
    const bookings = await prisma.booking.findMany({
      where: {
        studentId: user.id,
        startAt: { gte: new Date() },
        status: "CONFIRMED"
      },
      include: {
        coach: {
          select: {
            name: true,
            avatarUrl: true,
            coachProfile: {
              select: { headline: true }
            }
          }
        }
      },
      orderBy: { startAt: "asc" },
      take: 5
    });

    const upcomingSessions = bookings.map(b => ({
      id: b.id,
      coach: b.coach.name,
      subject: b.coach.coachProfile?.headline || "Tutoría",
      date: b.startAt.toISOString(), // client will format
      img: b.coach.avatarUrl || "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop"
    }));

    return ok({ 
      myCourses, 
      upcomingSessions,
      userName: user.name || "Aprendiz"
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
