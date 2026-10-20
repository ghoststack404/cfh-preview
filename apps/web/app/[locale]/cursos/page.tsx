import { getAuthenticatedUser } from "@/app/actions/onboarding";
import { prisma } from "@/lib/db";
import CursosClient from "@/components/CursosClient";

export const dynamic = "force-dynamic";

export default async function CursosPage({ params }: { params: Promise<{ locale: string }> }) {
    const resolvedParams = await params;
    const locale = resolvedParams.locale;
  const auth = await getAuthenticatedUser();
  let coursesData: any[] = [];
  let categoriesData: any[] = [];

  try {
    const [cData, catData] = await Promise.all([
      prisma.course.findMany({
        where: { status: "PUBLISHED", ...(auth?.id ? { coachId: { not: auth.id } } : {}) },
        include: {
          coach: true,
          category: true
        }
      }),
      prisma.category.findMany({ where: {  } })
    ]);
    coursesData = cData;
    categoriesData = catData;

    if (coursesData.length === 0) {
      coursesData = await prisma.course.findMany({
        where: { status: "PUBLISHED", ...(auth?.id ? { coachId: { not: auth.id } } : {}) },
        include: {
          coach: true,
          category: true
        }
      });
    }

    if (categoriesData.length === 0) {
      categoriesData = await prisma.category.findMany();
    }
  } catch (e) {
    console.error("Error fetching courses data:", e);
  }

  let enrolledCourseIds = new Set<string>();
  if (auth?.id) {
    try {
      const enrollments = await prisma.enrollment.findMany({
        where: {
          studentId: auth.id,
          status: { in: ["ACTIVE", "COMPLETED"] },
        },
        select: { courseId: true },
      });
      enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
    } catch (err) {
      console.error("Error fetching user enrollments:", err);
    }
  }

  const dbCourses = coursesData.map(c => ({
    id: c.id,
    title: c.title,
    author: c.coach?.name || "Coach CFH",
    category: c.category?.name || "General",
    rating: 0, // Las reseñas de cursos se implementarán a futuro
    reviews: c.enrollmentCount || 0,
    price: c.priceCents ? c.priceCents / 100 : 40,
    originalPrice: c.priceCents ? c.priceCents / 100 : 40, // Mismo precio que el actual, sin descuento inflado
    bestseller: false, // c.isBestseller === true,
    img: c.thumbnailUrl || "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=400&fit=crop",
    createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
    isEnrolled: enrolledCourseIds.has(c.id),
  }));

  // Combinar los de base de datos con los de muestra para una experiencia enriquecida
  const courses = dbCourses;

  const dummyFilter = (name: string) => !["qeqewqwe", "Tec superior"].includes(name);

  // Categorías de la base de datos (las 1,000+ categorías solicitadas para la plataforma)
  const dbCategories = categoriesData.map(c => c.name).filter(dummyFilter);
  const courseCategories = courses.map(c => c.category).filter(Boolean).filter(dummyFilter);

  // Todas las categorías disponibles (1,000+) ordenadas alfabéticamente
  const categories = Array.from(new Set([...dbCategories, ...courseCategories])).sort((a, b) => a.localeCompare(b, "es"));

  return <CursosClient courses={courses} categories={categories} />;
}
