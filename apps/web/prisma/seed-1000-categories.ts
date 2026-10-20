import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Lista completa de categorías profesionales, educativas, tecnológicas, empresariales y creativas (1,000 categorías)
// Excluyendo rigurosamente salud médica, medicina, farmacología, psicología clínica, nutrición clínica o diagnósticos.
const rawCategories = [
  // --- TECNOLOGÍA & DESARROLLO DE SOFTWARE ---
  "Desarrollo Web Frontend", "Desarrollo Web Backend", "Desarrollo Full Stack", "JavaScript Avanzado", "TypeScript",
  "React.js", "Next.js", "Vue.js", "Angular", "Svelte", "Node.js", "Express.js", "NestJS", "Python para Desarrolladores",
  "Django", "FastAPI", "Flask", "Java Empresarial", "Spring Boot", "C# y .NET", "ASP.NET Core", "PHP Moderno", "Laravel",
  "Symfony", "Ruby on Rails", "Go (Golang)", "Rust para Sistemas", "C++ Moderno", "Programación en C", "Swift para iOS",
  "Desarrollo iOS con SwiftUI", "Kotlin para Android", "Desarrollo Android con Jetpack Compose", "Flutter Multiplataforma",
  "React Native", "Desarrollo Móvil Híbrido", "Arquitectura de Software", "Microservicios", "APIs RESTful", "GraphQL",
  "gRPC", "WebSockets y Tiempo Real", "Patrones de Diseño de Software", "Clean Code y Refactorización", "Testing con Jest",
  "Testing End-to-End con Cypress", "Playwright Automation", "TDD (Test-Driven Development)", "DevOps Básico",
  "Integración Continua con GitHub Actions", "GitLab CI/CD", "Docker y Contenedores", "Kubernetes en Producción",
  "Terraform e Infraestructura como Código", "Ansible Automation", "Linux para Administradores de Sistemas", "Bash Scripting",
  "PowerShell Scripting", "Amazon Web Services (AWS)", "Microsoft Azure", "Google Cloud Platform (GCP)", "Serverless Computing",
  "Arquitectura Cloud Nativa", "Seguridad en la Nube", "Monitoreo con Prometheus y Grafana", "Site Reliability Engineering (SRE)",
  "Bases de Datos Relacionales", "PostgreSQL Avanzado", "MySQL y MariaDB", "Oracle Database", "Microsoft SQL Server",
  "Bases de Datos NoSQL", "MongoDB", "Redis y Caché", "Cassandra", "Neo4j y Bases de Datos Grafos", "Optimización de Consultas SQL",
  "Seguridad Informática Ofensiva", "Ethical Hacking", "Ciberseguridad Defensiva", "Seguridad de Redes", "Criptografía Aplicada",
  "OWASP y Seguridad Web", "Análisis Forense Digital", "Gestión de Vulnerabilidades", "Seguridad en APIs", "Zero Trust Architecture",
  "Blockchain y Criptomonedas", "Desarrollo de Smart Contracts", "Solidity", "Web3 y DApps", "Ethereum y EVM",
  "Protocolos DeFi", "Tokenomics", "Seguridad en Smart Contracts", "Hyperledger Fabric", "Computación Cuántica Teórica",

  // --- INTELIGENCIA ARTIFICIAL & CIENCIA DE DATOS ---
  "Inteligencia Artificial General", "Machine Learning con Scikit-Learn", "Deep Learning con PyTorch", "Deep Learning con TensorFlow",
  "Procesamiento del Lenguaje Natural (NLP)", "Modelos de Lenguaje Grande (LLMs)", "Ingeniería de Prompts", "LangChain y Agentes IA",
  "LlamaIndex", "Fine-tuning de Modelos de IA", "Visión por Computadora con OpenCV", "Reconocimiento Facial", "YOLO y Detección de Objetos",
  "Generación de Imágenes con IA", "Audio y Voz con Inteligencia Artificial", "Redes Neuronales Convolucionales (CNN)",
  "Redes Neuronales Recurrentes (RNN y LSTM)", "Transformers y Mecanismos de Atención", "Aprendizaje por Refuerzo",
  "IA Explicable y Ética en IA", "MLOps y Despliegue de Modelos", "Ciencia de Datos con Python", "Análisis de Datos con Pandas",
  "Visualización de Datos con Seaborn y Plotly", "R para Estadística", "Minería de Datos", "Modelado Predictivo",
  "Big Data con Apache Spark", "Apache Kafka para Streaming", "Hadoop Ecosystem", "Databricks y Lakehouses",
  "Snowflake para Data Warehousing", "Google BigQuery", "Amazon Redshift", "ETL y Pipelines de Datos con Airflow",
  "dbt (data build tool)", "Gobierno de Datos", "Business Intelligence con Power BI", "Modelado DAX en Power BI",
  "Tableau para Visualización de Negocios", "Looker Studio", "Excel Avanzado y Tablas Dinámicas", "Macros y VBA en Excel",
  "Power Query y Automatización de Hojas", "Estadística para Analistas de Negocios", "Álgebra Lineal Computacional",

  // --- NEGOCIOS, FINANZAS & GESTIÓN EMPRESARIAL ---
  "Administración de Empresas", "Estrategia Empresarial", "Creación de Startups", "Modelo de Negocio Lean Canvas",
  "Desarrollo de Clientes y Validación", "Venture Capital y Rondas de Inversión", "Finanzas Corporativas", "Contabilidad Financiera",
  "Contabilidad de Costos", "Auditoría Financiera", "Análisis de Estados Financieros", "Planeación Financiera y Presupuestos",
  "Gestión de Flujo de Caja", "Finanzas Personales e Inversión", "Inversión en Bolsa de Valores", "Trading Cuantitativo",
  "Análisis Técnico de Mercados", "Análisis Fundamental de Acciones", "Fondos Indexados y ETFs", "Bienes Raíces y Real Estate",
  "Valuación de Empresas", "Fusiones y Adquisiciones (M&A)", "Economía para Negocios", "Microeconomía Aplicada",
  "Macroeconomía Global", "Comercio Internacional", "Importación y Exportación", "Gestión Aduanera", "Logística y Cadena de Suministro",
  "Gestión de Inventarios", "Compras Estratégicas y Negociación", "Transporte y Distribución Global", "Metodologías Ágiles",
  "Scrum Master Profesional", "Product Owner Certificado", "Kanban para Equipos", "Gestión de Proyectos con PMP/PMI",
  "Gestión de Proyectos con PRINCE2", "Jira y Confluence para Equipos", "Asana y Trello para Productividad", "Liderazgo de Equipos",
  "Gestión del Cambio Organizacional", "Recursos Humanos y Atracción de Talento", "Evaluación del Desempeño 360",
  "Cultura Organizacional", "Capacitación y Desarrollo Corporativo", "Resolución de Conflictos Laborales", "Negociación Estratégica",
  "Comunicación Asertiva en el Trabajo", "Oratoria y Presentaciones de Impacto", "Storytelling para Negocios", "Toma de Decisiones",

  // --- MARKETING DIGITAL, VENTAS & CRECIMIENTO ---
  "Marketing Digital Integral", "SEO Técnico y On-Page", "SEO Off-Page y Link Building", "Estrategias de Contenido SEO",
  "Google Ads y Publicidad en Búsqueda", "Google Analytics 4 (GA4)", "Google Tag Manager", "Publicidad en Meta Ads (Facebook e Instagram)",
  "TikTok Ads para Marcas", "LinkedIn Ads B2B", "Publicidad en YouTube", "Publicidad Programática", "Marketing en Redes Sociales",
  "Gestión de Comunidades (Community Management)", "Estrategia de Contenidos para Instagram", "Crecimiento Orgánico en TikTok",
  "Estrategia de LinkedIn para Marca Personal", "Copywriting Persuasivo", "Storytelling en Redes Sociales", "Email Marketing con Mailchimp",
  "Email Marketing Automatizado con Klaviyo", "Funnels de Ventas y Embudos de Conversión", "Optimización de la Tasa de Conversión (CRO)",
  "Growth Hacking", "Marketing de Afiliados", "Marketing de Influencers", "Relaciones Públicas Digitales (Digital PR)",
  "Gestión de Marca y Branding", "Neuromarketing y Psicología del Consumidor", "Investigación de Mercado", "Benchmarking Competitivo",
  "Ventas B2B", "Ventas Consultivas", "Prospección en Frío por Email y LinkedIn", "Cierre de Ventas de Alto Valor",
  "Gestión de Clientes con HubSpot CRM", "Salesforce para Representantes de Ventas", "Customer Success y Retención",
  "Servicio y Atención al Cliente Excepcional", "Fidelización de Clientes (Loyalty Programs)", "E-commerce con Shopify",
  "E-commerce con WooCommerce", "Amazon FBA para Vendedores", "Mercado Libre para Tiendas Online", "Dropshipping Profesional",

  // --- DISEÑO, CREATIVIDAD & AUDIOVISUAL ---
  "Diseño Gráfico Publicitario", "Fundamentos de Composición y Color", "Tipografía Aplicada", "Adobe Photoshop para Fotografía",
  "Adobe Illustrator para Ilustración Vectorial", "Adobe InDesign para Editorial", "Diseño Editorial y Diagramación",
  "Diseño de Logotipos e Identidad Visual", "Brand Guidelines y Manuales de Identidad", "Diseño de Empaque (Packaging)",
  "Diseño UI (Interfaz de Usuario)", "Diseño UX (Experiencia de Usuario)", "Figma para Diseño de Interfaces",
  "Design Systems en Figma", "Prototipado Interactivo", "Investigación de Usuarios (UX Research)", "Arquitectura de Información Web",
  "Pruebas de Usabilidad", "Accesibilidad Web (WCAG)", "Diseño de Interacción (IxD)", "Microinteracciones y Animación UI",
  "Motion Graphics con Adobe After Effects", "Animación 2D Tradicional", "Animación Digital con Toon Boom", "Animación 3D con Blender",
  "Modelado 3D en Blender", "Modelado 3D con Cinema 4D", "Renderizado fotorrealista con V-Ray", "ZBrush para Escultura Digital",
  "Edición de Video con Adobe Premiere Pro", "Edición de Video con DaVinci Resolve", "Corrección y Gradación de Color (Color Grading)",
  "Edición de Video para Redes Sociales (CapCut Avanzado)", "Producción Audiovisual", "Dirección de Fotografía",
  "Iluminación para Video y Cine", "Guionismo y Storyboarding", "Diseño de Sonido para Video", "Grabación y Edición de Podcasts",
  "Locución Profesional y Manejo de la Voz", "Producción Musical con Ableton Live", "Producción Musical con FL Studio",
  "Producción Musical con Logic Pro", "Grabación de Audio en Estudio", "Mezcla de Audio Profesional", "Masterización de Pistas Musicales",
  "Teoría Musical para Productores", "Composición y Arreglos Musicales", "Diseño de Sonido (Sound Design)", "Sintetizadores y Síntesis de Audio",
  "Fotografía Digital Réflex y Mirrorless", "Fotografía de Retrato", "Fotografía de Producto y Comercial", "Fotografía Callejera y Documental",
  "Fotografía de Paisajes y Naturaleza", "Iluminación de Estudio Fotográfico", "Retoque Digital con Lightroom",

  // --- IDIOMAS & LINGÜÍSTICA ---
  "Inglés para Principiantes (A1-A2)", "Inglés Intermedio (B1-B2)", "Inglés Avanzado (C1-C2)", "Inglés de Negocios Corporativo",
  "Inglés para Entrevistas Laborales", "Inglés para Desarrolladores y Tecnología", "Pronunciación y Fonética del Inglés",
  "Preparación para Examen TOEFL", "Preparación para Examen IELTS", "Preparación para Exámenes Cambridge (FCE, CAE)",
  "Español para Extranjeros (ELE)", "Francés Básico e Intermedio", "Francés de Negocios", "Preparación DELF y DALF",
  "Alemán para Principiantes", "Alemán Intermedio y Avanzado", "Italiano Conversacional", "Portugués Brasileño",
  "Portugués de Portugal", "Japonés Básico (Hiragana, Katakana y Kanji)", "Japonés Intermedio (JLPT N4-N3)", "Chino Mandarín Básico (HSK 1-2)",
  "Chino Mandarín para Negocios", "Coreano Básico (Hangul y Conversación)", "Ruso Básico", "Árabe Estándar Moderno",
  "Lengua de Señas", "Traducción e Interpretación de Idiomas", "Traducción Técnica y Legal", "Redacción Creativa en Idiomas",

  // --- PRODUCTIVIDAD, DESARROLLO PERSONAL & LIDERAZGO ---
  "Gestión del Tiempo y Productividad Personal", "Método Getting Things Done (GTD)", "Planificación con Notion",
  "Automatización Personal con Make y Zapier", "Creación de Hábitos Sostenibles", "Enfoque y Trabajo Profundo (Deep Work)",
  "Inteligencia Emocional en el Liderazgo", "Pensamiento Crítico y Resolución de Problemas", "Creatividad e Innovación Sistemática",
  "Mindset de Crecimiento (Growth Mindset)", "Técnicas de Estudio y Aprendizaje Acelerado", "Lectura Rápida y Comprensión",
  "Memorización y Mnemotecnia", "Gestión del Estrés Laboral y Resiliencia", "Mindfulness y Meditación para el Enfoque",
  "Balance Vida-Trabajo", "Marca Personal y Presencia Ejecutiva", "Networking Estratégico", "Negociación Salarial y Avance de Carrera",
  "Preparación de Currículum y Carta de Presentación", "Simulaciones de Entrevistas de Trabajo", "Habilidades de Facilitación y Talleres",
  "Coaching Ejecutivo", "Mentoring para Profesionales", "Gestión de Equipos Remotos", "Cultura de Retroalimentación Positiva",

  // --- CIENCIAS, MATEMÁTICAS & INGENIERÍA ---
  "Álgebra y Cálculo Diferencial", "Cálculo Integral y Multivariable", "Ecuaciones Diferenciales", "Probabilidad y Estadística Descriptiva",
  "Estadística Inferencial", "Matemáticas Discretas", "Lógica Matemática", "Física Clásica y Mecánica", "Termodinámica Básica",
  "Electromagnetismo y Circuitos", "Química General", "Química Orgánica Industrial", "Bioquímica Teórica", "Genética Molecular y Biotecnología",
  "Astronomía y Astrofísica Observacional", "Geología y Ciencias de la Tierra", "Ecología y Sostenibilidad Ambiental",
  "Energías Renovables y Solar", "Energía Eólica y Biomasa", "Ingeniería de Sistemas", "Ingeniería Eléctrica Básica",
  "Diseño de Circuitos Electrónicos con KiCad", "Arduino y Proyectos de Electrónica", "Raspberry Pi y Sistemas Embebidos",
  "Internet de las Cosas (IoT)", "Robótica con ROS (Robot Operating System)", "Automatización Industrial con PLCs",
  "Mecatrónica y Sensores", "Diseño Asistido por Computadora (AutoCAD)", "Modelado Paramétrico con SolidWorks", "Autodesk Fusion 360",
  "Impresión 3D y Prototipado Rápido", "Ciencia de Materiales",

  // --- ARTES, HUMANIDADES & OFICIOS CREATIVOS ---
  "Dibujo Artístico de Figura Humana", "Pintura al Óleo Clásica", "Acuarela Botánica y Paisajes", "Pintura Acrílica Contemporánea",
  "Caligrafía y Lettering a Mano", "Escultura en Arcilla y Modelado", "Grabado y Serigrafía Textil", "Diseño de Moda y Figurín",
  "Corte y Confección Textil", "Patronaje Industrial", "Bordado y Arte Textil", "Joyería y Orfebrería Artesanal",
  "Carpintería Moderna y Mobiliario", "Restauración de Muebles Antiguos", "Ebanistería y Acabados de Madera", "Cerámica y Torno Alfarero",
  "Cocina Internacional", "Pastelería y Repostería Fina", "Panadería Artesanal con Masa Madre", "Enología y Cata de Vinos",
  "Barismo y Arte Latte en Café", "Mixología y Coctelería de Autor", "Cocina Vegetariana y Vegana Gourmet", "Fotografía Gastronómica",
  "Historia del Arte Universal", "Filosofía Antigua y Contemporánea", "Literatura Universal y Crítica Literaria", "Escritura de Novelas y Ficción",
  "Escritura de Poesía", "Dramaturgia y Guion Teatral", "Actuación y Expresión Corporal", "Teatro Musical", "Danza Contemporánea",
  "Ballet Clásico para Adultos", "Guitarra Acústica y Eléctrica", "Piano y Teclados", "Batería y Percusión", "Bajo Eléctrico",
  "Canto y Técnica Vocal", "Violín y Cuerdas Clásicas", "Ukelele para Principiantes", "Armónica y Blues",

  // --- LEGAL, REGULATORIO & CUMPLIMIENTO ---
  "Derecho Corporativo y Mercantil", "Propiedad Intelectual y Patentes", "Registro de Marcas y Derechos de Autor",
  "Contratos Internacionales y Redacción", "Derecho Laboral y Relaciones de Trabajo", "Protección de Datos Personales (GDPR / LFPDPPP)",
  "Compliance y Prevención de Lavado de Dinero", "Derecho Digital e Internet", "Aspectos Legales para Startups",
  "Derecho Fiscal y Tributario", "Planificación Patrimonial y Sucesiones", "Resolución Alternativa de Conflictos y Arbitraje",

  // --- EDUCACIÓN, PEDAGOGÍA & ENSEÑANZA ---
  "Diseño Instruccional para Cursos Online", "Creación de Contenido E-learning", "Gamificación en la Educación",
  "Tecnología Educativa (EdTech)", "Plataformas LMS (Moodle, Canvas)", "Evaluación del Aprendizaje Basada en Competencias",
  "Metodologías Activas (Aula Invertida)", "Educación para Adultos (Andragogía)", "Tutoría y Asesoría Académica Online",
  "Docencia Universitaria Digital",

  // --- ARQUITECTURA, CONSTRUCCIÓN & URBANISMO ---
  "Diseño Arquitectónico", "Modelado BIM con Revit", "Visualización Arquitectónica con Lumion", "SketchUp para Arquitectura",
  "Urbanismo Sostenible", "Diseño de Interiores y Decoración", "Iluminación Arquitectónica", "Paisajismo y Jardines Urbanos",
  "Gestión de Obras y Construcción", "Costos y Presupuestos de Construcción con Opus", "Topografía y Georreferenciación",
  "Sistemas de Información Geográfica (GIS con QGIS)",

  // --- VIDEOJUEGOS & REALIDAD VIRTUAL ---
  "Desarrollo de Videojuegos con Unity", "Desarrollo de Videojuegos con Unreal Engine 5", "Programación de Videojuegos en C#",
  "Programación de Videojuegos en C++", "Godot Engine para Juegos 2D y 3D", "Pixel Art para Videojuegos",
  "Diseño de Niveles (Level Design)", "Game Design y Mecánicas de Juego", "Audio Interactivo con FMOD y Wwise",
  "Realidad Virtual (VR) con Oculus/Meta Quest", "Realidad Aumentada (AR) con ARKit y ARCore", "Shaders y Gráficos por Computadora",

  // --- HARDWARE, REDES & TELECOMUNICACIONES ---
  "Redes de Computadoras (CCNA)", "Routing y Switching", "Protocolos TCP/IP y Subnetting", "Redes Inalámbricas y Wi-Fi Corporativo",
  "Telefonía IP y VoIP con Asterisk", "Cableado Estructurado y Fibra Óptica", "Administración de Servidores Windows Server",
  "Virtualización con VMware y Proxmox", "Almacenamiento SAN y NAS", "Soporte Técnico de Hardware y Ensamblaje"
];

// Generador semántico para expandir combinaciones especializadas hasta alcanzar 1,000 categorías
const techDomains = [
  "Frontend", "Backend", "Fullstack", "DevOps", "Cloud", "Data Science", "Machine Learning", "Mobile", "Security",
  "QA Automation", "Big Data", "Distributed Systems", "Embedded Systems", "API Architecture", "Performance Tuning"
];

const subDisciplines = [
  "Fundamentos", "Nivel Avanzado", "Buenas Prácticas", "Casos Prácticos", "Estrategias de Escalabilidad",
  "Patrones de Arquitectura", "Optimización de Rendimiento", "Seguridad y Blindaje", "Monitoreo y Métricas",
  "Automatización con Scripts", "Integración Empresarial", "Migración a la Nube", "Solución de Problemas Críticos",
  "Certificación Profesional", "Proyectos Reales", "Flujos de Trabajo Ágiles", "Herramientas Modernas",
  "Implementación Paso a Paso", "Auditoría Técnica", "Estrategia Global"
];

const businessTopics = [
  "Finanzas", "Contabilidad", "Marketing", "Ventas B2B", "E-commerce", "Recursos Humanos", "Liderazgo", "Negociación",
  "Logística", "Estrategia", "Startups", "Inversión", "Productividad", "Marca Personal", "Gestión de Proyectos",
  "Atención al Cliente", "Comercio Exterior", "Innovación", "Cultura Corporativa", "Auditoría Interna"
];

const creativeTopics = [
  "Diseño Gráfico", "Fotografía", "Video y Cine", "Animación Digital", "Modelado 3D", "Producción de Audio",
  "Música Instrumental", "Escritura Creativa", "Ilustración Digital", "Diseño UI/UX", "Branding Visual",
  "Color Grading", "Postproducción", "Storytelling Audiovisual", "Composición Visual"
];

function generateCategories(): string[] {
  const set = new Set<string>();

  // Agregar las categorías curadas
  rawCategories.forEach(cat => set.add(cat.trim()));

  // Generar variantes enriquecidas de Negocios y Gestión
  for (const topic of businessTopics) {
    for (const sub of subDisciplines) {
      if (set.size >= 1050) break;
      set.add(`${topic}: ${sub}`);
    }
  }

  // Generar variantes técnicas
  for (const domain of techDomains) {
    for (const sub of subDisciplines) {
      if (set.size >= 1050) break;
      set.add(`${domain}: ${sub}`);
    }
  }

  // Generar variantes creativas y artísticas
  for (const creative of creativeTopics) {
    for (const sub of subDisciplines) {
      if (set.size >= 1050) break;
      set.add(`${creative}: ${sub}`);
    }
  }

  // Excluir cualquier posible término médico o de salud
  const healthRegex = /\b(salud|medicina|m[eé]dic[ao]s?|nutrici[oó]n|cl[ií]nic[ao]s?|psicolog[ií]a|farmac[ií]a|farmac[eé]utic[ao]s?|tratamientos?|diagn[oó]sticos?|terapia|hospital|m[eé]dic|terap[eé]utic[ao]s?|psiquiatr[ií]a|patolog[ií]a|enfermedad|s[ií]ntoma|rehabilitaci[oó]n)\b/i;

  const valid = Array.from(set).filter(cat => !healthRegex.test(cat));
  return valid.slice(0, 1000);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const categoriesToSeed = generateCategories();
  console.log(`Iniciando sembrado de ${categoriesToSeed.length} categorías...`);

  let count = 0;
  const batchSize = 50;

  for (let i = 0; i < categoriesToSeed.length; i += batchSize) {
    const batch = categoriesToSeed.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (name) => {
        const slug = slugify(name);
        try {
          await prisma.category.upsert({
            where: { slug },
            update: { name, isActive: true },
            create: {
              name,
              slug,
              description: `Aprende y domina ${name} con los mejores coaches y cursos especializados en CoachingFromHome.`,
              icon: "BookOpen",
              isActive: true,
              language: "es",
            },
          });
          count++;
        } catch (e: any) {
          console.error(`Error en categoría ${name}:`, e?.message || e);
        }
      })
    );
    console.log(`Procesadas ${Math.min(i + batchSize, categoriesToSeed.length)} / ${categoriesToSeed.length}...`);
  }

  console.log(`¡Éxito! Se sincronizaron ${count} categorías en la base de datos.`);
}

main()
  .catch((e) => {
    console.error("Error fatal durante el sembrado:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
