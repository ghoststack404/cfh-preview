# -*- coding: utf-8 -*-
"""
Script maestro para generar el Documento de Especificación de Requisitos de Software (SRS)
y Diseño de Arquitectura Técnica Integral de CoachingFromHome (CFH).
Produce: Documento_Tecnico_CFH_SRS.docx
"""

import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from build_srs_helpers import (
    set_cell_background, set_cell_margins, set_table_borders,
    add_callout, add_code_block, format_table
)

def create_document():
    doc = docx.Document()
    
    # Configuración de márgenes estándar (1 pulgada = 2.54 cm)
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)
        section.page_width = Inches(8.5)
        section.page_height = Inches(11.0)
        
        # Header / Footer
        footer = section.footer
        p_ft = footer.paragraphs[0]
        p_ft.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r_ft = p_ft.add_run("CoachingFromHome (CFH) • Documento Técnico de Arquitectura y Requisitos (SRS) • Confidencial")
        r_ft.font.name = "Calibri"
        r_ft.font.size = Pt(8.5)
        r_ft.font.color.rgb = RGBColor(148, 163, 184)

    # Estilos de encabezados
    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(22)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(17)
        run.font.bold = True
        run.font.color.rgb = RGBColor(6, 78, 59) # Emerald 900
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(13.5)
        run.font.bold = True
        run.font.color.rgb = RGBColor(4, 120, 87) # Emerald 700
        return p

    def add_h3(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(11.5)
        run.font.bold = True
        run.font.color.rgb = RGBColor(15, 23, 42) # Slate 900
        return p

    def add_p(text, bold_prefix=None, space_after=5):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_b = p.add_run(bold_prefix)
            r_b.font.name = "Calibri"
            r_b.font.size = Pt(10)
            r_b.font.bold = True
            r_b.font.color.rgb = RGBColor(15, 23, 42)
        r = p.add_run(text)
        r.font.name = "Calibri"
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(51, 65, 85)
        return p

    def add_bullet(text, bold_prefix=None):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_b = p.add_run(bold_prefix)
            r_b.font.name = "Calibri"
            r_b.font.size = Pt(10)
            r_b.font.bold = True
            r_b.font.color.rgb = RGBColor(15, 23, 42)
        r = p.add_run(text)
        r.font.name = "Calibri"
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(51, 65, 85)
        return p

    # =========================================================================
    # PORTADA FORMAL Y CORPORATIVA
    # =========================================================================
    p_pre = doc.add_paragraph()
    p_pre.paragraph_format.space_before = Pt(36)
    p_pre.paragraph_format.space_after = Pt(6)
    r_pre = p_pre.add_run("INGENIERÍA DE SOFTWARE & AUDITORÍA DE SEGURIDAD")
    r_pre.font.name = "Calibri"
    r_pre.font.size = Pt(11)
    r_pre.font.bold = True
    r_pre.font.color.rgb = RGBColor(4, 120, 87)

    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(10)
    r_title = p_title.add_run("ESPECIFICACIÓN DE REQUISITOS DE SOFTWARE (SRS) Y DISEÑO TÉCNICO INTEGRAL")
    r_title.font.name = "Calibri"
    r_title.font.size = Pt(24)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(10, 37, 64) # Navy Dark

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(28)
    r_sub = p_sub.add_run("Plataforma Web Educativa y de Mentorías en Vivo: CoachingFromHome (CFH)\nInventario del Sistema en Producción, Arquitectura de Datos, Protocolos de Video y Plan de Ciberseguridad")
    r_sub.font.name = "Calibri"
    r_sub.font.size = Pt(13)
    r_sub.font.color.rgb = RGBColor(71, 85, 105)

    # Tabla de Metadatos de la Portada
    meta_table = doc.add_table(rows=1, cols=2)
    format_table(
        meta_table,
        col_widths=[2.5, 4.0],
        headers=["Parámetro del Proyecto", "Valor de Referencia / Especificación"],
        rows_data=[
            ["Nombre del Sistema", "CoachingFromHome (CFH)"],
            ["Dominio Público en Producción", "https://coachingfromhome.com.mx"],
            ["Versión del Documento", "Versión 2.4.0 (Release Candidate / Auditoría de Seguridad)"],
            ["Fecha de Emisión", "Octubre 2026"],
            ["Autores Principales", "Arquitecto de Software Principal & Equipo de Ingeniería Web"],
            ["Destinatarios", "Liderazgo Técnico, Especialista en Ciberseguridad & Equipo de Desarrollo"],
            ["Estado del Repositorio", "Ramas 'dev' y 'Derek' Sincronizadas (0 Errores de Tipado TypeScript)"],
            ["Clasificación de Seguridad", "DOCUMENTO CONFIDENCIAL - PROPIEDAD INTELECTUAL CFH"]
        ]
    )

    doc.add_page_break()

    # =========================================================================
    # SECCIÓN 1: INTRODUCCIÓN, VISIÓN GENERAL Y OBJETIVOS ESTRATÉGICOS
    # =========================================================================
    add_h1("1. Introducción, Visión General y Objetivos Estratégicos")
    
    add_h2("1.1 Propósito y Audiencia del Documento")
    add_p(
        "El presente documento técnico constituye la Especificación Formal de Requisitos de Software (SRS) "
        "y el Manual de Arquitectura de Sistemas de la plataforma CoachingFromHome (CFH). Su objetivo principal es "
        "proporcionar una radiografía exhaustiva, matemáticamente precisa y a nivel de código de todos los componentes, "
        "módulos, esquemas de base de datos, flujos de datos y servicios en la nube implementados hasta la fecha. "
        "Asimismo, este documento formaliza de manera técnica y estructurada las observaciones, requerimientos "
        "de mejora, recomendaciones de infraestructura y lineamientos de ciberseguridad planteados durante las mesas de trabajo "
        "con el consultor experto en seguridad informática."
    )
    add_p(
        "Este documento servirá como la 'Única Fuente de Verdad' (Single Source of Truth) para el equipo de desarrollo, "
        "permitiendo que cualquier ingeniero de software, auditor de seguridad o arquitecto de infraestructura comprenda, "
        "depure, audite y extienda la plataforma de manera inmediata sin ambigüedades."
    )

    add_h2("1.2 Misión y Propuesta de Valor de CoachingFromHome")
    add_p(
        "CoachingFromHome es un ecosistema digital de aprendizaje interactivo y mentorías en vivo diseñado para conectar a "
        "mentores profesionales ('Coaches') con estudiantes de todo el mundo ('Aprendices'). A diferencia de los repositorios "
        "de videos estáticos tradicionales (como Udemy o Coursera), CFH basa su propuesta de valor en un modelo híbrido dual:"
    )
    add_bullet("Sesiones de Coaching 1 a 1 en Vivo: Videollamadas interactivas sincronizadas en tiempo real con pizarra, toma de notas sincronizada y retroalimentación personalizada.", "1. ")
    add_bullet("Cursos Pregrabados de Alta Definición (LMS): Módulos organizados pedagógicamente con cuestionarios, tareas con revisión de archivos binarios y solicitudes de feedback en video.", "2. ")
    add_bullet("Red Social y Comunidad Temática: Un entorno interactivo con grupos de estudio, recomendaciones de mentores, publicaciones de dudas y prevención de desintermediación comercial.", "3. ")

    add_h2("1.3 Perfiles de Usuario y Modelo de Autorización (RBAC)")
    add_p(
        "El sistema implementa un modelo de control de acceso basado en roles (Role-Based Access Control - RBAC) "
        "gobernado por la enumeración 'UserRole' en base de datos y validado a nivel de borde (Edge Runtime) mediante middleware:"
    )
    
    roles_table = doc.add_table(rows=1, cols=3)
    format_table(
        roles_table,
        col_widths=[1.5, 2.0, 3.0],
        headers=["Rol del Sistema", "Permisos y Capacidades", "Rutas Protegidas y Experiencia"],
        rows_data=[
            [
                "STUDENT (Aprendiz)",
                "Búsqueda en catálogo de más de 1,000 categorías, agendamiento de sesiones gratuitas (15 min) y de pago (60 min), compra de cursos vía carrito multicurso, interacción en foros y comunidad.",
                "/[locale]/dashboard, /[locale]/student/onboarding, /[locale]/classroom/[id], /[locale]/checkout"
            ],
            [
                "COACH (Mentor)",
                "Publicación de cursos mediante constructor Drag-and-Drop, configuración de disponibilidad horaria por minutos/días, cobro de honorarios vía Stripe Connect Express, gestión de alumnos, suscripción a planes de plataforma.",
                "/[locale]/coach/dashboard, /[locale]/coach/cursos, /[locale]/coach/availability, /[locale]/coach/onboarding, /[locale]/coach/plans"
            ],
            [
                "ADMIN (Administrador)",
                "Aprobación/rechazo de perfiles de coaches, auditoría de certificados profesionales, publicación de cursos revisados, resolución de disputas financieras, sanción/bloqueo de usuarios con strikes.",
                "/[locale]/admin/coaches, /[locale]/admin/disputes, /api/admin/*"
            ]
        ]
    )

    doc.add_page_break()

    # =========================================================================
    # SECCIÓN 2: ARQUITECTURA DE SOFTWARE Y PILA TECNOLÓGICA (ESTADO ACTUAL)
    # =========================================================================
    add_h1("2. Arquitectura de Software y Pila Tecnológica (Estado Actual / As-Is)")
    
    add_h2("2.1 Arquitectura General del Sistema")
    add_p(
        "La aplicación está estructurada como un monorepo modular gobernado por Next.js 16 (React 19) con App Router. "
        "Opera bajo el paradigma de Componentes de Servidor (React Server Components - RSC) complementados con Server Actions "
        "para mutaciones transaccionales y Route Handlers para endpoints de API RESTful públicos y de webhooks."
    )
    
    add_callout(
        doc,
        "La arquitectura combina ejecución en el servidor (SSR/RSC) para garantizar máxima optimización SEO en los perfiles "
        "de coaches y catálogo de cursos, con hidratación reactiva del lado del cliente únicamente donde se requiere "
        "alta interactividad (videollamadas, chat de comunidad, constructor de cursos).",
        title="PRINCIPIO ARQUITECTÓNICO FUNDAMENTAL"
    )

    add_h2("2.2 Pila Tecnológica Exhaustiva (Stack Tecnológico)")
    tech_table = doc.add_table(rows=1, cols=3)
    format_table(
        tech_table,
        col_widths=[1.8, 1.8, 2.9],
        headers=["Capa / Módulo", "Tecnología / Dependencia", "Función Crítica y Justificación Técnica"],
        rows_data=[
            ["Framework Core", "Next.js 16.2.0 (App Router)", "Enrutamiento dinámico internacionalizado, Server Actions, soporte para salida standalone para entornos Node.js cPanel."],
            ["Librería UI", "React 19.2.0 & React DOM", "Renderizado declarativo, hooks modernos (useActionState, useOptimistic), componentes asíncronos."],
            ["Tipado Estático", "TypeScript 5.9.2", "Garantía de tipado estricto extremo, verificación completa sin emisión (tsc --noEmit con 0 errores)."],
            ["Estilos y Animación", "Tailwind CSS 3.4 & Framer Motion 12", "Diseño responsivo atómico, soporte de modo oscuro nativo, microinteracciones fluidas en modales y drawers."],
            ["Base de Datos & ORM", "MySQL 8.0 & Prisma ORM 6.19.3", "Almacenamiento relacional de alta fidelidad, generación tipada de queries, soporte multi-plataforma (Debian/RHEL)."],
            ["Autenticación", "NextAuth.js v5 (beta 32) & @auth/prisma-adapter", "Single Sign-On (SSO) con Google OAuth 2.0, estrategia JWT stateless, adaptadores de base de datos."],
            ["Pasarela de Pagos", "Stripe API 22.4.0 & Stripe Connect", "Checkout Sessions para cursos y mentorías, suscripciones recurrentes de coaches, transferencias directas a cuentas bancarias."],
            ["Streaming de Video", "Bunny.net Stream API & CDN", "Transcodificación HLS adaptativa (240p-1080p), protección DRM contra descargas directas no autorizadas."],
            ["Videollamadas 1-on-1", "Twilio Video / WebRTC Rooms", "Salas de videoconferencia seguras y efímeras entre el mentor y el aprendiz con señalización en backend."],
            ["WebSockets / Realtime", "Pusher Server 5.3 & Pusher-js 8.6", "Canales de presencia ('presence-community'), eventos push de mensajería privada y notificaciones instantáneas."],
            ["Inteligencia Artificial", "OpenAI SDK 7.27 & Google Gemini API", "Motor del Asistente Virtual 'Valeria', streaming conversacional, generación de planes de estudio y resúmenes."],
            ["OCR de Certificados", "Tesseract.js 7.0.0", "Reconocimiento óptico de caracteres para validar autenticidad de títulos y certificados subidos por coaches."],
            ["Internacionalización", "next-intl 4.14.7", "Soporte completo para 13 idiomas (es, en, fr, de, it, pt, ru, zh, ja, ko, ar, hi), detección de locale por cookies y URL."],
            ["Editor Enriquecido", "Tiptap React 3.31 & Starter Kit", "Editor WYSIWYG modular para el temario de lecciones y redacción de artículos en la comunidad."],
            ["Drag and Drop", "@dnd-kit/core & sortable", "Reordenamiento interactivo de módulos y lecciones en el constructor de cursos del coach."],
            ["Servidor de Correo", "Nodemailer 9.1 & cPanel SMTP", "Despacho de notificaciones transaccionales y confirmaciones de agenda vía SMTP seguro en puerto 465."]
        ]
    )

    add_h2("2.3 Configuración de Infraestructura en Servidor de Producción (cPanel)")
    add_p(
        "El despliegue en producción sobre cPanel requirió la resolución de desafíos de red críticos inherentes a entornos de "
        "alojamiento compartido y servidores privados virtuales con firewalls estrictos:"
    )
    add_bullet("Compilación Standalone: next.config.mjs está configurado con output: 'standalone'. Esto extrae un servidor Node.js autónomo en .next/standalone que no requiere el directorio 'node_modules' completo en producción.", "1. ")
    add_bullet("Forzado de Resolución IPv4: cPanel bloqueaba las conexiones salientes de Node.js que intentaban comunicarse vía IPv6. Se configuró NODE_OPTIONS='--dns-result-order=ipv4first' para obligar a Node a usar IPv4 en todas las llamadas fetch externas.", "2. ")
    add_bullet("Host de Base de Datos Loopback: Se configuró DATABASE_URL='mysql://...127.0.0.1:3306/...' para evitar bucles de red donde el firewall bloqueaba solicitudes dirigidas al dominio público desde el mismo servidor.", "3. ")
    add_bullet("Encabezados de Confianza (trustHostHeader): En el archivo de arranque de standalone, se activó trustHostHeader: true para que Next.js lea las cabeceras x-forwarded-host y x-forwarded-proto enviadas por el proxy inverso de cPanel, evitando redirecciones erróneas a 0.0.0.0:3000.", "4. ")
    add_bullet("Reglas de Firewall Saliente (cPanel Outgoing Connections): Se abrieron en el puerto 443 los dominios FQDN requeridos: accounts.google.com, oauth2.googleapis.com, www.googleapis.com, api.stripe.com, api.openai.com, video.bunny.net, api.bunny.net y vz-5f9bd8a0-82d.b-cdn.net.", "5. ")

    add_code_block(
        doc,
        "# Fragmento de configuración de producción en cPanel (.env):\n"
        "NODE_OPTIONS=\"--dns-result-order=ipv4first\"\n"
        "HOSTNAME=\"127.0.0.1\"\n"
        "PORT=3000\n"
        "DATABASE_URL=\"mysql://coach_admin:SECURE_PASS@127.0.0.1:3306/coach_fromHome\"\n"
        "NEXTAUTH_URL=\"https://coachingfromhome.com.mx\"\n"
        "AUTH_URL=\"https://coachingfromhome.com.mx\"",
        caption="Variables de Entorno Críticas de Red en cPanel"
    )

    doc.add_page_break()

    # =========================================================================
    # SECCIÓN 3: MODELO DE DATOS Y ESQUEMA ENTIDAD-RELACIÓN
    # =========================================================================
    add_h1("3. Modelo de Datos y Esquema de Base de Datos (Prisma ORM)")
    add_p(
        "La base de datos MySQL consta de más de 35 modelos relacionales normalizados que cubren desde el ciclo de vida del usuario "
        "hasta la facturación de cursos y la moderación comunitaria. A continuación se documenta el esquema maestro:"
    )

    add_h2("3.1 Diccionario de Datos: Modelos de Identidad y Sesión")
    user_fields = [
        ["id", "String (cuid)", "No", "Identificador único primario del usuario."],
        ["email", "String (unique)", "No", "Correo electrónico normalizado en minúsculas."],
        ["name", "String", "No", "Nombre completo del usuario."],
        ["role", "Enum (UserRole)", "No", "Rol activo del usuario: STUDENT, COACH, ADMIN (Default: STUDENT)."],
        ["status", "Enum (UserStatus)", "No", "Estado: PENDING, ACTIVE, SUSPENDED, DELETED (Default: ACTIVE)."],
        ["avatarUrl / image", "String (Text)", "Sí", "URL del avatar (Cloudinary o Google Profile Picture)."],
        ["interests", "Json", "Sí", "Arreglo de categorías o áreas de interés seleccionadas en el onboarding."],
        ["goals", "String (Text)", "Sí", "Metas de aprendizaje o enseñanza del usuario."],
        ["onboardingCompletedAt", "DateTime", "Sí", "Marca de tiempo que valida si completó el onboarding inicial."],
        ["secondChanceUsed", "Boolean", "No", "Bandera de moderación que indica si el usuario ya utilizó su indulto de strike."]
    ]
    u_table = doc.add_table(rows=1, cols=4)
    format_table(u_table, [1.5, 1.5, 0.8, 2.7], ["Campo", "Tipo de Dato", "Nulo", "Descripción y Reglas de Negocio"], user_fields)

    add_h2("3.2 Diccionario de Datos: Perfil del Coach (CoachProfile)")
    add_p("La tabla 'CoachProfile' almacena toda la información profesional y parámetros comerciales del mentor:")
    coach_fields = [
        ["userId", "String (unique FK)", "No", "Relación uno a uno con la tabla User."],
        ["slug", "String (unique)", "No", "Identificador amigable para URL pública (ej. /coaches/juan-perez)."],
        ["headline", "String", "No", "Titular profesional o lema del coach."],
        ["biography", "String (Text)", "No", "Descripción detallada de trayectoria y metodología pedagógica."],
        ["hourlyRateCents", "Int", "No", "Tarifa por hora en centavos de USD (ej. 3500 = $35.00 USD)."],
        ["freeIntroEnabled", "Boolean", "No", "Habilita la reserva de una sesión introductoria gratuita de 15 min."],
        ["approvalStatus", "Enum", "No", "DRAFT, PENDING, APPROVED, REJECTED. Requiere validación de Admin."],
        ["currentTier", "Enum (CoachTier)", "No", "BASIC, CURSOS_ONLY, ELITE, GOLD, PLATINUM."],
        ["stripeAccountId", "String (unique)", "Sí", "ID de cuenta conectada en Stripe Connect para dispersión de fondos."],
        ["contractVersion", "String", "No", "Versión del contrato de prestación de servicios aceptado."],
        ["contractAcceptedAt", "DateTime", "No", "Sello de tiempo legal de la firma electrónica del contrato."]
    ]
    c_table = doc.add_table(rows=1, cols=4)
    format_table(c_table, [1.5, 1.5, 0.8, 2.7], ["Campo", "Tipo de Dato", "Nulo", "Descripción Comercial y Legal"], coach_fields)

    add_h2("3.3 Diccionario de Datos: Módulo LMS y Cursos Pregrabados")
    add_p("Estructura jerárquica de 4 niveles para la creación y distribución de contenido educativo:")
    add_bullet("Course: Metadatos generales del curso, precio, slug, categoría, miniatura, video introductorio y calificación promedio.", "Nivel 1 (Curso): ")
    add_bullet("CourseModule: Agrupadores temáticos ordenados secuencialmente mediante el campo 'position'.", "Nivel 2 (Módulo): ")
    add_bullet("CourseLesson: Unidad de aprendizaje individual. Define si requiere entrega de tareas ('submissionRequired'), si permite mensajes de discusión o solicitudes de video feedback ('allowVideoRequests').", "Nivel 3 (Lección): ")
    add_bullet("CourseLessonBlock: Bloques polimórficos de contenido (BlockType: VIDEO, PDF, TEXT, LINKS, QUIZ) almacenados en formato JSON estructurado.", "Nivel 4 (Bloque): ")
    add_bullet("Enrollment: Registro de matrícula que vincula al estudiante con el curso, controlando el estado de pago, el código de certificado único y el progreso.", "Seguimiento: ")
    add_bullet("LessonNote: Notas privadas del estudiante vinculadas al segundo exacto de reproducción del video.", "Interactividad: ")

    add_h2("3.4 Diccionario de Datos: Agendamiento y Mentorías 1 a 1 (Booking)")
    booking_fields = [
        ["id", "String (cuid)", "No", "Identificador único de la reserva."],
        ["studentId / coachId", "String (FK)", "No", "Relación con los usuarios aprendiz y mentor."],
        ["startAt / endAt", "DateTime", "No", "Ventana de tiempo exacta de la sesión."],
        ["status", "Enum (BookingStatus)", "No", "REQUESTED, PENDING_PAYMENT, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELED."],
        ["isFreeIntro", "Boolean", "No", "Indica si es una sesión de prueba gratuita de 15 minutos."],
        ["priceCents", "Int", "No", "Precio cobrado al estudiante en centavos de moneda local/USD."],
        ["platformFeeCents", "Int", "No", "Comisión retenida por la plataforma según el plan del coach."],
        ["videoRoomName", "String (unique)", "Sí", "Nombre seguro de la sala de videollamada generado por el sistema."]
    ]
    b_table = doc.add_table(rows=1, cols=4)
    format_table(b_table, [1.5, 1.5, 0.8, 2.7], ["Campo", "Tipo de Dato", "Nulo", "Función en el Flujo de Reserva"], booking_fields)

    doc.add_page_break()

    # =========================================================================
    # SECCIÓN 4: ESPECIFICACIÓN DETALLADA DE MÓDULOS FUNCIONALES
    # =========================================================================
    add_h1("4. Especificación Detallada de Módulos Funcionales Implementados")

    add_h2("4.1 Módulo 1: Autenticación, Sesiones y Seguridad de Acceso")
    add_p(
        "La plataforma cuenta con un sistema de autenticación centralizado basado en NextAuth.js v5 con adaptador Prisma. "
        "El inicio de sesión y registro se realizan de forma unificada mediante Google OAuth 2.0 en 1 solo clic. "
        "Se eliminaron los formularios vulnerables o redundantes de credenciales manuales para evitar problemas de desbordamiento visual "
        "y fricción en dispositivos móviles."
    )
    add_p("Flujo de Autenticación y Preservación de Rol:")
    add_bullet("1. El usuario hace clic en 'Continuar con Google' (en login) o selecciona su rol ('Quiero Aprender' o 'Quiero Enseñar') y hace clic en 'Registrarse con Google'.")
    add_bullet("2. La URL de retorno incluye el parámetro de consulta: /api/auth/oauth-redirect?flow=register&role=COACH (o STUDENT).")
    add_bullet("3. Google autentica la identidad y NextAuth crea o vincula la cuenta en la tabla 'User'.")
    add_bullet("4. El Route Handler oauth-redirect asigna de forma atómica el rol solicitado en la base de datos (user.role = 'COACH') y sincroniza las cookies httpOnly 'cfh_active_role', 'cfh_user_role' y 'cfh_onboarding_completed'.")
    add_bullet("5. Redirección inteligente: Si no ha completado el onboarding, se le envía a /[locale]/coach/onboarding o /[locale]/student/onboarding. Si ya lo completó, aterriza directamente en su Dashboard.")

    add_h2("4.2 Módulo 2: Motor de Agendamiento y Reglas de Disponibilidad")
    add_p(
        "El coach configura sus franjas de atención semanal mediante el modelo 'AvailabilityRule'. Cada regla define un día "
        "de la semana (0 = Domingo a 6 = Sábado) y los minutos del día de inicio y fin (por ejemplo: 540 = 09:00 AM, 1080 = 06:00 PM). "
        "El motor de disponibilidad calcula dinámicamente las horas libres:"
    )
    add_bullet("Descarta horas pasadas en el día actual considerando la zona horaria del usuario.", "1. ")
    add_bullet("Verifica solapamientos contra la tabla 'Booking' para excluir horarios ya confirmados o en proceso de pago.", "2. ")
    add_bullet("Genera slots de 15 minutos para 'Free Intro' o de 60 minutos para sesiones regulares de pago.", "3. ")

    add_h2("4.3 Módulo 3: Monetización, Comisiones y Suscripciones (Stripe Connect)")
    add_p(
        "El sistema monetario opera bajo una arquitectura de 'Marketplace' donde la plataforma actúa como intermediario de cobro "
        "y distribuye automáticamente los fondos hacia los coaches:"
    )
    
    plan_table = doc.add_table(rows=1, cols=4)
    format_table(
        plan_table,
        col_widths=[1.5, 1.3, 1.5, 2.2],
        headers=["Plan de Membresía", "Costo Mensual", "Comisión Plataforma", "Herramientas de IA y Beneficios"],
        rows_data=[
            ["BASIC (Gratuito)", "$0.00 USD / mes", "20.0% (2000 bps)", "Sin herramientas de IA, perfil público básico, sesiones 1 a 1."],
            ["CURSOS_ONLY", "$30.00 USD / mes", "18.0% (1800 bps)", "Constructor de cursos LMS ilimitado, sin IA avanzada."],
            ["ELITE", "$60.00 USD / mes", "18.0% (1800 bps)", "8 Herramientas de IA, tracking de alumnos, soporte estándar."],
            ["GOLD", "$80.00 USD / mes", "16.0% (1600 bps)", "10 Herramientas de IA, recordatorios automáticos por WhatsApp, pizarra interactiva."],
            ["PLATINUM", "$100.00 USD / mes", "15.0% (1500 bps)", "13 Herramientas de IA completas, copiloto de planeación, prioridad en catálogo y búsqueda."]
        ]
    )

    add_h2("4.4 Módulo 4: Infraestructura de Streaming de Video (Bunny.net)")
    add_p(
        "Los videos de los cursos no se almacenan en el servidor local de cPanel ni en MySQL. Se gestionan mediante la API de Bunny.net Stream:"
    )
    add_bullet("Carga mediante Protocolo TUS: Permite subidas resilientes de archivos de video pesados (hasta varios gigabytes) con reanudación automática si se interrumpe la conexión.", "• ")
    add_bullet("Transcodificación Automática: Bunny.net codifica los videos en múltiples resoluciones (1080p, 720p, 480p, 360p) y genera manifiestos HLS (.m3u8).", "• ")
    add_bullet("Reproductor Incrustado Protegido: Se utiliza un iframe con token firmado ('/api/bunny/sign') que previene la extracción directa de la URL y restringe la reproducción al dominio 'coachingfromhome.com.mx'.", "• ")

    add_h2("4.5 Módulo 5: Red Social 'Comunidad' y Motor de Strikes")
    add_p(
        "La comunidad permite a los usuarios compartir experiencias, solicitar recomendaciones de coaches y debatir en grupos temáticos. "
        "Para mantener la calidad y el orden, se implementó el motor 'communityStrikes.ts':"
    )
    add_bullet("1er Strike: Advertencia formal por notificación y correo electrónico.", "• ")
    add_bullet("2do Strike: Suspensión temporal de 7 días (bloqueo de publicación y comentarios).", "• ")
    add_bullet("3er Strike: Suspensión definitiva. El usuario es desconectado y al intentar acceder se le presenta la pantalla de bloqueo total 'FullScreenSuspensionScreen'.", "• ")
    add_bullet("Segunda Oportunidad: Los administradores pueden conceder un indulto que reactiva la cuenta pero marca el flag 'secondChanceUsed = true'. Si vuelve a cometer una falta, la expulsión es irreversible.", "• ")

    add_h2("4.6 Módulo 6: Asistente Virtual Inteligente 'Valeria'")
    add_p(
        "Valeria es un agente conversacional interactivo integrado en toda la plataforma. "
        "En computadoras de escritorio se despliega como un widget lateral flotante, mientras que en dispositivos móviles "
        "se transforma en un Bottom Sheet deslizable (diseño inspirado en Mercado Libre) para no entorpecer la visión de la pantalla. "
        "Está programada con directivas estrictas para no exponer rutas técnicas internas y guiar al usuario hacia la reserva de mentores, "
        "catálogo de cursos o soporte técnico en su propio idioma."
    )

    doc.add_page_break()

    # =========================================================================
    # SECCIÓN 5: ESPECIFICACIÓN TÉCNICA DE MEJORAS Y CIBERSEGURIDAD
    # (TRANSCRIPCIÓN Y FORMALIZACIÓN TÉCNICA DE LOS 4 AUDIOS DE LA REUNIÓN)
    # =========================================================================
    add_h1("5. Especificación de Mejoras, Ciberseguridad y Evolución (Requisitos To-Be)")
    add_p(
        "Esta sección formaliza y detalla con rigor de ingeniería todas las iniciativas de mejora, modernización y ciberseguridad "
        "discutidas durante la sesión de trabajo con el consultor especialista en seguridad informática (analizadas a partir de los 4 audios adjuntos). "
        "Cada requerimiento incluye su justificación técnica, arquitectura propuesta y criterios de aceptación para el equipo de desarrollo:"
    )

    # 5.1
    add_h2("5.1 Reingeniería del Flujo de Contraseñas y Autenticación Multifactor (MFA / 2FA)")
    add_p(
        "Diagnóstico de la Problemática Actual: Durante las pruebas en cPanel y dispositivos móviles, los usuarios reportaron que "
        "al intentar restablecer su contraseña ('Olvidé mi contraseña'), el correo de recuperación arroja fallas locales, no llega a la bandeja "
        "o la URL enviada falla al abrirse en navegadores móviles. Esto se debe a bloqueos en el puerto SMTP saliente y a discrepancias "
        "entre el Host del servidor y la URL firmada en el token.",
        bold_prefix="Diagnóstico: "
    )
    add_p(
        "Solución y Requerimiento Técnico:",
        bold_prefix="Especificación Técnica: "
    )
    add_bullet("Autenticación Multifactor (2FA / MFA): Implementar soporte para contraseñas de un solo uso basadas en tiempo (TOTP - RFC 6238) compatibles con Google Authenticator, Authy y 1Password.", "A. ")
    add_bullet("Código de Respaldo OTP de 6 Dígitos: En lugar de enlaces largos propensos a ser corrompidos por clientes de correo móvil, el sistema enviará un código numérico criptográfico de 6 dígitos con vigencia de 10 minutos (almacenado como hash SHA-256 en la tabla PasswordResetToken).", "B. ")
    add_bullet("Monitoreo de Envíos SMTP: Se implementará un fallback transaccional con reintentos exponenciales y registro en AuditLog para detectar si cPanel rechaza la conexión con el servidor de correo.", "C. ")

    # 5.2
    add_h2("5.2 Endurecimiento de Seguridad y Control Estricto en Salas de Video")
    add_p(
        "Problemática: En plataformas de videollamadas, si un enlace de reunión es filtrado o compartido por un participante, "
        "terceros no autorizados podrían ingresar a sesiones privadas de mentoría, violando la privacidad del estudiante y coach.",
        bold_prefix="Riesgo de Seguridad: "
    )
    add_p(
        "Arquitectura de Control de Acceso Parametrizado:",
        bold_prefix="Especificación Técnica: "
    )
    add_bullet("Tokens de Acceso Efímeros (JWT): Ningún usuario podrá ingresar a una sala de video mediante una URL estática. El backend emitirá un token JWT firmado asimétricamente con una validez estricta de 60 segundos para el handshake inicial.", "1. ")
    add_bullet("Restricción Estricta de Aforo en Código Fuente: El servidor validará la identidad del socket/WebRTC contra la reserva (Booking). En sesiones 1 a 1, el servidor rechazará automáticamente cualquier tercer intento de conexión (capacidad máxima = 2 participantes: 1 coach y 1 aprendiz).", "2. ")
    add_bullet("Parámetros de Llamada Dinámicos: En sesiones grupales o masterclasses, el coach definirá el aforo máximo permitido (ej. 3, 5, 10 alumnos). Una vez alcanzado el cupo, las peticiones adicionales recibirán un código HTTP 403 (Room Full).", "3. ")

    # 5.3
    add_h2("5.3 Sistema de Grabaciones Efímeras y Respaldo Externo en la Nube")
    add_p(
        "Problemática de Almacenamiento: Las grabaciones de video de clases de 60 minutos ocupan entre 500 MB y 1.5 GB cada una. "
        "Guardar estos archivos en el servidor cPanel agotaría rápidamente el disco de hosting, degradaría el rendimiento de MySQL y encarecería la infraestructura.",
        bold_prefix="Impacto Operativo: "
    )
    add_p(
        "Solución Híbrida de Almacenamiento y Transferencia:",
        bold_prefix="Especificación Técnica: "
    )
    add_bullet("Modelo de Descarga Efímera (Estilo WeTransfer / SwissTransfer): Las grabaciones de sesiones 1 a 1 se procesarán de forma temporal y se generará un enlace de descarga con expiración automática de 3 a 5 días. Pasado este plazo, el archivo se purga automáticamente del servidor, liberando espacio.", "A. ")
    add_bullet("Exportación a la Nube Personal del Usuario: Se habilitará una opción para que el alumno o coach conecte su nube personal (Google Drive, Proton Drive, TeraBox o almacenamiento S3/Wasabi) para transferir la grabación directamente a su cuenta sin costo para CoachingFromHome.", "B. ")
    add_bullet("Protección de Cursos Pregrabados: A diferencia de las mentorías 1 a 1, los videos de los cursos pregrabados NO se podrán descargar; permanecerán alojados exclusivamente en Bunny.net con protección contra copia y visualización en streaming cifrado.", "C. ")

    # 5.4
    add_h2("5.4 Arquitectura de IA Desacoplada mediante Microservicios y Modelos Open-Source")
    add_p(
        "Problemática de Costos y Dependencia: El uso exclusivo de APIs comerciales como OpenAI o Claude para cientos de miles de consultas "
        "genera facturas elevadas por consumo de tokens y expone la plataforma a bloqueos si se alcanzan las cuotas de velocidad (Rate Limits).",
        bold_prefix="Riesgo Financiero y Técnico: "
    )
    add_p(
        "Implementación de Agentes y Microservicios Open-Source:",
        bold_prefix="Especificación Técnica: "
    )
    add_bullet("Microservicios Autónomos en Python: Desarrollar servicios desacoplados en FastAPI para ejecutar modelos de lenguaje de código abierto (Open Source) como Hermes 3, Llama 3.1 o Mistral.", "1. ")
    add_bullet("Orquestación con n8n y Servidor Dedicado: Utilizar flujos de trabajo en n8n para orquestar llamadas de IA y desplegar los modelos en servidores locales o dedicados de alta capacidad (194 GB RAM) para abaratar costos a cero en inferencia interna.", "2. ")
    add_bullet("Pool de Proveedores Rotativos (Fallback): Configurar un balanceador que alterne entre APIs gratuitas o de bajo costo (Groq, Together AI, DuckDuckGo AI, Brave Search API) cuando un proveedor agote sus peticiones por minuto.", "3. ")
    add_bullet("Sistema de Monetización por Tokens ($12 USD): Los usuarios contarán con una cuota gratuita inicial para herramientas de IA. Al agotarse, podrán adquirir paquetes de recarga (ej. paquete de tokens por $12 USD) para continuar generando anuncios, planes de estudio o resúmenes.", "4. ")

    # 5.5
    add_h2("5.5 Generación Automatizada de Resúmenes y Actividades Post-Sesión 1 a 1")
    add_p(
        "Requerimiento de Valor Agregado: Al finalizar una sesión en vivo de 60 minutos, el sistema procesará el audio de la llamada para generar "
        "de manera instantánea un entregable pedagógico de alto valor para el alumno:",
        bold_prefix="Innovación Pedagógica: "
    )
    add_bullet("Transcripción y Extracción de Puntos Clave: Mediante un modelo Whisper/Speech-to-Text se genera la transcripción protegida.", "• ")
    add_bullet("Síntesis Ejecutiva por IA: El agente de IA genera un resumen estructurado: 1) Temas revisados, 2) Áreas de oportunidad detectadas, 3) Acuerdos establecidos con el coach, 4) Tareas y ejercicios prácticos asignados.", "• ")
    add_bullet("Almacenamiento en 'AiArtifact': El resumen se almacena y se visualiza en el panel de control del alumno con opción de descarga en formato PDF formal.", "• ")

    # 5.6
    add_h2("5.6 Filtrado Avanzado, WAF y Moderación de Contenidos en la Comunidad")
    add_p(
        "Riesgos Comunitarios y Comerciales: 1) Publicación de contenido ofensivo, sexual o malware en foros. "
        "2) Intento de coaches y alumnos de intercambiar teléfonos o números de WhatsApp para acordar clases privadas por fuera "
        "de CoachingFromHome, evadiendo la comisión de la plataforma (Desintermediación Comercial).",
        bold_prefix="Vulnerabilidades Identificadas: "
    )
    add_p(
        "Mecanismos de Protección Perimetral y de Aplicación:",
        bold_prefix="Especificación Técnica: "
    )
    add_bullet("Protección DNS con Cloudflare Family (1.1.1.3 / 1.0.0.3): Configurar el perímetro de red para bloquear automáticamente solicitudes hacia dominios asociados con malware, phishing y contenido para adultos.", "A. ")
    add_bullet("Filtro Regex Anti-Desintermediación: Analizador léxico en el backend que detecta y bloquea números telefónicos en diversos formatos (ej. '+52 55...', '5-5-1-2...', palabras como 'cinco cinco...'), correos electrónicos y enlaces a WhatsApp o Telegram.", "B. ")
    add_bullet("Detección de Lenguaje Evasivo (Leetspeak): Normalización de caracteres antes del filtrado (transformando 'v3nd0' a 'vendo', 'h0l4' a 'hola', y eliminando puntuaciones intermedias) para evitar que usuarios se salten los filtros de palabras prohibidas.", "C. ")
    add_bullet("Alertas SOC vía Telegram: Cualquier detección de escaneo malicioso (Nmap, ZAP) o ataque de inyección disparará una alerta instantánea vía bot de Telegram al equipo de ciberseguridad.", "D. ")

    # 5.7
    add_h2("5.7 Optimización UI/UX del Catálogo y Previsualización Rápida (Hover Preview)")
    add_p(
        "Requerimiento Visual y de Conversión: La interfaz actual del catálogo presenta imágenes y banners sobredimensionados que requieren "
        "demasiado scroll vertical y no ofrecen información inmediata del contenido del curso.",
        bold_prefix="Diagnóstico UI/UX: "
    )
    add_bullet("Hover Preview Cards: Al posar el cursor sobre una tarjeta de curso, se desplegará una ventana emergente interactiva que muestra: miniatura con video de introducción, resumen de temario, calificación de alumnos y botón directo de 'Añadir al Carrito' sin tener que cambiar de página.", "1. ")
    add_bullet("Reducción de Banners y Optimización de Miniaturas: Rediseñar los contenedores visuales para hacerlos más compactos y profesionales, logrando que el usuario visualice al menos 8 cursos en una sola pantalla de escritorio estándar.", "2. ")
    add_bullet("Footer Institucional Enriquecido: Ampliar el pie de página con sellos de confianza de ciberseguridad, certificaciones, enlaces a términos de servicio y canales de soporte directo y seguro (Signal / Telegram).", "3. ")

    # 5.8
    add_h2("5.8 Construcción de Autoridad de Marca, Credibilidad y Validación de Perfiles")
    add_p(
        "Requerimiento de Confianza: Un factor determinante para la venta de cursos y asesorías de alto valor es la credibilidad real del mentor:",
        bold_prefix="Social Proof y Reputación: "
    )
    add_bullet("Insignias de Verificación Oficial: Validación de identidad mediante documento oficial y revisión manual de antecedentes.", "• ")
    add_bullet("Integración de Apariciones en Prensa y Medios: Sección dedicada en el perfil del coach para enlazar entrevistas en YouTube, notas de prensa, participaciones en radio o conferencias públicas.", "• ")
    add_bullet("Biografía Curricular Verificada: Presentación estructurada de años de experiencia, certificaciones académicas comprobadas mediante OCR y testimonios de alumnos verificados que pagaron y completaron sus sesiones.", "• ")

    # 5.9
    add_h2("5.9 Sistema de Sesiones Grupales, Webinars y Masterclasses")
    add_p(
        "Ampliación del Modelo de Sesiones: Permitir a los mentores programar eventos grupales en vivo (por ejemplo: talleres de yoga, clases de programación en vivo, conferencias magistrales) donde múltiples estudiantes puedan inscribirse pagando una tarifa individual con aforo limitado:",
        bold_prefix="Especificación Funcional: "
    )
    add_bullet("Definición de aforo mínimo y máximo por parte del coach.", "• ")
    add_bullet("Venta individual de boletos/tickets vinculada a Stripe Checkout.", "• ")
    add_bullet("Apertura de sala de video grupal con moderación de micrófonos y chat sincronizado.", "• ")

    # 5.10
    add_h2("5.10 Módulo de Trading y Educación Financiera / Inversión")
    add_p(
        "Propuesta del Experto: Habilitar un simulador educativo de inversiones con micro-capitales (desde $3 USD) para enseñar finanzas prácticas:",
        bold_prefix="Análisis de Viabilidad y Delimitación Legal: "
    )
    add_bullet("Delimitación Legal Estricta: Para no incurrir en delitos financieros o requerir licencias de correduría de bolsa (CNBV, SEC, FINRA), el módulo debe configurarse exclusivamente como un simulador pedagógico ('Paper Trading') con fondos virtuales o APIs de prueba autorizadas.", "A. ")
    add_bullet("Prohibición de Captación de Capitales: La plataforma no captará ni custodiará dinero de inversión de terceros; se limitará a la enseñanza de metodologías de análisis técnico y fundamental.", "B. ")

    # 5.11
    add_h2("5.11 Adopción de Entorno de Desarrollo Profesional Linux / WSL y Pipeline CI/CD")
    add_p(
        "Estandarización de Ingeniería: El desarrollo de aplicaciones web complejas en sistemas Windows provoca fricciones con rutas, permisos y binarios nativos (OpenSSL/Prisma). Se establece la siguiente política de desarrollo:",
        bold_prefix="Buenas Prácticas de Ingeniería: "
    )
    add_bullet("Uso Obligatorio de Linux / WSL2: Todos los desarrolladores utilizarán entornos basados en Linux (Ubuntu/Debian) o Windows Subsystem for Linux (WSL2) con terminales estandarizadas.", "• ")
    add_bullet("Control de Versiones Git Riguroso: Flujo de trabajo basado en ramas feature -> dev -> staging -> main. Prohibición de commits directos en producción.", "• ")
    add_bullet("Pipeline de Compilación y Test Automatizado: Verificación obligatoria de compilación de TypeScript ('tsc --noEmit') y linting antes de cualquier fusión de código.", "• ")

    doc.add_page_break()

    # =========================================================================
    # SECCIÓN 6: ESTUDIO DE MERCADO EXHAUSTIVO Y BENCHMARKING COMPETITIVO
    # =========================================================================
    add_h1("6. Estudio de Mercado Exhaustivo y Benchmarking Competitivo")
    add_p(
        "Para fundamentar la reestructuración de CoachingFromHome (CFH) con estándares de clase mundial, se realizó una "
        "investigación exhaustiva de las 7 plataformas líderes globales en mentorías 1 a 1, clases en vivo, cursos on-demand "
        "y comunidades gamificadas. A continuación se detallan los patrones de arquitectura, conversión, retención y herramientas "
        "que CFH adoptará e integrará en su evolución:"
    )

    # 6.1 Preply & Superprof
    add_h2("6.1 Referentes de Clases y Mentorías 1 a 1: Preply (preply.com) y Superprof (superprof.mx)")
    add_p("Patrones de Interfaz, Conversión y Aula Virtual a Replicar en CFH:", bold_prefix="Análisis de Producto: ")
    add_bullet("Tarjetas de Coach con 'Split Video Hover' y Disponibilidad Instantánea (Estilo Preply): Al posar el cursor sobre la tarjeta de un coach en el catálogo, se despliega a la derecha un panel flotante sticky con el video de presentación (1-2 min) reproduciéndose con subtítulos, acompañado de una cuadrícula visual resumida de disponibilidad horaria (Mañana / Tarde / Noche por día) y el botón 'Ver horario completo'.", "1. ")
    add_bullet("Insignias de Confianza y Prueba Social Dinámica: Indicadores verificados como 'Coach Verificado', 'Super Coach' (calificación > 4.8 y alta retención), tiempo de respuesta promedio ('Responde en < 1h') y micro-datos de urgencia ('5 sesiones reservadas en las últimas 48 horas').", "2. ")
    add_bullet("Gancho de Adquisición ('1ª Sesión Gratis' / 'Sesión de Diagnóstico Garantizada'): Al igual que el modelo de Superprof y Preply, destacar visualmente la primera sesión introductoria gratuita (15 min) o sesión de diagnóstico con garantía de reemplazo gratuito de coach si no hay afinidad.", "3. ")
    add_bullet("Aula Virtual Integrada ('Preply Space'): Videollamada WebRTC embebida sin depender de links externos de Zoom/Meet (lo que permite auditar asistencia automáticamente para liberar el pago en custodia), acompañada de Pizarra Interactiva Colaborativa, panel lateral de Notas Sincronizadas y Resumen Post-Clase con IA (porcentaje de participación hablada, temas cubiertos y tareas asignadas).", "4. ")
    add_bullet("Mecanismos Anti-Desintermediación Avanzados: Escaneo Regex/NLP en tiempo real que oculta teléfonos, emails y handles de redes sociales antes del primer pago, combinado con comisiones progresivas que disminuyen cuantas más horas acumula el coach dentro de la plataforma (incentivo económico directo para no llevarse al alumno fuera de CFH).", "5. ")

    # 6.2 Udemy & Domestika
    add_h2("6.2 Referentes de Cursos On-Demand (LMS): Udemy (udemy.com) y Domestika (domestika.org)")
    add_p("Patrones de Catálogo, Previsualización y Reproductor deCursos a Replicar:", bold_prefix="Análisis de Producto: ")
    add_bullet("Popover 'Hover Preview Card' de Conversión en 1 Clic (Estilo Udemy): Al pasar el ratón sobre un curso (~300ms delay), emerge una tarjeta flotante con: título completo, fecha de última actualización, nivel, duración total en horas, 4 bullets con checkmarks ('Lo que aprenderás') y el botón directo 'Añadir al Carrito'.", "1. ")
    add_bullet("Tráiler en Autoplay Silencioso (Estilo Domestika): Al hacer hover sobre la miniatura del curso, la imagen estática se transforma instantáneamente en un reproductor de video silencioso mostrando el tráiler cinematográfico del curso y el porcentaje de valoraciones positivas ('99% valoraciones positivas').", "2. ")
    add_bullet("Galería de Proyectos de Alumnos Graduados: Sección pública dentro de la página de detalle del curso donde los estudiantes suben sus proyectos finales, actuando como prueba social tangible de los resultados del curso.", "3. ")
    add_bullet("Notas Interactivas con Timestamp ([mm:ss]) y Transcripción Sincronizada: En el reproductor de cursos de CFH, al hacer clic en una nota guardada (ej. [04:32]) o en un párrafo de la transcripción lateral, el video salta exactamente a ese segundo.", "4. ")
    add_bullet("Certificados con URL Pública Verificable e Integración con LinkedIn: Al completar el 100% del curso, emisión de certificado con código único verificable y botón 'Añadir al perfil de LinkedIn en 1 clic'.", "5. ")

    # 6.3 MentorCruise & ADPList
    add_h2("6.3 Referentes de Mentoría Ejecutiva y Autoridad: MentorCruise (mentorcruise.com) y ADPList (adplist.org)")
    add_p("Patrones de Credibilidad, Planes Mensuales y Sesiones Grupales a Replicar:", bold_prefix="Análisis de Producto: ")
    add_bullet("Autoridad Institucional y Métricas de Impacto (Estilo ADPList): Mostrar en el perfil del coach el total de minutos de mentoría impartidos ('3,450 minutos de coaching'), tasa de asistencia ('99% Attendance Rate'), empresas o instituciones donde se ha desempeñado, apariciones en prensa/YouTube y medallas de 'Top 1% Coach'.", "1. ")
    add_bullet("Estructura de Monetización Dual (Planes Retainer Mensuales vs. Sesiones Sueltas - Estilo MentorCruise): Permitir que el coach ofrezca tanto sesiones individuales de 60 min como Planes de Acompañamiento Mensual (Suscripción al Coach) que incluyan 2 o 4 llamadas al mes + soporte por chat asíncrono ilimitado + revisión de entregas.", "2. ")
    add_bullet("Masterclasses y Sesiones Grupales como Embudo (Lead Magnet): Permitir a los coaches abrir sesiones grupales en vivo para 5 a 50 personas con contador de cupos restantes ('Quedan 3 lugares de 15'), funcionando como canal de adquisición hacia sus mentorías privadas 1 a 1.", "3. ")

    # 6.4 Skool
    add_h2("6.4 Referente de Comunidad, Eventos y Gamificación: Skool (skool.com)")
    add_p("Patrones de Retención Comunitaria y Gamificación a Replicar:", bold_prefix="Análisis de Producto: ")
    add_bullet("Arquitectura Unificada de 4 Pilares (Comunidad + Cursos + Calendario en Vivo + Ranking): Integrar en la sección de Comunidad un Calendario Mensual interactivo en la zona horaria del alumno donde vea todas las sesiones grupales y Q&A en vivo programadas, con botón 'Añadir a Google/Apple Calendar'.", "1. ")
    add_bullet("Gamificación por Aportes de Calidad (1 Like = 1 Punto): Cada like recibido en publicaciones o respuestas útiles dentro de la comunidad otorga 1 punto al usuario, permitiéndole subir a través de 9 niveles de prestigio en el Leaderboard semanal y mensual.", "2. ")
    add_bullet("Desbloqueo de Recursos por Nivel (Course Gating): Permitir que ciertas masterclasses grabadas, plantillas descargables o cupones de descuento en sesiones 1 a 1 se desbloqueen automáticamente cuando el alumno alcance el Nivel 3 o Nivel 5 de participación comunitaria, multiplicando la retención orgánica.", "3. ")

    # Tabla Comparativa de Benchmarking
    bench_table = doc.add_table(rows=1, cols=4)
    format_table(
        bench_table,
        col_widths=[1.3, 1.5, 1.9, 1.8],
        headers=["Plataforma Referente", "Fortaleza Principal", "Funcionalidad Estrella Analizada", "Aplicación Directa en CFH"],
        rows_data=[
            ["Preply", "Marketplace 1 a 1 en vivo", "Split Video Hover + Aula WebRTC con Resumen IA post-clase.", "Tarjetas de coach con video preview, horario instantáneo y síntesis IA de sesión."],
            ["Superprof", "Adquisición rápida de alumnos", "Insignia '1ª clase gratis' (15 min) + Tiempo de respuesta.", "Destacar sesión intro gratuita de 15 min y métrica de velocidad de respuesta."],
            ["Udemy", "Conversión en catálogo LMS", "Hover Popover Card con 'Lo que aprenderás' y carrito 1-clic.", "Implementar Hover Preview Card en catálogo de cursos y notas por minuto."],
            ["Domestika", "Calidad visual y prueba social", "Autoplay de tráiler en hover + Galería de proyectos de alumnos.", "Reproducción silenciosa en miniatura al pasar el cursor y portafolio de graduados."],
            ["MentorCruise", "Retención de alto ticket", "Planes mensuales de mentoría (Llamadas + Chat asíncrono).", "Habilitar paquetes mensuales recurrentes por coach además de sesiones sueltas."],
            ["ADPList", "Autoridad y sesiones grupales", "Métricas de minutos totales impartidos + Group Masterclasses.", "Contador de minutos de experiencia en perfil y eventos grupales con cupo limitado."],
            ["Skool", "Comunidad y Gamificación", "Calendario de eventos en vivo + Niveles (1 Like = 1 Punto).", "Integrar calendario de eventos en comunidad y desbloqueo de premios por nivel."]
        ]
    )

    doc.add_page_break()

    # =========================================================================
    # SECCIÓN 7: MATRIZ DE REQUISITOS NO FUNCIONALES (NFR) Y SEGURIDAD
    # =========================================================================
    add_h1("7. Matriz de Requisitos No Funcionales (NFR) y Estándares de Seguridad")
    
    nfr_table = doc.add_table(rows=1, cols=3)
    format_table(
        nfr_table,
        col_widths=[1.8, 1.8, 2.9],
        headers=["Dimensión de Calidad", "Métrica / Parámetro Objetivo", "Estrategia de Mitigación / Implementación"],
        rows_data=[
            ["Rendimiento (Performance)", "LCP < 2.5s, FID < 100ms, CLS < 0.1 en 90% de visitas.", "Uso de React Server Components, optimización de imágenes en formatos WebP/AVIF y CDN distribuido de Bunny.net."],
            ["Disponibilidad (Availability)", "99.9% Uptime mensual.", "Proceso Node.js standalone gestionado con supervisor de procesos, reinicio automático y monitoreo continuo."],
            ["Seguridad contra XSS", "0 Vulnerabilidades de inyección de scripts.", "Sanitización obligatoria de todo HTML ingresado en Tiptap con isomorphic-dompurify y escape automático en JSX."],
            ["Seguridad contra SQLi", "0 Consultas concatenadas vulnerables.", "Uso exclusivo del ORM Prisma con consultas parametrizadas y tipadas; prohibición de prisma.$queryRaw sin sanitizar."],
            ["Protección CSRF", "Validación en el 100% de peticiones de mutación.", "Cookies SameSite=Lax, tokens anti-CSRF en Server Actions y validación de cabeceras Host y Origin en middleware."],
            ["Protección de Datos (GDPR)", "Cifrado en tránsito y en reposo.", "HTTPS obligatorio en todas las conexiones, cifrado de teléfonos de contacto en base de datos, derecho al olvido implementado."],
            ["Exclusión Legal Médica", "100% Cumplimiento regulatorio.", "Prohibición categórica de categorías médicas, farmacológicas o veterinarias para proteger la responsabilidad civil y penal de la empresa."]
        ]
    )

    doc.add_page_break()

    # =========================================================================
    # SECCIÓN 8: CRONOGRAMA DE IMPLEMENTACIÓN Y HOJA DE RUTA (ROADMAP)
    # =========================================================================
    add_h1("8. Cronograma de Implementación y Plan de Acción Priorizado (Roadmap)")
    add_p(
        "A continuación se presenta el plan de trabajo estructurado en 4 fases secuenciales para el equipo de desarrollo "
        "y el consultor de ciberseguridad:"
    )

    roadmap_table = doc.add_table(rows=1, cols=4)
    format_table(
        roadmap_table,
        col_widths=[1.2, 1.6, 2.3, 1.4],
        headers=["Fase", "Objetivo Principal", "Entregables Técnicos Clave", "Plazo Estimado"],
        rows_data=[
            [
                "Fase 1: Seguridad Inmediata",
                "Endurecimiento de accesos y resolución de fallas críticas.",
                "Reingeniería de olvido de contraseña con OTP de 6 dígitos, tokens efímeros JWT en salas de video con límite 1-on-1, configuración de reglas WAF perimetrales.",
                "Semanas 1 y 2"
            ],
            [
                "Fase 2: UI/UX & Moderación",
                "Optimización visual y protección de la comunidad.",
                "Implementación de Hover Preview Cards en catálogo, compactación de banners, filtros regex anti-desintermediación (bloqueo de teléfonos en chat) y Cloudflare Family DNS.",
                "Semanas 3 y 4"
            ],
            [
                "Fase 3: Grabaciones & IA",
                "Desacoplamiento de archivos y valor pedagógico post-llamada.",
                "Sistema de descargas efímeras (SwissTransfer 3-5 días), exportación a nubes personales (Google Drive/Proton), transcripción Whisper y resumen ejecutivo por IA post-sesión.",
                "Semanas 5 y 6"
            ],
            [
                "Fase 4: Microservicios & Escala",
                "Autonomía de infraestructura y nuevos formatos de evento.",
                "Despliegue de microservicio de IA local (Hermes en servidor dedicado), sistema de recarga de tokens ($12 USD), módulo de clases grupales/webinars con aforo parametrizado.",
                "Semanas 7 y 8"
            ]
        ]
    )

    add_h2("8.1 Aprobación y Firmas del Documento Maestro")
    add_p("El presente documento ha sido revisado y aprobado para su ejecución técnica inmediata:")
    
    sig_table = doc.add_table(rows=1, cols=3)
    format_table(
        sig_table,
        col_widths=[2.1, 2.2, 2.2],
        headers=["Responsable", "Cargo / Función", "Estado de Aprobación"],
        rows_data=[
            ["Equipo de Arquitectura", "Principal Software Architect", "APROBADO (Emitido para Desarrollo)"],
            ["Consultor de Ciberseguridad", "Lead Cybersecurity Auditor", "APROBADO (Lineamientos Integrados)"],
            ["Dirección del Proyecto", "Product Owner & Stakeholders CFH", "APROBADO (Presupuesto y Alcance Validado)"]
        ]
    )

    output_path = os.path.join(os.path.dirname(__file__), "Documento_Tecnico_CFH_SRS.docx")
    doc.save(output_path)
    print(f"Document successfully created at: {output_path}")

if __name__ == "__main__":
    create_document()
