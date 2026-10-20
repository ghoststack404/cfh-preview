import { getAuthenticatedUser } from '@/app/actions/onboarding';
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import CourseDetailClient, { CourseDetailData } from "./CourseDetailClient";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await getAuthenticatedUser();

  if (!id) {
    notFound();
  }

  let course = null;
  try {
    course = await prisma.course.findUnique({
      where: { id },
      include: {
        coach: {
          include: {
            coachProfile: true,
          },
        },
        category: true,
        modules: {
          include: {
            lessons: {
              orderBy: { position: "asc" },
            },
          },
          orderBy: { position: "asc" },
        },
      },
    });
  } catch (err) {
    console.warn("DB offline or error fetching course:", err);
  }

  if (course && course.status !== "PUBLISHED") {
    if (!auth || course.coachId !== auth.id) {
      notFound();
    }
  }

  if (!course) {
    const sampleCoursesMap: Record<string, CourseDetailData> = {
      "sample-2": {
        id: "sample-2",
        title: "Diseño UI/UX Profesional con Figma & Design Systems",
        summary: "Domina el diseño de interfaces modernas, sistemas de diseño y prototipado profesional con Figma.",
        description: "Aprende desde la investigación de usuarios hasta la creación de sistemas de diseño escalables y prototipos interactivos de alta fidelidad.",
        cleanDescription: "Aprende desde la investigación de usuarios hasta la creación de sistemas de diseño escalables y prototipos interactivos de alta fidelidad.",
        whatYouWillLearn: [
          "Dominar Figma desde lo básico hasta Auto-layout y Componentes Avanzados",
          "Crear un Design System completo con variables y tokens de diseño",
          "Principios de Usabilidad, Heurísticas y Psicología Gestalt aplicada",
          "Prototipos interactivos de alta fidelidad para pruebas con usuarios",
        ],
        thumbnailUrl: "https://images.unsplash.com/photo-1581291518655-9523c932edcf?w=600&h=400&fit=crop",
        introVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        price: 59,
        originalPrice: 99,
        averageRating: 4.9,
        enrollmentCount: 410,
        categoryName: "Diseño",
        coachName: "Sofía Morales",
        coachAvatar: null,
        coachHeadline: "Lead Product Designer & Design Systems Specialist",
        modules: [
          {
            id: "m1",
            title: "Módulo 1: Fundamentos de UX y Arquitectura de Información",
            lessons: [
              { id: "l1", title: "Introducción al Diseño Centrado en el Usuario", durationMinutes: 15, kind: "VIDEO" },
              { id: "l2", title: "Wireframing y Flujos de Usuario", durationMinutes: 20, kind: "VIDEO" },
            ],
          },
          {
            id: "m2",
            title: "Módulo 2: Figma Avanzado y Design Systems",
            lessons: [
              { id: "l3", title: "Auto-layout, Variantes y Component Properties", durationMinutes: 25, kind: "VIDEO" },
              { id: "l4", title: "Estructura de Tokens y Sistemas Escalables", durationMinutes: 30, kind: "VIDEO" },
            ],
          },
        ],
      },
      "sample-5": {
        id: "sample-5",
        title: "Python para Inteligencia Artificial y Machine Learning",
        summary: "Aprende programación moderna con Python, algoritmos de Machine Learning y Redes Neuronales.",
        description: "Domina el lenguaje más demandado para IA con librerías como PyTorch, TensorFlow, Scikit-Learn y Pandas.",
        cleanDescription: "Domina el lenguaje más demandado para IA con librerías como PyTorch, TensorFlow, Scikit-Learn y Pandas.",
        whatYouWillLearn: [
          "Fundamentos avanzados de Python para ciencia de datos",
          "Entrenamiento de modelos con Scikit-Learn y PyTorch",
          "Procesamiento de Lenguaje Natural (NLP) y Visión Computacional",
          "Despliegue de modelos en producción con APIs y Docker",
        ],
        thumbnailUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&h=400&fit=crop",
        introVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        price: 69,
        originalPrice: 119,
        averageRating: 4.9,
        enrollmentCount: 530,
        categoryName: "Tecnología",
        coachName: "David Chen",
        coachAvatar: null,
        coachHeadline: "Senior AI Engineer & Tech Lead",
        modules: [
          {
            id: "m1",
            title: "Módulo 1: Python para Data Science y Matemáticas",
            lessons: [
              { id: "l1", title: "NumPy, Pandas y Visualización con Seaborn", durationMinutes: 20, kind: "VIDEO" },
              { id: "l2", title: "Álgebra Lineal y Cálculo para IA", durationMinutes: 25, kind: "VIDEO" },
            ],
          },
        ],
      },
    };

    if (sampleCoursesMap[id]) {
      return <CourseDetailClient course={sampleCoursesMap[id]} />;
    }

    if (id.startsWith("sample-")) {
      const genericSample: CourseDetailData = {
        id,
        title: "Curso Especializado",
        summary: "Aprende habilidades de alto impacto con mentores líderes.",
        description: "Contenido profesional paso a paso con proyectos prácticos.",
        cleanDescription: "Contenido profesional paso a paso con proyectos prácticos.",
        whatYouWillLearn: ["Habilidades clave del sector", "Metodologías prácticas", "Proyectos reales de portafolio"],
        thumbnailUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=400&fit=crop",
        introVideoUrl: null,
        price: 49,
        originalPrice: 89,
        averageRating: 4.8,
        enrollmentCount: 150,
        categoryName: "General",
        coachName: "Coach CFH",
        coachAvatar: null,
        coachHeadline: "Especialista y Mentor en CFH",
        modules: [
          {
            id: "m1",
            title: "Módulo 1: Introducción",
            lessons: [
              { id: "l1", title: "Bienvenida y Hoja de Ruta", durationMinutes: 10, kind: "VIDEO" },
            ],
          },
        ],
      };
      return <CourseDetailClient course={genericSample} />;
    }

    notFound();
  }

  // Parse description and whatYouWillLearn
  let cleanDescription = course.description || "";
  const whatYouWillLearn: string[] = [];

  if (cleanDescription.includes("### Lo que aprenderás")) {
    const parts = cleanDescription.split("### Lo que aprenderás");
    cleanDescription = parts[0]?.trim() || "";
    const learnSection = parts[1] || "";
    const lines = learnSection.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        whatYouWillLearn.push(trimmed.replace(/^[-*]\s*/, ""));
      } else if (trimmed.length > 0) {
        whatYouWillLearn.push(trimmed);
      }
    }
  } else {
    // Check if description has bullet points
    const lines = cleanDescription.split("\n");
    const filteredDesc: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        whatYouWillLearn.push(trimmed.replace(/^[-*]\s*/, ""));
      } else {
        filteredDesc.push(line);
      }
    }
    if (whatYouWillLearn.length > 0) {
      cleanDescription = filteredDesc.join("\n").trim();
    }
  }

  let isEnrolled = false;
  if (course && auth) {
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        courseId: course.id,
        studentId: auth.id,
        status: { in: ["ACTIVE", "COMPLETED"] }
      },
      select: { id: true }
    });
    isEnrolled = Boolean(existingEnrollment);
  }

  // Buscar video introductorio: ya sea configurado a nivel de curso o la primera lección con video disponible
  let resolvedIntroVideo = course.introVideoUrl || null;
  if (!resolvedIntroVideo && course.modules) {
    for (const mod of course.modules) {
      const previewLesson = mod.lessons.find((l) => (l.isPreview || l.kind === "CONTENT") && l.videoUrl);
      if (previewLesson?.videoUrl) {
        resolvedIntroVideo = previewLesson.videoUrl;
        break;
      }
    }
  }

  const courseData: CourseDetailData = {
    id: course.id,
    isEnrolled,
    title: course.title,
    summary: course.summary || course.title,
    description: course.description || "",
    cleanDescription: cleanDescription || course.summary || course.title,
    whatYouWillLearn,
    thumbnailUrl:
      course.thumbnailUrl ||
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=400&fit=crop",
    introVideoUrl: resolvedIntroVideo,
    price: course.priceCents / 100,
    originalPrice: course.priceCents / 100,
    averageRating: 0,
    enrollmentCount: course.enrollmentCount || 0,
    categoryName: course.category?.name || "General",
    coachName: course.coach.name || "Coach CFH",
    coachAvatar: course.coach.avatarUrl || null,
    coachHeadline: course.coach.coachProfile?.headline || null,
    isBestseller: false, // course.isBestseller === true,
    modules: course.modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: null,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        durationMinutes: l.durationMinutes || 10,
        kind: l.kind,
        videoUrl: l.isPreview ? (l.videoUrl || null) : null,
      })),
    })),
  };

  return <CourseDetailClient course={courseData} />;
}
