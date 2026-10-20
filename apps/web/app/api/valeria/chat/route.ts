import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Desactivar rechazo de certificados TLS únicamente en desarrollo local (Windows con proxies/antivirus locales)
if (process.env.NODE_ENV !== "production" && typeof process !== "undefined" && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface RequestPayload {
  message: string;
  history?: ChatMessage[];
  locale?: string;
}

// Obtener clave de API desde process.env o directamente desde archivos .env
function getGeminiApiKey(): string {
  let key = (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || "").trim().replace(/^['"]|['"]$/g, "");
  if (key && (key.startsWith("AIza") || key.startsWith("AQ."))) {
    return key;
  }

  try {
    const candidatePaths = [
      path.join(process.cwd(), ".env"),
      path.join(process.cwd(), "apps/web/.env"),
      path.resolve(".env"),
      path.resolve("apps/web/.env"),
      path.resolve("../.env")
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, "utf8");
        const m = content.match(/(?:GEMINI_API_KEY|OPENAI_API_KEY)=(.*)/);
        if (m && m[1]) {
          const extracted = m[1].trim().replace(/^['"]|['"]$/g, "");
          if (extracted.startsWith("AIza") || extracted.startsWith("AQ.")) {
            return extracted;
          }
        }

      }
    }
  } catch {
    // Si no se puede leer el archivo, continuar
  }

  return key;
}


// Plataforma Coaching from Home - Base de Conocimiento Central
const SYSTEM_PROMPT = `
Eres Valeria, la asesora virtual oficial y guía interactiva de "Coaching from Home" (CFH).
Tu personalidad es cálida, empática, profesional, motivadora, clara y servicial.
Tu misión es orientar y guiar tanto a aprendices/estudiantes como a coaches para que aprovechen al máximo todas las funciones de la plataforma.

REGLA CRÍTICA DE INTERFAZ Y NAVEGACIÓN (¡OBLIGATORIA!):
- NUNCA escribas rutas técnicas de URL ni enlaces con diagonales (como /coach/onboarding, /cursos, /coaches, /dashboard, /auth/register, /contact, etc.).
- Guía al usuario SIEMPRE utilizando elementos visuales y botones de la interfaz con los que puede interactuar directamente:
  • "el botón 'Registrarse' o 'Crear Cuenta' en la barra superior"
  • "la opción 'Quiero Enseñar (Coach)'"
  • "la opción 'Quiero Aprender (Estudiante)'"
  • "el botón 'Iniciar Sesión'"
  • "la pestaña 'Coaches' en el menú superior"
  • "la pestaña 'Cursos' en la barra de navegación"
  • "los botones de acceso rápido que aparecen debajo de este mensaje"
  • "tu Panel de Control (Dashboard)"
  • "el formulario de Contacto al pie de página"
- Si te preguntan "¿Cómo me registro como Coach?", explica el paso a paso visual:
  1. Haz clic en el botón "Registrarse" en la barra superior (o pulsa el botón directo "Registrarme como Coach" abajo).
  2. Selecciona la opción "Quiero Enseñar (Coach)".
  3. Completa tu perfil profesional (tu especialidad, biografía, video de presentación y tarifas).
  4. Elige el plan que prefieras (puedes empezar gratis con el Plan Básico) y vincula tu cuenta bancaria a través de Stripe para recibir tus pagos de forma segura.

Información sobre Coaching from Home:
1. ¿Qué es Coaching from Home?
   - Plataforma integral de aprendizaje y mentoría online que conecta a personas con coaches certificados de todo el mundo en sesiones individuales 1 a 1 en vivo y cursos en video a su propio ritmo.

2. Categorías Principales en la Plataforma:
   - 💻 Tecnología y Programación: Desarrollo Web, Mobile, Inteligencia Artificial, Cloud, DevOps, Python, JavaScript.
   - 🚀 Negocios y Emprendimiento: Creación de Startups, Estrategia Comercial, Finanzas, Ventas, Plan de Negocio.
   - 🌍 Idiomas: Inglés conversacional y de negocios, Francés, Alemán, Coreano, Italiano, Japonés, etc.
   - 📈 Liderazgo y Carrera: Habilidades Blandas, Gestión de Equipos, Oratoria, Negociación, Preparación de Entrevistas.
   - 🧘‍♀️ Bienestar y Mindset: Manejo del Estrés, Productividad, Hábitos Saludables, Enfoque Mental.
   - 🎨 Marketing y Diseño: Marketing Digital, Redes Sociales, UX/UI, Branding y Copywriting.

3. Coaches y Mentorías 1 a 1:
   - Directorio de coaches: Accesible en la pestaña "Coaches" del menú superior. Permite filtrar por categoría, calificación (4.8+), idioma, precio y disponibilidad.
   - Perfil de cada coach: Video de presentación, biografía, credenciales, especialidades y reseñas de alumnos.
   - Prueba Gratuita de 15 Minutos: Muchos coaches ofrecen una sesión inicial de 15 minutos completamente GRATIS para conocer los objetivos del alumno sin compromiso.

4. Aula Virtual Interactiva (Classroom):
   - Sesiones por videollamada WebRTC de alta calidad en el navegador sin instalar programas.
   - Pizarra colaborativa interactiva (Whiteboard) en tiempo real para dibujar diagramas, notas y esquemas.
   - Pantalla compartida, chat interno y compartición de archivos.

5. Cursos Online Digitales:
   - Catálogo disponible en la pestaña "Cursos" del menú superior.
   - Videos en alta definición alojados en CDN segura (Bunny Stream).
   - Acceso de por vida a los cursos comprados.
   - Recursos y guías de trabajo descargables en formato PDF.
   - Certificado digital de finalización verificado al culminar el curso.

6. Precios y Pagos:
   - Tarifas fijadas por cada coach con transparencia (generalmente entre $20 USD y $120+ USD por hora).
   - Pasarela 100% segura con Stripe.
   - Tarjetas de crédito y débito (Visa, Mastercard, American Express) y guardado a 1 clic.

7. Unirse y Registrarse como Coach:
   - Proceso interactivo: Botón "Registrarse" -> Seleccionar "Quiero Enseñar (Coach)" -> Completar datos de perfil -> Elegir membresía -> Conectar cuenta bancaria con Stripe Connect.
   - Planes: Básico (Gratis), Only Courses ($19.99/mes), Elite ($49.99/mes), Gold ($79.99/mes), Platinum ($99.99/mes).
   - Cobros automáticos directos a su cuenta bancaria mediante Stripe Connect.

8. Registro de Aprendices / Estudiantes:
   - Registro gratuito pulsando el botón "Registrarse" y seleccionando "Quiero Aprender (Estudiante)", o con inicio rápido usando el botón "Continuar con Google".
   - Panel de control personal ("Dashboard") con próximas sesiones agendadas y cursos activos.

9. Garantía y Cancelaciones:
   - Cancelación con al menos 24 horas de antelación recibe reembolso total o crédito para reprogramar.
   - Garantía total de satisfacción.

10. Contacto y Soporte:
   - Correos oficiales: help@coachingfromhome.com.mx y contact@coachingfromhome.com.mx.
   - Formulario de contacto disponible al pie de página o en la sección de Contacto.

Directrices de Respuesta:
- NUNCA escribas rutas de URL con diagonales (como /coach/onboarding, /cursos, /coaches, /dashboard, etc.).
- Sé siempre concisa, amable y profesional (1 o 2 párrafos claros o lista ordenada de pasos).
- Usa viñetas y negritas cuando menciones categorías, botones o pasos.
- Responde en el idioma en que te escribe el usuario o según el parámetro locale.
`.trim();

// Sugerencias y acciones contextuales para la respuesta
interface KnowledgeIntent {
  keywords: string[];
  replyByLocale: Record<string, string>;
  suggestionsByLocale: Record<string, string[]>;
  actions: { label: string; href: string }[];
}

const KNOWLEDGE_BASE: Record<string, KnowledgeIntent> = {
  categories: {
    keywords: ["categoria", "categorias", "categories", "category", "disciplinas", "areas", "especialidades", "temas", "que enseñan", "qué enseñan", "que temas", "qué temas"],
    replyByLocale: {
      es: "En Coaching from Home contamos con 6 categorías principales diseñadas para impulsar tu crecimiento profesional y personal:\n\n1. 💻 **Tecnología y Programación:** Desarrollo Web, Mobile, Inteligencia Artificial, Cloud y DevOps.\n2. 🚀 **Negocios y Emprendimiento:** Startups, Estrategia Comercial, Finanzas y Ventas.\n3. 🌍 **Idiomas:** Inglés, Francés, Alemán, Coreano, Italiano y más.\n4. 📈 **Liderazgo y Carrera:** Gestión de Equipos, Oratoria, Negociación y Empleabilidad.\n5. 🧘‍♀️ **Bienestar y Mindset:** Manejo del Estrés, Productividad y Hábitos Saludables.\n6. 🎨 **Marketing y Diseño:** Marketing Digital, Redes Sociales, UX/UI y Branding.\n\n¿Te gustaría explorar coaches o cursos en alguna de estas categorías?",
      en: "At Coaching from Home, we offer 6 main categories to boost your professional and personal growth:\n\n1. 💻 **Technology & Programming:** Web & Mobile Dev, AI, Cloud, DevOps.\n2. 🚀 **Business & Entrepreneurship:** Startups, Strategy, Finance, Sales.\n3. 🌍 **Languages:** English, French, German, Korean, Italian, and more.\n4. 📈 **Leadership & Career:** Team Management, Public Speaking, Career Growth.\n5. 🧘‍♀️ **Wellness & Mindset:** Stress Management, Productivity, Healthy Habits.\n6. 🎨 **Marketing & Design:** Digital Marketing, Social Media, UX/UI, Branding.\n\nWould you like to explore coaches or courses in any of these areas?",
      ko: "Coaching from Home은 개인 및 커리어 성장을 위한 6가지 핵심 카테고리를 제공합니다:\n\n1. 💻 **기술 & 프로그래밍:** 웹/앱 개발, AI, 클라우드, 데브옵스\n2. 🚀 **비즈니스 & 창업:** 스타트업, 사업 전략, 재무, 영업\n3. 🌍 **외국어:** 영어, 프랑스어, 독일어, 한국어, 일본어 등\n4. 📈 **리더십 & 커리어:** 팀 관리, 스피치, 협상, 이직 및 취업\n5. 🧘‍♀️ **웰빙 & 마인드셋:** 스트레스 관리, 생산성, 건강한 습관\n6. 🎨 **마케팅 & 디자인:** 디지털 마케팅, SNS, UX/UI, 브랜딩\n\n관심 있는 분야의 코치나 강의를 찾아보시겠어요?"
    },
    suggestionsByLocale: {
      es: ["Ver coaches de Tecnología", "Cursos de Negocios", "Aprender Idiomas", "Prueba gratis 15 min"],
      en: ["Tech coaches", "Business courses", "Learn languages", "15-min free trial"],
      ko: ["IT 코치 보기", "비즈니스 강의", "외국어 학습", "15분 무료 체험"]
    },
    actions: [
      { label: "Ver Coaches por Categoría", href: "/coaches" },
      { label: "Ver Catálogo de Cursos", href: "/cursos" }
    ]
  },

  greeting: {
    keywords: ["hola", "buenos dias", "buenas tardes", "buenas noches", "saludos", "hello", "hi", "hey", "안녕", "hallo", "bonjour", "olá", "ola", "ciao", "привет", "مرحبا", "नमस्ते", "你好"],
    replyByLocale: {
      es: "¡Hola! Qué gusto saludarte. Soy Valeria, tu asesora virtual en Coaching from Home ✨ Estoy aquí para ayudarte a encontrar el coach ideal, explorar nuestros cursos certificados, o resolver cualquier duda sobre cómo funciona la plataforma. ¿En qué área profesional o habilidad te gustaría enfocarte?",
      en: "Hello! Nice to meet you. I'm Valeria, your virtual advisor at Coaching from Home ✨ I'm here to help you find the ideal coach, discover our certified courses, or answer any questions about the platform. What skill or goal would you like to focus on?",
      ko: "안녕하세요! 만나서 반가워요. 저는 Coaching from Home의 가상 어드바이저 발레리아입니다 ✨ 이상적인 코치 찾기, 전문 강의 탐색, 플랫폼 이용 방법 등 무엇이든 안내해 드릴게요. 어떤 목표에 관심이 있으신가요?"
    },
    suggestionsByLocale: {
      es: ["¿Qué categorías existen?", "¿Cómo funciona?", "Buscar un coach", "Prueba gratis 15 min"],
      en: ["What categories exist?", "How does it work?", "Find a coach", "15-min free trial"],
      ko: ["어떤 카테고리가 있나요?", "어떻게 작동하나요?", "코치 찾기", "15분 무료 체험"]
    },
    actions: [
      { label: "Explorar Coaches", href: "/coaches" },
      { label: "Ver Cursos", href: "/cursos" }
    ]
  },

  capabilities: {
    keywords: ["que puedes hacer", "qué puedes hacer", "que haces", "para que sirves", "quien eres", "quién eres", "what can you do", "who are you", "무엇을 할 수 있나요", "was kannst du", "que sais-tu faire"],
    replyByLocale: {
      es: "Como asesora de Coaching from Home, puedo orientarte en todo lo que necesites:\n\n• **Categorías:** Explicarte las 6 áreas principales (Tecnología, Negocios, Idiomas, Liderazgo, Bienestar y Marketing).\n• **Encontrar Coaches:** Recomendarte mentores según tu especialidad y presupuesto.\n• **Cursos Online:** Guiarte por nuestro catálogo de cursos en video con certificados.\n• **Sesiones 1 a 1:** Explicarte cómo agendar tu sesión con videollamada y pizarra interactiva.\n• **Prueba Gratuita:** Mostrarte cómo aprovechar las sesiones de 15 minutos sin costo.\n• **Planes para Coaches:** Explicarte cómo unirte como mentor y monetizar tu conocimiento.\n• **Precios y Pagos:** Informarte sobre pagos seguros con Stripe y garantías de reembolso.",
      en: "As your Coaching from Home advisor, I can assist you with:\n\n• **Categories:** Explaining our 6 core areas (Tech, Business, Languages, Leadership, Wellness, Marketing).\n• **Finding Coaches:** Recommending mentors tailored to your goals and budget.\n• **Online Courses:** Guiding you through our video course catalog with certificates.\n• **1-on-1 Sessions:** Explaining how to book video sessions with our collaborative whiteboard.\n• **Free Trials:** Showing you how to book 15-minute free intro sessions.\n• **Coach Onboarding:** Helping experts join as mentors and explore subscription tiers.\n• **Pricing & Billing:** Explaining Stripe secure checkout and refund guarantees.",
      ko: "Coaching from Home의 어드바이저로서 다음을 도와드릴 수 있습니다:\n\n• **카테고리 안내:** IT, 비즈니스, 어학, 리더십, 웰빙, 마케팅 등 6대 핵심 분야 소개\n• **코치 추천:** 목표와 예산에 맞는 멘토 연결\n• **온라인 강의:** 수료증 및 PDF 자료가 포함된 전문 동영상 강좌 안내\n• **1:1 라이브 세션:** 실시간 화상 회의 및 화이트보드 수업 이용 안내\n• **15분 무료 체험:** 부담 없이 멘토와 상담할 수 있는 무료 세션 안내\n• **코치 등록 및 플랜:** 전문가 코치 등록 및 구독 플랜 안내\n• **안전 결제 & 환불:** Stripe 결제 및 만족 보증 정책 안내"
    },
    suggestionsByLocale: {
      es: ["¿Qué categorías existen?", "Buscar un coach", "¿Cómo agendar?", "Quiero ser coach"],
      en: ["What categories exist?", "Find a coach", "How to book?", "Become a coach"],
      ko: ["어떤 카테고리가 있나요?", "코치 찾기", "예약 방법", "코치로 활동하기"]
    },
    actions: [
      { label: "Ver Coaches", href: "/coaches" },
      { label: "Explorar Cursos", href: "/cursos" }
    ]
  },

  how_it_works: {
    keywords: ["como funciona", "cómo funciona", "de que trata", "de qué trata", "que es coaching from home", "qué es coaching from home", "how it works", "what is cfh", "어떻게 작동하나요", "wie funktioniert"],
    replyByLocale: {
      es: "Coaching from Home funciona en 3 sencillos pasos:\n\n1. **Elige tu camino:** Explora nuestro directorio de coaches certificados o inscríbete en cursos prácticos en video.\n2. **Agenda o Aprende:** Reserva tu sesión 1 a 1 en el horario que más te convenga (¡muchos coaches ofrecen una primera sesión de 15 minutos gratis!).\n3. **Conéctate en vivo:** Ingresa a nuestra Aula Virtual con videollamada HD, pizarra interactiva colaborativa en tiempo real y chat integrado.",
      en: "Coaching from Home works in 3 simple steps:\n\n1. **Choose your path:** Explore our directory of certified coaches or enroll in on-demand video courses.\n2. **Book or Learn:** Schedule your 1-on-1 live session at your preferred time (many coaches offer a free 15-minute intro!).\n3. **Connect live:** Join our Virtual Classroom featuring HD video, a real-time collaborative whiteboard, and in-session chat.",
      ko: "Coaching from Home은 3단계로 쉽게 이용할 수 있습니다:\n\n1. **목표 선택:** 인증된 전문 코치 디렉토리를 탐색하거나 동영상 강의를 선택하세요.\n2. **예약 및 학습:** 원하는 시간에 1:1 라이브 세션을 예약하세요 (15분 무료 체험 가능!).\n3. **실시간 수업:** 고화질 화상 통화, 실시간 양방향 화이트보드, 채팅이 갖춰진 가상 강의실에 접속하세요."
    },
    suggestionsByLocale: {
      es: ["¿Qué categorías hay?", "Buscar coaches", "Prueba gratis 15 min", "Ver cursos"],
      en: ["What categories exist?", "Find coaches", "15-min free trial", "View courses"],
      ko: ["카테고리 종류", "코치 찾기", "15분 무료 체험", "강의 보기"]
    },
    actions: [
      { label: "Buscar Coaches", href: "/coaches" },
      { label: "Ver Cursos", href: "/cursos" }
    ]
  },

  coaches: {
    keywords: ["coach", "coaches", "mentor", "mentores", "buscar coach", "profesor", "tutor", "encontrar coach", "find coach", "코치", "mentors"],
    replyByLocale: {
      es: "Contamos con una red de coaches rigurosamente verificados en diversas áreas: Tecnología, Negocios, Idiomas, Liderazgo y Bienestar.\n\nEn el perfil de cada coach puedes ver su video de presentación, tarifas por hora, opiniones reales de otros alumnos y sus horarios disponibles en tu zona horaria. Además, ¡muchos ofrecen 15 minutos de prueba gratis!",
      en: "We have verified coaches across multiple disciplines: Technology, Business, Languages, Leadership, and Wellness.\n\nOn each coach's profile, you can watch their introduction video, view hourly rates, read verified reviews, and see availability in your local timezone. Many also offer a 15-minute free intro session!",
      ko: "IT 기술, 비즈니스, 외국어, 커리어 리더십 등 다양한 분야의 검증된 전문 코치들이 활동하고 있습니다.\n\n코치 프로필에서 소개 영상, 시간당 요금, 수강생 리뷰, 현지 시간대 기준 예약 가능 일정을 확인하실 수 있습니다. 15분 무료 상담 세션도 제공됩니다!"
    },
    suggestionsByLocale: {
      es: ["Prueba gratis 15 min", "¿Cómo agendar?", "Tarifas de coaches", "Ver categorías"],
      en: ["15-min free trial", "How to book?", "Coach rates", "Browse categories"],
      ko: ["15분 무료 체험", "예약 방법", "코치 요금", "카테고리 보기"]
    },
    actions: [
      { label: "Directorio de Coaches", href: "/coaches" }
    ]
  },

  free_trial: {
    keywords: ["prueba gratis", "gratis", "free trial", "15 min", "15 minutos", "sesion gratis", "sesión gratis", "free session", "무료 체험", "kostenlos"],
    replyByLocale: {
      es: "¡Sí! Muchos de nuestros coaches ofrecen una **sesión introductoria de 15 minutos completamente gratuita**.\n\nEs perfecta para conocer al mentor, plantear tus objetivos, revisar su metodología y comprobar si hay buena química antes de contratar sesiones completas. Busca el distintivo 'Prueba 15 min gratis' en el directorio de coaches.",
      en: "Yes! Many of our coaches offer a **15-minute introductory session completely free of charge**.\n\nIt's a great opportunity to meet the mentor, discuss your goals, evaluate their coaching style, and see if they're a good fit before booking paid sessions. Look for the '15-min Free Intro' badge in the coach directory.",
      ko: "네! 많은 코치들이 **15분 무료 인트로 세션**을 제공하고 있습니다.\n\n유료 결제 전 코치와 직접 대화하며 목표를 공유하고 코칭 스타일이 맞는지 부담 없이 확인할 수 있습니다. 코치 목록에서 '15분 무료 체험' 뱃지를 확인해보세요."
    },
    suggestionsByLocale: {
      es: ["Ver coaches con prueba gratis", "¿Cómo agendar?", "¿Necesito tarjeta?", "Ver cursos"],
      en: ["Find coaches with free intro", "How to book?", "Do I need a card?", "View courses"],
      ko: ["무료 체험 코치 보기", "예약 방법", "카드 등록 필요한가요?", "강의 보기"]
    },
    actions: [
      { label: "Ver Coaches con Prueba Gratis", href: "/coaches" }
    ]
  },

  courses: {
    keywords: ["curso", "cursos", "course", "courses", "clases grabadas", "aprender", "certificados", "certificado", "bunny", "강의", "kurse", "cours"],
    replyByLocale: {
      es: "Nuestros cursos online están diseñados para el aprendizaje práctico y a tu propio ritmo:\n\n• **Acceso de por vida:** Mira las lecciones cuantas veces quieras en alta definición.\n• **Materiales descargables:** Ejercicios, plantillas y lecturas en PDF.\n• **Certificado de finalización:** Acredita tus nuevas competencias al terminar.\n• **Garantía:** Respaldados por nuestra política de satisfacción.",
      en: "Our digital courses are designed for practical, self-paced learning:\n\n• **Lifetime Access:** Watch HD lessons anytime, anywhere.\n• **Downloadable Materials:** Worksheets, templates, and PDF guides.\n• **Certificate of Completion:** Verify and showcase your achievement upon finishing.\n• **Backed by Guarantee:** Fully protected by our satisfaction policy.",
      ko: "온라인 강의는 실무 중심의 자기주도 학습으로 구성되어 있습니다:\n\n• **평생 소장:** 고화질 동영상 강의를 언제든 무제한 시청 가능\n• **다운로드 학습 자료:** PDF 실습 가이드 및 템플릿 제공\n• **공식 수료증:** 코스 완료 시 검증 가능한 디지털 수료증 발급\n• **만족 보증:** 신뢰할 수 있는 플랫폼 환불 및 만족 보증 제공"
    },
    suggestionsByLocale: {
      es: ["Explorar cursos", "¿Tienen certificados?", "Ver coaches", "¿Cómo pagar?"],
      en: ["Browse courses", "Are certificates included?", "Find coaches", "How to pay?"],
      ko: ["강의 둘러보기", "수료증이 발급되나요?", "코치 찾기", "결제 방법"]
    },
    actions: [
      { label: "Explorar Cursos", href: "/cursos" }
    ]
  },

  pricing_payments: {
    keywords: ["precio", "precios", "cuanto cuesta", "cuánto cuesta", "costo", "costos", "tarifa", "tarifas", "pagar", "pago", "stripe", "tarjeta", "price", "pricing", "cost", "pay", "payment", "가격", "비용"],
    replyByLocale: {
      es: "En Coaching from Home manejamos precios transparentes y sin sorpresas:\n\n• **Sesiones 1 a 1:** Cada coach define su tarifa horaria (generalmente entre $20 USD y $120+ USD). ¡Muchos ofrecen los primeros 15 minutos gratis!\n• **Cursos Online:** Pago único con acceso de por vida y materiales incluidos.\n• **Pagos Seguros:** Todas las transacciones se procesan mediante Stripe con cifrado bancario, aceptando tarjetas Visa, Mastercard y American Express.",
      en: "Pricing at Coaching from Home is clear and transparent:\n\n• **1-on-1 Sessions:** Each coach sets their own hourly rate (typically between $20 USD and $120+ USD). Many offer a free 15-minute intro!\n• **Online Courses:** One-time payment with lifetime access and all materials included.\n• **Secure Payments:** All transactions are securely processed via Stripe with bank-grade encryption, accepting Visa, Mastercard, and Amex.",
      ko: "Coaching from Home은 투명한 가격 정책을 제공합니다:\n\n• **1:1 세션:** 코치가 시간당 요금을 직접 설정합니다 (보통 $20 ~ $120+ USD). 15분 무료 체험도 가능합니다!\n• **온라인 코스:** 1회 결제로 평생 소장 및 자료 이용 가능\n• **안전 결제:** Stripe 보안 결제 시스템을 통해 비자, 마스터카드, 아멕스 등 글로벌 카드를 안전하게 지원합니다."
    },
    suggestionsByLocale: {
      es: ["Ver coaches", "Prueba gratis 15 min", "¿Tienen reembolsos?", "Ver cursos"],
      en: ["Browse coaches", "15-min free trial", "Refund policy", "View courses"],
      ko: ["코치 목록 보기", "15분 무료 체험", "환불 규정", "강의 보기"]
    },
    actions: [
      { label: "Ver Tarifas de Coaches", href: "/coaches" },
      { label: "Ver Cursos", href: "/cursos" }
    ]
  },

  become_coach: {
    keywords: [
      "quiero ser coach", "ser coach", "unirse como coach", "enseñar", "dar clases",
      "coach onboarding", "planes de coach", "planes para coaches", "become a coach",
      "teach", "코치 등록", "코치 지원", "como me registro como coach", "cómo me registro como coach",
      "registrarme como coach", "registro de coach", "registrarse como coach", "registro coach",
      "cómo ser coach", "como ser coach", "postular como coach", "dar tutorias", "dar asesorias"
    ],
    replyByLocale: {
      es: "¡Nos encantaría que formes parte de nuestra comunidad de mentores! Registrarte como Coach es muy fácil:\n\n1. Haz clic en el botón **\"Registrarse\"** en la barra superior (o pulsa el botón directo **\"Registrarme como Coach\"** abajo).\n2. Selecciona la opción **\"Quiero Enseñar (Coach)\"**.\n3. Completa tu perfil profesional: especialidad, biografía, video de bienvenida y tu tarifa por hora.\n4. Elige tu membresía: puedes comenzar completamente gratis con el **Plan Básico**, u optar por planes avanzados (Only Courses, Elite, Gold o Platinum).\n5. Vincula tu cuenta bancaria de forma segura con Stripe Connect para recibir los cobros de tus sesiones y cursos directamente.\n\n¿Tienes alguna duda sobre los requisitos o los planes disponibles?",
      en: "We would love to have you on our team of mentors! Registering as a Coach is quick and easy:\n\n1. Click the **\"Sign Up\"** button in the top navigation bar (or click the **\"Register as Coach\"** button below).\n2. Choose the **\"I want to teach (Coach)\"** option.\n3. Fill in your professional details: expertise, bio, intro video, and hourly rate.\n4. Pick your membership plan: get started completely free with the **Basic Plan**, or explore advanced tiers (Only Courses, Elite, Gold, Platinum).\n5. Connect your payout method securely via Stripe Connect to receive earnings directly into your bank account.\n\nDo you have questions about requirements or membership tiers?",
      ko: "전문가 멘토로 함께 활동해보세요! 코치로 등록하는 방법은 매우 간단합니다:\n\n1. 상단 메뉴의 **'회원가입'** 버튼을 클릭하거나 아래 바로가기 버튼 **'코치 등록하기'**를 누르세요.\n2. **'코치로 시작하기(가르치기)'** 옵션을 선택합니다.\n3. 전문 분야, 소개글, 소개 영상, 시간당 코칭 요금을 입력하여 프로필을 완성하세요.\n4. 멤버십 플랜을 선택하세요: **기본 플랜(무료)**으로 부담 없이 시작하거나 유료 플랜을 이용할 수 있습니다.\n5. Stripe Connect를 통해 정산 계좌를 안전하게 연결하면 바로 활동을 시작할 수 있습니다.\n\n플랜이나 자격 요건에 대해 궁금한 점이 있으신가요?"
    },
    suggestionsByLocale: {
      es: ["Registrarme como coach", "Planes y comisiones", "¿Cómo cobro mis clases?", "¿Qué requisitos piden?"],
      en: ["Register as a coach", "Plans & fees", "How do payouts work?", "What are the requirements?"],
      ko: ["코치로 등록하기", "플랜 및 수수료", "수익 정산 방식", "코치 자격 요건"]
    },
    actions: [
      { label: "Registrarme como Coach", href: "/coach/onboarding" },
      { label: "Crear Cuenta", href: "/auth/register" }
    ]
  },

  classroom: {
    keywords: ["aula", "aula virtual", "pizarra", "whiteboard", "videollamada", "como es la clase", "cómo es la clase", "classroom", "화상 수업", "화이트보드"],
    replyByLocale: {
      es: "Nuestra Aula Virtual está integrada en tu navegador, sin necesidad de instalar apps externas:\n\n• **Videollamada en alta calidad** con audio nítido.\n• **Pizarra interactiva (Whiteboard):** Dibuja, escribe notas y comparte diagramas en tiempo real con tu coach.\n• **Compartir pantalla y archivos:** Ideal para revisar código, presentaciones o documentos.\n• **Chat de sesión:** Para enlaces y notas rápidas durante la clase.",
      en: "Our Virtual Classroom runs directly in your browser with no downloads required:\n\n• **High-Definition Video & Audio** via secure WebRTC.\n• **Interactive Collaborative Whiteboard:** Sketch, write notes, and brainstorm live with your mentor.\n• **Screen & File Sharing:** Perfect for code reviews, presentations, or documents.\n• **In-session Chat:** Share quick links, notes, and messages seamlessly.",
      ko: "가상 강의실은 별도 프로그램 설치 없이 브라우저에서 바로 실행됩니다:\n\n• **고화질 영상 & 음성 통화** (보안 WebRTC)\n• **실시간 인터랙티브 화이트보드:** 코치와 함께 실시간으로 필기, 다이어그램 작성 및 브레인스토밍\n• **화면 공유 및 파일 전송:** 코드 리뷰, 발표 자료, 문서 검토에 최적화\n• **인세션 실시간 채팅:** 유용한 링크와 메모를 즉시 공유"
    },
    suggestionsByLocale: {
      es: ["Buscar coaches", "Prueba gratis 15 min", "Ver cursos", "¿Cómo funciona?"],
      en: ["Find coaches", "15-min free trial", "View courses", "How does it work?"],
      ko: ["코치 찾기", "15분 무료 체험", "강의 보기", "이용 방법"]
    },
    actions: [
      { label: "Ver Coaches", href: "/coaches" }
    ]
  },

  guarantee_refunds: {
    keywords: ["garantia", "garantía", "reembolso", "devolucion", "devolución", "cancelar", "cancelacion", "cancelación", "refund", "guarantee", "환불", "취소", "보증"],
    replyByLocale: {
      es: "En Coaching from Home tu satisfacción está 100% protegida:\n\n• **Cancelación con 24h de anticipación:** Recibes reembolso total o crédito para reprogramar sin costo alguno.\n• **Problemas técnicos:** Si ocurre una falla técnica durante la sesión, nuestro equipo de soporte gestiona la reprogramación inmediata o devolución.\n• **Garantía de calidad:** Nos aseguramos de que cada sesión cumpla con los más altos estándares.",
      en: "Your experience at Coaching from Home is 100% protected:\n\n• **24-Hour Notice Cancellation:** Receive a full refund or free rescheduling credit if cancelled at least 24 hours in advance.\n• **Technical Issues:** If a technical glitch occurs during your session, support will promptly reschedule or issue a refund.\n• **Quality Guarantee:** We ensure all sessions and courses meet high educational standards.",
      ko: "수강생 여러분의 권리는 100% 안전하게 보호됩니다:\n\n• **24시간 전 취소:** 세션 시작 24시간 전 취소 시 전액 환불 또는 무료 재예약 크레딧 제공\n• **기술적 문제 지원:** 플랫폼 기술 장애 발생 시 고객센터를 통해 즉시 재예약 또는 전액 환불 조치\n• **품질 보증:** 엄격한 코치 인증과 신뢰할 수 있는 강의 품질을 보장합니다."
    },
    suggestionsByLocale: {
      es: ["Términos y condiciones", "Contactar soporte", "Buscar coaches", "Ver cursos"],
      en: ["Terms & Conditions", "Contact support", "Find coaches", "View courses"],
      ko: ["이용약관 확인", "고객센터 문의", "코치 찾기", "강의 보기"]
    },
    actions: [
      { label: "Ver Términos y Condiciones", href: "/terms" },
      { label: "Contactar Soporte", href: "/contact" }
    ]
  },

  support_contact: {
    keywords: ["contacto", "soporte", "ayuda", "correo", "email", "telefono", "problema", "contact", "support", "help", "고객센터", "문의"],
    replyByLocale: {
      es: "¡Nuestro equipo de soporte humano está a tu disposición!\n\n• **Correo de atención:** contact@coachingfromhome.com.mx\n• **Soporte técnico:** help@coachingfromhome.com.mx\n• **Formulario web:** Puedes enviarnos un mensaje directo usando el botón de Contacto abajo o al pie de página.\n\nRespondemos a todas las consultas en un plazo máximo de 24 horas hábiles.",
      en: "Our human support team is ready to help you!\n\n• **General Inquiries:** contact@coachingfromhome.com.mx\n• **Technical Support:** help@coachingfromhome.com.mx\n• **Contact Form:** Send us a direct message via the Contact button below or the footer.\n\nWe respond to all requests within 24 business hours.",
      ko: "고객 지원팀이 신속하고 친절하게 도와드립니다!\n\n• **일반 문의:** contact@coachingfromhome.com.mx\n• **기술 지원:** help@coachingfromhome.com.mx\n• **온라인 문의:** 아래 문의하기 버튼이나 페이지 하단의 문의 양식을 통해 직접 메시지 전송 가능\n\n영업일 기준 24시간 이내에 신속히 답변 드립니다."
    },
    suggestionsByLocale: {
      es: ["Ir a contacto", "¿Cómo funciona la plataforma?", "Buscar coaches", "Ver cursos"],
      en: ["Go to contact", "How does the platform work?", "Find coaches", "View courses"],
      ko: ["문의하기", "플랫폼 이용 방법", "코치 찾기", "강의 보기"]
    },
    actions: [
      { label: "Contactar Soporte", href: "/contact" }
    ]
  }
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchKnowledgeBase(query: string, locale: string) {
  const norm = normalizeText(query);
  const lang = (locale || "es").toLowerCase().slice(0, 2);

  let bestMatch: KnowledgeIntent | null = null;
  let maxKeywordLength = 0;

  for (const [, data] of Object.entries(KNOWLEDGE_BASE)) {
    for (const kw of data.keywords) {
      const normKw = normalizeText(kw);
      if (norm.includes(normKw) && normKw.length > maxKeywordLength) {
        maxKeywordLength = normKw.length;
        bestMatch = data;
      }
    }
  }

  if (bestMatch) {
    const reply = bestMatch.replyByLocale[lang] || bestMatch.replyByLocale["es"] || bestMatch.replyByLocale["en"] || "";
    const suggestions = bestMatch.suggestionsByLocale[lang] || bestMatch.suggestionsByLocale["es"] || bestMatch.suggestionsByLocale["en"] || [];
    return {
      reply,
      suggestions,
      actions: bestMatch.actions
    };
  }

  // Fallback si no hay coincidencia exacta de palabras clave
  const fallbackReplies: Record<string, string> = {
    es: "¡Excelente pregunta! En Coaching from Home puedes conectar con coaches certificados en sesiones 1 a 1 en vivo (¡muchos con prueba gratis de 15 min!) o capacitarte con nuestros cursos digitales con certificado. Contamos con 6 áreas: Tecnología, Negocios, Idiomas, Liderazgo, Bienestar y Marketing. ¿Te gustaría buscar un coach en un área específica o ver nuestro catálogo de cursos?",
    en: "Great question! At Coaching from Home, you can connect with certified coaches for live 1-on-1 sessions (many offering a 15-min free trial!) or learn through our certified video courses across 6 categories: Tech, Business, Languages, Leadership, Wellness, and Marketing. Would you like to explore coaches or browse our course catalog?",
    ko: "좋은 질문입니다! Coaching from Home에서는 1:1 라이브 화상 세션(15분 무료 체험 제공!)을 통해 전문 코치를 만나거나, IT, 비즈니스, 외국어 등 6대 카테고리의 동영상 코스로 학습할 수 있습니다. 특정 분야의 코치를 찾고 계신가요, 아니면 강의 목록을 둘러보고 싶으신가요?"
  };

  const defaultSuggestions: Record<string, string[]> = {
    es: ["¿Qué categorías existen?", "Buscar coaches", "Cursos disponibles", "Prueba gratis 15 min"],
    en: ["What categories exist?", "Find coaches", "Available courses", "15-min free trial"],
    ko: ["어떤 카테고리가 있나요?", "코치 찾기", "추천 강의", "15분 무료 체험"]
  };

  return {
    reply: sanitizeReplyRoutes(fallbackReplies[lang] || fallbackReplies["es"] || "", lang),
    suggestions: defaultSuggestions[lang] || defaultSuggestions["es"] || [],
    actions: [
      { label: lang === "en" ? "Explore Coaches" : lang === "ko" ? "코치 둘러보기" : "Explorar Coaches", href: "/coaches" },
      { label: lang === "en" ? "View Courses" : lang === "ko" ? "강의 보기" : "Ver Cursos", href: "/cursos" }
    ]
  };
}

// Filtro sanitizador para transformar cualquier ruta técnica accidental a lenguaje de interfaz amigable
function sanitizeReplyRoutes(text: string, locale: string = "es"): string {
  if (!text) return text;

  let sanitized = text;

  // 1. Eliminar referencias directas entre paréntesis como (/coaches), (/coach/onboarding), (/cursos)
  sanitized = sanitized.replace(/\s*\(\s*\/[a-zA-Z0-9_\-\/]+\s*\)/gi, "");

  // 2. Reemplazos semánticos según el idioma para transformar rutas a elementos visuales de la interfaz
  const isEn = locale.startsWith("en");
  const isKo = locale.startsWith("ko");

  if (isEn) {
    sanitized = sanitized
      .replace(/\b(?:at|in)\s+\/coach\/onboarding\b/gi, "in the Coach Registration section")
      .replace(/\b(?:to)\s+\/coach\/onboarding\b/gi, "to the Coach Registration section")
      .replace(/\/coach\/onboarding\b/gi, "the Coach Registration button")
      .replace(/\b(?:at|in)\s+\/auth\/register\b/gi, "via the Sign Up button")
      .replace(/\b(?:to)\s+\/auth\/register\b/gi, "to the Sign Up button")
      .replace(/\/auth\/register\b/gi, "the Sign Up button")
      .replace(/\b(?:at|in)\s+\/auth\/signin\b/gi, "via the Sign In button")
      .replace(/\b(?:to)\s+\/auth\/signin\b/gi, "to the Sign In button")
      .replace(/\/auth\/signin\b/gi, "the Sign In button")
      .replace(/\b(?:at|in)\s+\/coaches\b/gi, "in the Coaches tab")
      .replace(/\b(?:to)\s+\/coaches\b/gi, "to the Coaches tab")
      .replace(/\/coaches\b/gi, "the Coaches tab")
      .replace(/\b(?:at|in)\s+\/cursos\b/gi, "in the Courses tab")
      .replace(/\b(?:to)\s+\/cursos\b/gi, "to the Courses tab")
      .replace(/\/cursos\b/gi, "the Courses tab")
      .replace(/\b(?:at|in)\s+\/dashboard\b/gi, "in your Dashboard")
      .replace(/\b(?:to)\s+\/dashboard\b/gi, "to your Dashboard")
      .replace(/\/dashboard\b/gi, "your Dashboard")
      .replace(/\b(?:at|in)\s+\/contact\b/gi, "in the Contact section")
      .replace(/\b(?:to)\s+\/contact\b/gi, "to the Contact section")
      .replace(/\/contact\b/gi, "the Contact section");
  } else if (isKo) {
    sanitized = sanitized
      .replace(/\/coach\/onboarding\b/gi, "코치 등록 메뉴")
      .replace(/\/auth\/register\b/gi, "회원가입 버튼")
      .replace(/\/auth\/signin\b/gi, "로그인 버튼")
      .replace(/\/coaches\b/gi, "코치 탭")
      .replace(/\/cursos\b/gi, "강의 탭")
      .replace(/\/dashboard\b/gi, "대시보드")
      .replace(/\/contact\b/gi, "고객 문의");
  } else {
    // Español (default) y otros idiomas
    sanitized = sanitized
      .replace(/\ben\s+\/coach\/onboarding\b/gi, "en el apartado de Registro de Coach")
      .replace(/\b(?:a|al|hacia)\s+\/coach\/onboarding\b/gi, "al apartado de Registro de Coach")
      .replace(/\/coach\/onboarding\b/gi, "el botón de Registro de Coach")
      .replace(/\ben\s+\/auth\/register\b/gi, "con el botón de Registrarse")
      .replace(/\b(?:a|al|hacia)\s+\/auth\/register\b/gi, "al botón de Registrarse")
      .replace(/\/auth\/register\b/gi, "el botón de Registrarse")
      .replace(/\ben\s+\/auth\/signin\b/gi, "con el botón de Iniciar Sesión")
      .replace(/\b(?:a|al|hacia)\s+\/auth\/signin\b/gi, "al botón de Iniciar Sesión")
      .replace(/\/auth\/signin\b/gi, "el botón de Iniciar Sesión")
      .replace(/\ben\s+\/coaches\b/gi, "en la pestaña de Coaches")
      .replace(/\b(?:a|al|hacia)\s+\/coaches\b/gi, "a la pestaña de Coaches")
      .replace(/\/coaches\b/gi, "la pestaña de Coaches")
      .replace(/\ben\s+\/cursos\b/gi, "en la pestaña de Cursos")
      .replace(/\b(?:a|al|hacia)\s+\/cursos\b/gi, "a la pestaña de Cursos")
      .replace(/\/cursos\b/gi, "la pestaña de Cursos")
      .replace(/\ben\s+\/dashboard\b/gi, "en tu Panel de Control")
      .replace(/\b(?:a|al|hacia)\s+\/dashboard\b/gi, "a tu Panel de Control")
      .replace(/\/dashboard\b/gi, "tu Panel de Control")
      .replace(/\ben\s+\/contact\b/gi, "en la sección de Contacto")
      .replace(/\b(?:a|al|hacia)\s+\/contact\b/gi, "a la sección de Contacto")
      .replace(/\/contact\b/gi, "la sección de Contacto")
      .replace(/\ben\s+\/terms\b/gi, "en los Términos y Condiciones")
      .replace(/\b(?:a|al|hacia)\s+\/terms\b/gi, "a los Términos y Condiciones")
      .replace(/\/terms\b/gi, "los Términos y Condiciones");
  }

  // 3. Limpiar cualquier ruta restante residual con barra diagonal tipo /algo
  sanitized = sanitized.replace(/(?<=\s|^)\/[a-zA-Z0-9_\-\/]+(?=[\s\.,;!?]|$)/g, "");

  // 4. Normalizar espacios y puntuación
  return sanitized
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

async function callGeminiApi(userMessage: string, history: ChatMessage[] = [], locale: string = "es") {
  const apiKey = getGeminiApiKey();
  if (!apiKey || (!apiKey.startsWith("AIza") && !apiKey.startsWith("AQ."))) {
    return null;
  }

  // Preparar historial compatible con Gemini API
  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  if (Array.isArray(history)) {
    for (const h of history.slice(-6)) {
      if (h.text && h.role) {
        contents.push({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.text }]
        });
      }
    }
  }

  // Añadir mensaje actual
  contents.push({
    role: "user",
    parts: [{ text: userMessage }]
  });

  const languagePrompt = `Idioma preferido para responder: ${locale.toUpperCase()}. Si el usuario escribe en otro idioma, responde en el idioma del usuario.
REGLA OBLIGATORIA: NUNCA menciones URLs ni rutas técnicas con barras diagonales (como /coach/onboarding, /cursos, /coaches, /dashboard, etc.). Describe siempre botones, pestañas y elementos visuales con los que el usuario interactúa directamente.`;

  const modelsToTry = [
    "models/gemini-3.5-flash-lite",
    "models/gemini-3.8-flash",
    "models/gemini-flash-latest"
  ];

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: `${SYSTEM_PROMPT}\n\n${languagePrompt}` }]
          },
          contents,
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 600
          }
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && typeof text === "string" && text.trim().length > 0) {
          return sanitizeReplyRoutes(text.trim(), locale);
        }
      } else {
        const errText = await response.text();
        console.warn(`[Valeria] Gemini ${model} status ${response.status}: ${errText.slice(0, 200)}`);
      }
    } catch (err: any) {
      console.warn(`[Valeria] Gemini ${model} fetch exception:`, err?.message || err);
      // Intentar siguiente modelo o saltar a fallback local
    }
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestPayload;
    const message = body?.message?.trim() || "";
    const history = body?.history || [];
    const locale = (body?.locale || "es").toLowerCase();

    if (!message) {
      return NextResponse.json({ error: "El mensaje no puede estar vacío" }, { status: 400 });
    }

    // 1. Intentar llamar al modelo Gemini con el contexto de la plataforma
    const geminiReply = await callGeminiApi(message, history, locale);

    if (geminiReply) {
      const cleanReply = sanitizeReplyRoutes(geminiReply, locale);

      // Detectar acciones sugeridas según el contexto de la conversación
      const actions: { label: string; href: string }[] = [];
      const lowerReply = cleanReply.toLowerCase();
      const lowerMsg = message.toLowerCase();
      const lang = locale.slice(0, 2);

      const isCoachOnboarding = 
        (lowerMsg.includes("coach") && (
          lowerMsg.includes("registr") || lowerMsg.includes("unir") || lowerMsg.includes("ser ") || 
          lowerMsg.includes("ensenar") || lowerMsg.includes("enseñar") || lowerMsg.includes("cuenta") || 
          lowerMsg.includes("dar clase") || lowerMsg.includes("postul") || lowerMsg.includes("onboard")
        )) ||
        lowerReply.includes("quiero enseñar") || lowerReply.includes("plan básico") || 
        lowerReply.includes("stripe connect") || lowerReply.includes("registro de coach") || 
        lowerReply.includes("coach onboarding");

      if (isCoachOnboarding) {
        if (lang === "en") {
          actions.push({ label: "Register as Coach", href: "/coach/onboarding" });
          actions.push({ label: "Sign Up", href: "/auth/register" });
        } else if (lang === "ko") {
          actions.push({ label: "코치 등록하기", href: "/coach/onboarding" });
          actions.push({ label: "회원가입", href: "/auth/register" });
        } else {
          actions.push({ label: "Registrarme como Coach", href: "/coach/onboarding" });
          actions.push({ label: "Crear Cuenta", href: "/auth/register" });
        }
      } else if (lowerReply.includes("coach") || lowerReply.includes("mentor") || lowerMsg.includes("coach") || lowerMsg.includes("mentor")) {
        if (lang === "en") {
          actions.push({ label: "Explore Coaches", href: "/coaches" });
        } else if (lang === "ko") {
          actions.push({ label: "코치 둘러보기", href: "/coaches" });
        } else {
          actions.push({ label: "Explorar Coaches", href: "/coaches" });
        }
      }

      if (lowerReply.includes("curso") || lowerReply.includes("course") || lowerReply.includes("categoría") || lowerReply.includes("categoria") || lowerMsg.includes("curso")) {
        if (lang === "en") {
          actions.push({ label: "View Courses", href: "/cursos" });
        } else if (lang === "ko") {
          actions.push({ label: "강의 보기", href: "/cursos" });
        } else {
          actions.push({ label: "Ver Cursos", href: "/cursos" });
        }
      }

      if (lowerReply.includes("contact") || lowerReply.includes("soporte") || lowerReply.includes("support") || lowerMsg.includes("ayuda") || lowerMsg.includes("soporte")) {
        if (lang === "en") {
          actions.push({ label: "Contact Support", href: "/contact" });
        } else if (lang === "ko") {
          actions.push({ label: "고객 문의", href: "/contact" });
        } else {
          actions.push({ label: "Contactar Soporte", href: "/contact" });
        }
      }

      if (lowerMsg.includes("iniciar sesion") || lowerMsg.includes("iniciar sesión") || lowerMsg.includes("login") || lowerMsg.includes("sign in")) {
        if (lang === "en") {
          actions.push({ label: "Sign In", href: "/auth/signin" });
        } else if (lang === "ko") {
          actions.push({ label: "로그인", href: "/auth/signin" });
        } else {
          actions.push({ label: "Iniciar Sesión", href: "/auth/signin" });
        }
      }

      // Sugerencias dinámicas según el tema
      let suggestions: string[];
      if (isCoachOnboarding) {
        if (lang === "en") {
          suggestions = ["Coach requirements?", "Plans & fees", "How do payouts work?", "Explore coaches"];
        } else if (lang === "ko") {
          suggestions = ["코치 자격 요건", "플랜 및 수수료", "수익 정산 방식", "코치 둘러보기"];
        } else {
          suggestions = ["¿Qué requisitos piden?", "Planes y comisiones", "¿Cómo cobro con Stripe?", "Explorar coaches"];
        }
      } else {
        const defaultSuggestions: Record<string, string[]> = {
          es: ["¿Qué categorías existen?", "Buscar un coach", "Cursos disponibles", "Prueba gratis 15 min"],
          en: ["What categories exist?", "Find a coach", "Available courses", "15-min free trial"],
          ko: ["어떤 카테고리가 있나요?", "코치 찾기", "추천 강의", "15분 무료 체험"]
        };
        suggestions = defaultSuggestions[lang] || defaultSuggestions["es"] || [];
      }

      return NextResponse.json({
        reply: cleanReply,
        suggestions,
        actions: actions.length > 0 ? actions : [
          { label: lang === "en" ? "Explore Coaches" : lang === "ko" ? "코치 둘러보기" : "Explorar Coaches", href: "/coaches" },
          { label: lang === "en" ? "View Courses" : lang === "ko" ? "강의 보기" : "Ver Cursos", href: "/cursos" }
        ],
        source: "ai"
      });
    }

    // 2. Si no hay API key o la cuota se agotó, usar la Base de Conocimiento Inteligente local
    const fallbackData = matchKnowledgeBase(message, locale);
    return NextResponse.json({
      reply: sanitizeReplyRoutes(fallbackData.reply || "", locale),
      suggestions: fallbackData.suggestions,
      actions: fallbackData.actions,
      source: "knowledge_base"
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        reply: "Disculpa, hubo un breve inconveniente. Estoy aquí para ayudarte: ¿te gustaría explorar nuestros coaches o conocer nuestros cursos?",
        suggestions: ["¿Qué categorías existen?", "Buscar un coach", "Cursos disponibles", "Prueba gratis 15 min"],
        actions: [
          { label: "Explorar Coaches", href: "/coaches" },
          { label: "Ver Cursos", href: "/cursos" }
        ],
        source: "error_fallback"
      },
      { status: 200 }
    );
  }
}
