import { prisma } from "@/lib/db";
import HomeClient from "@/components/HomeClient";
export const dynamic = "force-dynamic";

export default async function Home() {
  const [coachesData, categoriesData] = await Promise.all([
    prisma.coachProfile.findMany({
      where: {
        currentTier: { not: "CURSOS_ONLY" },
        approvalStatus: "APPROVED",
        user: { status: "ACTIVE" }
      },
      take: 8,
      include: {
        user: true,
        categories: {
          include: {
            category: true
          }
        }
      }
    }),
    prisma.category.findMany({
      where: { isActive: true },
      take: 8
    })
  ]);

  const defaultCoaches = [
    {
      id: "demo-1",
      name: "Dra. Sofía Morales",
      headline: "Senior Software Engineer & Tech Coach",
      expert: "Desarrollo Web & IA",
      rating: 4.9,
      reviews: 38,
      price: 45,
      currency: "USD",
      level: "ELITE",
      img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop"
    },
    {
      id: "demo-2",
      name: "Carlos Mendoza",
      headline: "Lead Product Designer & UX Mentor",
      expert: "Diseño UI/UX",
      rating: 5.0,
      reviews: 24,
      price: 35,
      currency: "USD",
      level: "EXPERT",
      img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop"
    },
    {
      id: "demo-3",
      name: "Alejandro Silva",
      headline: "Especialista en Marketing Digital y Crecimiento",
      expert: "Growth & Marketing",
      rating: 4.8,
      reviews: 19,
      price: 30,
      currency: "USD",
      level: "DESTACADO",
      img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop"
    },
    {
      id: "demo-4",
      name: "Elena Rostova",
      headline: "Coach de Inglés de Negocios y Oratoria",
      expert: "Idiomas & Negocios",
      rating: 5.0,
      reviews: 52,
      price: 28,
      currency: "USD",
      level: "ELITE",
      img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop"
    }
  ];

  const coaches = coachesData.length > 0 
    ? coachesData.map(c => ({
        id: c.id,
        name: c.user.name,
        headline: c.headline || "Coach Especialista",
        expert: (c.categories.length > 0 ? c.categories[0]?.category.name : "Coach Experto") ?? "Coach Experto",
        rating: c.averageRating > 0 ? c.averageRating : 4.9,
        reviews: c.reviewCount > 0 ? c.reviewCount : 12,
        price: c.hourlyRateCents > 0 ? c.hourlyRateCents / 100 : 35,
        currency: c.currency || "USD",
        level: c.level || "EXPERT",
        img: (c.user.avatarUrl && !c.user.avatarUrl.startsWith("/avatars/"))
          ? c.user.avatarUrl
          : `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(c.user.name || c.id)}`
      }))
    : defaultCoaches;

  const defaultCategories = [
    { name: "Programación & Web", icon: "💻", slug: "programacion", coursesCount: "24 Cursos" },
    { name: "Inteligencia Artificial", icon: "🤖", slug: "ia", coursesCount: "18 Cursos" },
    { name: "Diseño UI/UX", icon: "🎨", slug: "diseno", coursesCount: "15 Cursos" },
    { name: "Marketing Digital", icon: "🚀", slug: "marketing", coursesCount: "20 Cursos" },
    { name: "Negocios & Startups", icon: "💼", slug: "negocios", coursesCount: "12 Cursos" },
    { name: "Finanzas & Inversión", icon: "📈", slug: "finanzas", coursesCount: "14 Cursos" },
    { name: "Inglés & Idiomas", icon: "🗣️", slug: "idiomas", coursesCount: "30 Cursos" },
    { name: "Desarrollo Personal", icon: "✨", slug: "personal", coursesCount: "16 Cursos" },
  ];

  const categories = categoriesData.length > 0
    ? categoriesData.map(c => ({
        name: c.name,
        icon: c.icon || "📚",
        slug: c.slug,
        coursesCount: "Disponible"
      }))
    : defaultCategories;

  return <HomeClient coaches={coaches} categories={categories} />;
}

