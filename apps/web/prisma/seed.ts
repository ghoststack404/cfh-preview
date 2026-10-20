import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  ["Desarrollo personal", "desarrollo-personal", "Metas, claridad, hábitos y liderazgo personal.", "sparkles"],
  ["Psicología y bienestar", "psicologia-bienestar", "Acompañamiento emocional, salud mental y mindfulness.", "heart"],
  ["Salud, Fitness y Nutrición", "salud-fitness-nutricion", "Entrenamiento físico, nutrición saludable y bienestar corporal.", "activity"],
  ["Negocios y Emprendimiento", "negocios-emprendimiento", "Creación de startups, modelos de negocio y estrategia comercial.", "briefcase"],
  ["Ventas y Negociación", "ventas-negociacion", "Técnicas de prospección, persuasión, cierre y ventas B2B/B2C.", "trending-up"],
  ["Liderazgo y Gestión de Equipos", "liderazgo-gestion", "Management, cultura de equipo, comunicación y resolución de conflictos.", "users"],
  ["Finanzas e Inversiones", "finanzas-inversiones", "Finanzas personales, contabilidad, bolsa, cripto y planeación financiera.", "wallet"],
  ["Tecnología y Programación", "tecnologia-programacion", "Desarrollo web, frontend, backend, móvil y arquitectura de software.", "code"],
  ["Inteligencia Artificial y Datos", "ia-ciencia-datos", "Machine learning, análisis de datos, Python, IA generativa y BI.", "cpu"],
  ["Diseño y Creatividad", "diseno-creatividad", "Diseño UI/UX, diseño gráfico, branding, animación y portafolio creativo.", "palette"],
  ["Marketing Digital y Redes Sociales", "marketing-digital", "Estrategia digital, SEO, anuncios pagados, redes sociales y contenido.", "megaphone"],
  ["Inglés e Idiomas", "ingles-idiomas", "Conversación en inglés, certificaciones TOEFL/IELTS y otros idiomas.", "languages"],
  ["Fotografía, Video y Multimedia", "fotografia-video", "Producción audiovisual, edición de video para YouTube/TikTok e iluminación.", "camera"],
  ["Música, Canto y Producción", "musica-canto", "Instrumentos musicales, técnica vocal, composición y producción musical.", "music"],
  ["Educación y Apoyo Académico", "apoyo-academico", "Matemáticas, ciencias, preparación de exámenes y tutoría académica.", "book-open"],
  ["Productividad y Organización", "productividad-organizacion", "Gestión del tiempo, sistemas Notion, hábitos de enfoque y metodologías ágiles.", "check-circle"],
  ["Coaching Ejecutivo y Carrera", "coaching-ejecutivo-carrera", "Preparación de entrevistas, optimización de CV, oratoria y transición laboral.", "award"],
  ["Escritura y Storytelling", "escritura-storytelling", "Redacción profesional, storytelling, creación literaria y copywriting.", "feather"]
] as const;

const plans = [
  {
    code: "BASIC",
    tier: "BASIC" as const,
    name: "Básico",
    description: "Para empezar a dar sesiones de 60 min con cero costo fijo.",
    monthlyPriceCents: 0,
    currency: "USD",
    commissionBps: 2300,
    hasAiCopilot: false,
    hasCourseBuilder: false,
    hasWhatsappReminders: false,
    hasStudentTracking: false,
    hasWhiteboard: false,
    hasPdfResources: false,
    monthlyAiCredits: 0,
    benefits: ["Comisión 23%", "Sesiones en vivo de 60 minutos", "Chat interno seguro", "Calendario y seguimiento"]
  },
  {
    code: "CURSOS_ONLY",
    tier: "CURSOS_ONLY" as const,
    name: "Solo Cursos",
    description: "Para creadores de contenido que solo venden videocursos.",
    monthlyPriceCents: 1900,
    currency: "USD",
    commissionBps: 2500,
    hasAiCopilot: false,
    hasCourseBuilder: true,
    hasWhatsappReminders: false,
    hasStudentTracking: true,
    hasWhiteboard: false,
    hasPdfResources: true,
    monthlyAiCredits: 0,
    benefits: ["Comisión 25%", "Creador de Cursos Ilimitado", "Seguimiento a aprendices", "Chat interno con alumnos"]
  },
  {
    code: "ELITE",
    tier: "ELITE" as const,
    name: "Elite",
    description: "Para coaches que buscan interacción dinámica en vivo.",
    monthlyPriceCents: 3000,
    currency: "USD",
    commissionBps: 2000,
    hasAiCopilot: false,
    hasCourseBuilder: false,
    hasWhatsappReminders: false,
    hasStudentTracking: false,
    hasWhiteboard: true,
    hasPdfResources: false,
    monthlyAiCredits: 0,
    benefits: ["Comisión 20%", "Sesiones en vivo de 60 minutos", "Pizarra virtual interactiva", "Bloc de Notas y Recordatorios"]
  },
  {
    code: "GOLD",
    tier: "GOLD" as const,
    name: "Gold",
    description: "Para coaches con flujo constante y retención de alumnos.",
    monthlyPriceCents: 7000,
    currency: "USD",
    commissionBps: 1800,
    hasAiCopilot: false,
    hasCourseBuilder: false,
    hasWhatsappReminders: true,
    hasStudentTracking: true,
    hasWhiteboard: true,
    hasPdfResources: true,
    monthlyAiCredits: 0,
    benefits: ["Comisión 18%", "Sesiones en vivo de 60 minutos", "Pizarra virtual interactiva", "Material descargable y seguimiento"]
  },
  {
    code: "PLATINUM",
    tier: "PLATINUM" as const,
    name: "Platinum",
    description: "La suite integral completa con creador de cursos y herramientas profesionales.",
    monthlyPriceCents: 10000,
    currency: "USD",
    commissionBps: 1500,
    hasAiCopilot: false,
    hasCourseBuilder: true,
    hasWhatsappReminders: true,
    hasStudentTracking: true,
    hasWhiteboard: true,
    hasPdfResources: true,
    monthlyAiCredits: 0,
    benefits: ["Comisión 15%", "Creador de Cursos y Bitácora", "Pizarra colaborativa y notas", "Herramientas profesionales"]
  }
];

async function upsertUser(input: { email: string; name: string; role: "ADMIN" | "COACH" | "STUDENT"; passwordHash: string; avatarUrl: string; countryCode?: string }) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: { name: input.name, role: input.role, status: "ACTIVE", avatarUrl: input.avatarUrl, passwordHash: input.passwordHash },
    create: { email: input.email, name: input.name, role: input.role, status: "ACTIVE", region: "LATAM", countryCode: input.countryCode ?? "MX", avatarUrl: input.avatarUrl, passwordHash: input.passwordHash, emailVerifiedAt: new Date() }
  });
}

async function main() {
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "CFH_Demo_2026!";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "CFH_Admin_2026!";
  const superadminPassword = process.env.SEED_SUPERADMIN_PASSWORD ?? "CFH_SuperAdmin_2026!";
  const [demoHash, adminHash, superadminHash] = await Promise.all([bcrypt.hash(demoPassword, 12), bcrypt.hash(adminPassword, 12), bcrypt.hash(superadminPassword, 12)]);

  for (const [name, slug, description, icon] of categories) {
    await prisma.category.upsert({ where: { slug }, update: { name, description, icon, isActive: true }, create: { name, slug, description, icon } });
  }
  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({ where: { code: plan.code }, update: plan, create: plan });
  }

  await upsertUser({ email: process.env.SEED_SUPERADMIN_EMAIL ?? "superadmin@coachingfromhome.local", name: process.env.SEED_SUPERADMIN_NAME ?? "Superadministrador CFH", role: "ADMIN", passwordHash: superadminHash, avatarUrl: "/logo-mark.svg" });
  await upsertUser({ email: process.env.SEED_ADMIN_EMAIL ?? "admin@coachingfromhome.local", name: process.env.SEED_ADMIN_NAME ?? "Administrador CFH", role: "ADMIN", passwordHash: adminHash, avatarUrl: "/logo-mark.svg" });
  const student = await upsertUser({ email: "ana@coachingfromhome.local", name: "Ana Torres", role: "STUDENT", passwordHash: demoHash, avatarUrl: "/avatars/ana.svg" });
  const valeria = await upsertUser({ email: "valeria@coachingfromhome.local", name: "Valeria Mendoza", role: "COACH", passwordHash: demoHash, avatarUrl: "/avatars/valeria.svg" });
  const diego = await upsertUser({ email: "diego@coachingfromhome.local", name: "Diego Ramírez", role: "COACH", passwordHash: demoHash, avatarUrl: "/avatars/diego.svg" });
  const sofia = await upsertUser({ email: "sofia@coachingfromhome.local", name: "Sofía Herrera", role: "COACH", passwordHash: demoHash, avatarUrl: "/avatars/sofia.svg" });

  const categoryRows = await prisma.category.findMany();
  const bySlug = new Map(categoryRows.map((category) => [category.slug, category]));

  const profiles = [
    { user: valeria, slug: "valeria-mendoza", headline: "Desarrollo personal y claridad profesional", biography: "Acompaño a personas que quieren ordenar sus metas, recuperar enfoque y tomar decisiones profesionales con más claridad. Mis sesiones combinan preguntas prácticas, acuerdos medibles y seguimiento respetuoso, sin recetas rígidas ni promesas irreales.", video: "https://player.vimeo.com/video/76979871", rate: 55000, years: 8, level: "EXPERT" as const, rating: 4.9, reviews: 86, sessions: 124, categories: ["desarrollo-personal", "negocios"] },
    { user: diego, slug: "diego-ramirez", headline: "Tecnología, programación y carrera digital", biography: "Ayudo a estudiantes y personas que cambian de carrera a entender programación, construir proyectos y prepararse para entrevistas. Trabajo con metas semanales, ejercicios pequeños y explicaciones directas para que cada sesión termine con un siguiente paso concreto.", video: "https://player.vimeo.com/video/76979871", rate: 48000, years: 6, level: "FEATURED" as const, rating: 4.8, reviews: 42, sessions: 71, categories: ["tecnologia"] },
    { user: sofia, slug: "sofia-herrera", headline: "Finanzas personales sin complicaciones", biography: "Te acompaño a entender tus ingresos, gastos, deudas y metas sin juicios. Construimos un sistema realista que puedas sostener, con números claros y decisiones pequeñas. Mi enfoque es educativo y no sustituye asesoría financiera regulada.", video: "https://player.vimeo.com/video/76979871", rate: 65000, years: 11, level: "ELITE" as const, rating: 5, reviews: 121, sessions: 238, categories: ["finanzas", "desarrollo-personal"] }
  ];

  for (const item of profiles) {
    const profile = await prisma.coachProfile.upsert({
      where: { userId: item.user.id },
      update: { slug: item.slug, headline: item.headline, biography: item.biography, introVideoUrl: item.video, yearsExperience: item.years, hourlyRateCents: item.rate, approvalStatus: "APPROVED", level: item.level, averageRating: item.rating, reviewCount: item.reviews, completedSessionCount: item.sessions, contractVersion: "coach-v1.0", contractAcceptedAt: new Date(), verifiedAt: new Date(), stripeAccountId: `acct_mock_${item.user.id}`, stripeChargesEnabled: true },
      create: { userId: item.user.id, slug: item.slug, headline: item.headline, biography: item.biography, introVideoUrl: item.video, yearsExperience: item.years, hourlyRateCents: item.rate, approvalStatus: "APPROVED", level: item.level, averageRating: item.rating, reviewCount: item.reviews, completedSessionCount: item.sessions, contractVersion: "coach-v1.0", contractAcceptedAt: new Date(), verifiedAt: new Date(), stripeAccountId: `acct_mock_${item.user.id}`, stripeChargesEnabled: true }
    });
    await prisma.coachCategory.deleteMany({ where: { coachProfileId: profile.id } });
    await prisma.coachCategory.createMany({ data: item.categories.map((slug) => ({ coachProfileId: profile.id, categoryId: bySlug.get(slug)!.id })) });
    const existingAvailability = await prisma.availabilityRule.count({ where: { coachProfileId: profile.id } });
    if (!existingAvailability) {
      await prisma.availabilityRule.createMany({ data: [1, 2, 3, 4, 5].map((weekday) => ({ coachProfileId: profile.id, weekday, startMinute: 9 * 60, endMinute: 18 * 60 })) });
    }
  }

  const growthStudents = [] as Awaited<ReturnType<typeof upsertUser>>[];
  for (let index = 1; index <= 8; index += 1) {
    growthStudents.push(await upsertUser({
      email: `student${index}@coachingfromhome.local`,
      name: `Estudiante Demo ${index}`,
      role: "STUDENT",
      passwordHash: demoHash,
      avatarUrl: "/avatars/ana.svg"
    }));
  }

  const coachesForGrowth = [valeria, diego, sofia];
  const rates = new Map([[valeria.id, 55000], [diego.id, 48000], [sofia.id, 65000]]);
  const current = new Date();
  for (let monthOffset = 5; monthOffset >= 0; monthOffset -= 1) {
    const activeCount = 2 + (5 - monthOffset);
    for (const coach of coachesForGrowth) {
      for (let index = 0; index < activeCount; index += 1) {
        const studentRow = growthStudents[(index + coachesForGrowth.indexOf(coach)) % growthStudents.length];
        const key = `mock_growth_${coach.id}_${monthOffset}_${index}`;
        const existingGrowth = await prisma.booking.findUnique({ where: { stripeCheckoutSessionId: key } });
        if (!existingGrowth) {
          const startAt = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - monthOffset, 8 + index, 16, 0));
          const rate = rates.get(coach.id) ?? 50000;
          await prisma.booking.create({
            data: {
              studentId: studentRow!.id, coachId: coach.id, startAt, endAt: new Date(startAt.getTime() + 60 * 60_000),
              status: "COMPLETED", priceCents: rate, platformFeeCents: Math.round(rate * .15), currency: "MXN",
              stripeCheckoutSessionId: key, stripePaymentIntentId: `${key}_pi`, videoRoomName: `${key}_room`, completedAt: new Date(startAt.getTime() + 60 * 60_000)
            }
          });
        }
      }
    }
  }

  const completedBooking = await prisma.booking.findFirst({ where: { studentId: student.id, coachId: valeria.id, status: "COMPLETED" } });
  if (!completedBooking) {
    const startAt = new Date(Date.now() - 14 * 86_400_000);
    const booking = await prisma.booking.create({ data: { studentId: student.id, coachId: valeria.id, startAt, endAt: new Date(startAt.getTime() + 60 * 60_000), status: "COMPLETED", priceCents: 55000, platformFeeCents: 8250, currency: "MXN", stripeCheckoutSessionId: `mock_seed_${student.id}`, stripePaymentIntentId: `mock_seed_payment_${student.id}`, videoRoomName: `cfh-seed-${student.id}`, completedAt: new Date(startAt.getTime() + 60 * 60_000) } });
    await prisma.conversation.create({ data: { bookingId: booking.id, studentId: student.id, coachId: valeria.id, contactUnlockedAt: startAt, lastMessageAt: startAt, messages: { create: [{ senderId: student.id, content: "Hola, me gustaría trabajar en mi organización profesional." }, { senderId: valeria.id, content: "Claro, revisaremos tu meta y construiremos un plan sencillo." }] } } });
    await prisma.review.create({ data: { bookingId: booking.id, authorId: student.id, coachId: valeria.id, rating: 5, comment: "La sesión fue clara, cálida y terminó con acciones que sí pude aplicar." } });
  }

  const course = await prisma.course.upsert({
    where: { slug: "organiza-tus-metas-en-4-semanas" },
    update: { title: "Organiza tus metas en 4 semanas", summary: "Un sistema práctico para elegir prioridades, avanzar y revisar resultados.", description: "Este curso te ayuda a convertir metas generales en acciones semanales. Incluye ejercicios de enfoque, revisión y seguimiento para que puedas adaptar el método a tu vida real.", coachId: valeria.id, categoryId: bySlug.get("desarrollo-personal")!.id, priceCents: 79000, status: "PUBLISHED", publishedAt: new Date(), estimatedMinutes: 180, averageRating: 4.9 },
    create: { slug: "organiza-tus-metas-en-4-semanas", title: "Organiza tus metas en 4 semanas", summary: "Un sistema práctico para elegir prioridades, avanzar y revisar resultados.", description: "Este curso te ayuda a convertir metas generales en acciones semanales. Incluye ejercicios de enfoque, revisión y seguimiento para que puedas adaptar el método a tu vida real.", coachId: valeria.id, categoryId: bySlug.get("desarrollo-personal")!.id, priceCents: 79000, status: "PUBLISHED", publishedAt: new Date(), estimatedMinutes: 180, averageRating: 4.9 }
  });
  const modules = [
    {
      title: "Elegir una meta que importe",
      lessons: [
        { title: "De deseo a resultado", kind: "ASSIGNMENT" as const,     content: "Convierte una meta general en un resultado observable.\n\n1. Escribe la meta con tus propias palabras.\n2. Describe qué evidencia concreta demostraría que avanzaste.\n3. Define una primera acción que puedas completar en menos de 30 minutos.\n\nEntrega tu respuesta como texto, documento o imagen de tus apuntes." },
        { title: "La medida de avance", kind: "ASSIGNMENT" as const,     content: "Diseña una medida sencilla para revisar tu avance cada semana. Evita indicadores que dependan por completo de otras personas. Incluye el valor inicial, la meta de cuatro semanas y la frecuencia con la que registrarás el dato." }
      ]
    },
    {
      title: "Construir una semana posible",
      lessons: [
        { title: "Acciones pequeñas", kind: "PROJECT" as const,     content: "Crea un tablero de acciones para los próximos siete días. Cada acción debe ser específica, breve y estar vinculada con tu meta. Sube una captura, documento o explicación del tablero." },
        { title: "Tiempo y energía", kind: "ASSIGNMENT" as const,     content: "Observa en qué momentos de la semana tienes más energía. Elige dos bloques realistas para avanzar en tu meta y explica qué obstáculo podría aparecer y cómo lo resolverías." }
      ]
    },
    {
      title: "Revisar sin castigarte",
      lessons: [
        { title: "Aprender del bloqueo", kind: "ASSIGNMENT" as const,     content: "Describe un bloqueo reciente sin juzgarte. Separa hechos, interpretación y siguiente acción. Termina con una decisión pequeña que puedas probar durante la próxima semana." },
        { title: "Cierre y siguiente ciclo", kind: "PROJECT" as const,     content: "Prepara tu cierre de cuatro semanas. Resume avances, aprendizajes, pendientes y la siguiente meta. Puedes entregar un documento, una imagen o un mensaje detallado." }
      ]
    }
  ];
  const existingModules = await prisma.courseModule.findMany({ where: { courseId: course.id }, include: { lessons: true }, orderBy: { position: "asc" } });
  if (!existingModules.length) {
    for (let i = 0; i < modules.length; i += 1) {
      const module = await prisma.courseModule.create({ data: { courseId: course.id, title: modules[i]?.title ?? "", position: i + 1 } });
      await prisma.courseLesson.createMany({ data: (modules[i]?.lessons ?? []).map((item, index) => ({
        moduleId: module.id,
        title: item.title,
        position: index + 1,
        durationMinutes: 25,
        isPreview: i === 0 && index === 0,
        content: item.content,
        kind: item.kind,
        
        
        
        
        allowMessages: true,
        
        
      })) });
    }
  } else {
    for (const moduleData of modules) {
      for (const lessonData of moduleData.lessons) {
        await prisma.courseLesson.updateMany({
          where: { title: lessonData.title, module: { courseId: course.id } },
          data: {
            content: lessonData.content,
            kind: lessonData.kind,
            
            
            
            
            allowMessages: true,
            
            
          }
        });
      }
    }
  }

  const post = await prisma.communityPost.findFirst({ where: { authorId: valeria.id, title: "Una meta útil cabe en una semana" } });
  if (!post) await prisma.communityPost.create({ data: { authorId: valeria.id, title: "Una meta útil cabe en una semana", content: "Cuando una meta se siente enorme, intenta definir qué evidencia pequeña te diría que avanzaste esta semana. Compartir ese paso suele dar más claridad que repetir el objetivo completo." } });

  // === GENERAR 10 COACHES FALSOS PARA PRUEBAS ===
  console.log("Generando 10 coaches adicionales para testing del Marketplace...");
  const mockTiers = ["BASIC", "CURSOS_ONLY", "ELITE", "GOLD", "PLATINUM"] as const;
  const mockSpecialties = [
    ["React", "Next.js", "Frontend"],
    ["Inglés Conversacional", "TOEFL"],
    ["Finanzas Personales", "Inversiones"],
    ["Diseño UI/UX", "Figma", "Framer"],
    ["Marketing Digital", "SEO", "Ads"],
    ["Productividad", "Gestión del tiempo"],
    ["Liderazgo", "Soft Skills"],
    ["Emprendimiento", "Ventas B2B"],
    ["Node.js", "Backend", "Bases de datos"],
    ["Desarrollo Personal", "Metas"]
  ];
  
  for (let i = 1; i <= 10; i++) {
    const email = `coach${i}@demo.local`;
    const passwordHash = demoHash;
    const tier = mockTiers[i % mockTiers.length];
    
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: `Coach Experto ${i}`,
          passwordHash,
          role: "COACH",
          status: "ACTIVE",
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/png?seed=coach${i}`,
          interests: mockSpecialties[i - 1],
          goals: "Ayudar a mis alumnos a crecer profesionalmente.",
        }
      });
      
      await prisma.coachProfile.create({
        data: {
          userId: user.id,
          slug: `coach-experto-${i}`,
          biography: `Soy el Coach Experto ${i}, especializado en enseñar y mentorizar a profesionales que buscan subir al siguiente nivel.`,
          headline: `Experto en ${mockSpecialties[i - 1]?.[0] || "Especialidad"}`,
          introVideoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
          yearsExperience: 3 + (i % 5),
          hourlyRateCents: (15 + (i * 5)) * 100, // $15.00 a $65.00 USD
          currency: "USD",
          freeIntroEnabled: true,
          freeIntroMinutes: 15,
          approvalStatus: "APPROVED",
          currentTier: tier,
          level: "NEW", // Obsoleto pero requerido por esquema viejo si existe
          averageRating: 4.0 + (i % 10) / 10, // 4.0 a 4.9
          reviewCount: i * 3,
          contractVersion: "1.0",
          contractAcceptedAt: new Date()
        }
      });
    }
  }

  console.log("Seed listo.");
  console.log(`Superadmin: ${process.env.SEED_SUPERADMIN_EMAIL ?? "superadmin@coachingfromhome.local"}`);
  console.log(`Contraseña superadmin: ${superadminPassword}`);
  console.log(`Admin: ${process.env.SEED_ADMIN_EMAIL ?? "admin@coachingfromhome.local"}`);
  console.log(`Contraseña admin: ${adminPassword}`);
  console.log(`Coaches: valeria@coachingfromhome.local, diego@coachingfromhome.local, sofia@coachingfromhome.local`);
  console.log(`Contraseña demo: ${demoPassword}`);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => prisma.$disconnect());
