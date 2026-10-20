# Coaching From Home (CFH) 🚀
### Arquitectura Monorepo & Guía Técnica de Inicialización

Bienvenido al repositorio oficial de **Coaching From Home (CFH)**. Este proyecto es una plataforma integral de educación, mentoría y coaching 1-a-1 en vivo, cursos asíncronos (LMS), espacios comunitarios de discusión y asistencia conversacional inteligente con IA (Valeria).

El proyecto está diseñado bajo una arquitectura de **Monorepo moderno con Turborepo**, permitiendo la reutilización de código entre paquetes compartidos y aplicaciones cliente.

---

## 🏗 1. Estructura del Monorepo

El repositorio está organizado en workspaces gestionados con **NPM Workspaces** y orquestados con **Turborepo**:

```text
Tia_Monica/
├── apps/
│   ├── web/                    # Aplicación principal Next.js 16 (App Router + React 19)
│   │   ├── app/                # Rutas públicas, dashboard de coach/alumno, onboarding y APIs
│   │   ├── components/         # Componentes UI de la plataforma web
│   │   ├── lib/                # Utilidades, cliente de base de datos y autenticación
│   │   ├── messages/           # Diccionarios de internacionalización (i18n es/en)
│   │   ├── prisma/             # Schema de base de datos, migraciones y scripts de seed
│   │   └── .env.example        # Plantilla de variables de entorno para apps/web
│   └── api/                    # Microservicio / API complementaria en NestJS
├── packages/
│   ├── database/               # Paquete compartido de Prisma ORM (@prisma/client tipado)
│   ├── ui/                     # Biblioteca de componentes compartidos de React (@repo/ui)
│   ├── eslint-config/          # Configuraciones compartidas de ESLint (@repo/eslint-config)
│   └── typescript-config/      # Configuraciones base de TypeScript (@repo/typescript-config)
├── docs/                       # Documentación técnica oficial y análisis de mercado
│   ├── Documento_Tecnico_CFH_SRS.docx   # SRS Maestro y Especificación Técnica Completa
│   └── Estudio_de_Mercado_CFH.docx      # Benchmark de plataformas líderes (Preply, Udemy, etc.)
├── scripts/                    # Scripts de QA, pruebas de carga y generación de docs
├── tests/                      # Suite de pruebas E2E, QA y desafíos adversariales
├── docker-compose.yml          # Servicios de infraestructura local (MySQL 8 y Mailpit)
├── package.json                # Configuración raíz del monorepo y scripts globales
└── turbo.json                  # Canalizaciones de compilación y caché de Turborepo
```

---

## 🛠 2. Requisitos Previos del Sistema

Antes de inicializar el proyecto, asegúrate de contar con el siguiente entorno instalado en tu máquina:

1. **Node.js**: Versión `>= 20.0.0` (Recomendado: `24.12.0` como se especifica en `.nvmrc`).
   - Puedes usar `nvm` (Node Version Manager): `nvm use` o `nvm install 24.12.0`.
2. **NPM**: Versión `>= 10.0.0` (o `11.6.2` según `packageManager`).
3. **Docker Desktop**: Necesario para correr MySQL 8 y Mailpit localmente sin instalaciones manuales de bases de datos.
4. **Git**: Para el control de versiones.

---

## 🚀 3. Guía de Instalación y Arranque Rápido

> ⚠️ **IMPORTANTE - RAMA DE TRABAJO:**  
> La rama que contiene **TODO el proyecto completo, paquetes compartidos, esquemas actualizados de base de datos y documentación** es **`dev`** (o `Derek`). `main` es una rama congelada de ciclos anteriores. Asegúrate de clonar o cambiar a la rama **`dev`**.

Sigue estos pasos en orden para clonar, configurar y levantar la plataforma en tu máquina local:

### Paso 1: Clonar el Repositorio en la Rama `dev`
```bash
# Opción recomendada: Clonar directamente la rama dev
git clone -b dev https://github.com/derekmoralesh/Tia_Monica.git
cd Tia_Monica

# O si ya clonaste el repositorio previamente, cambia a la rama dev:
git checkout dev
git pull origin dev
```

### Paso 2: Instalar Dependencias del Monorepo
Instala las dependencias en la raíz del proyecto. NPM configurará automáticamente los enlaces simbólicos de los workspaces locales (`database`, `@repo/ui`, etc.):
```bash
npm install
```

### Paso 3: Configurar Variables de Entorno
Copia el archivo de ejemplo a `apps/web/.env`:
```bash
# En Windows (PowerShell):
Copy-Item apps/web/.env.example apps/web/.env

# En Linux / macOS / Bash:
cp apps/web/.env.example apps/web/.env
```

> **Nota:** El archivo `.env.example` ya cuenta con credenciales de prueba preconfiguradas para Stripe en modo sandbox, SMTP de cPanel para envío de correos, Bunny Stream y Google OAuth. Para la base de datos local, la cadena por defecto apunta al contenedor de Docker:
> `DATABASE_URL="mysql://cfh:cfh_dev_password@localhost:3307/coaching_from_home"`

### Paso 4: Levantar la Base de Datos (Docker)
Inicia los servicios de MySQL y Mailpit en segundo plano:
```bash
docker-compose up -d mysql mailpit
```
- **MySQL 8**: Disponible en `localhost:3307` (Usuario: `cfh`, Password: `cfh_dev_password`, DB: `coaching_from_home`).
- **Mailpit (Visor de Correos de Prueba)**: Abre `http://localhost:8025` en tu navegador para inspeccionar correos enviados durante el registro y notificaciones.

### Paso 5: Sincronizar Prisma y Cargar Datos Iniciales (Seeds)
Desde la raíz del proyecto, ejecuta los scripts de preparación de la base de datos:

```bash
# 1. Generar los clientes tipados de Prisma
npm run db:generate

# 2. Sincronizar el esquema de tablas en la base de datos
npm run db:push

# 3. Cargar datos de prueba (usuarios, coaches y configuración básica)
npm run db:seed

# 4. Cargar el catálogo completo de 1,000+ categorías profesionales
npm run db:seed:categories
```

### Paso 6: Iniciar el Servidor de Desarrollo
Inicia todos los proyectos del monorepo mediante Turborepo:
```bash
npm run dev
```

La aplicación web estará disponible de inmediato en:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 💻 4. Scripts y Comandos Principales

Puedes ejecutar estos comandos directamente desde la **raíz del proyecto**:

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el entorno de desarrollo en paralelo con recarga en caliente (Hot Reload). |
| `npm run build` | Compila todos los workspaces (`apps/web`, `apps/api`, `packages/*`). |
| `npm run check-types` | Ejecuta la verificación estricta de tipos de TypeScript sin emitir archivos. |
| `npm run lint` | Ejecuta el linter ESLint en todos los paquetes y aplicaciones. |
| `npm run db:generate` | Genera el cliente `@prisma/client` a partir del esquema actualizado. |
| `npm run db:push` | Aplica cambios del modelo de datos directamente a MySQL sin generar archivos de migración innecesarios. |
| `npm run db:studio` | Abre la interfaz gráfica interactiva de Prisma Studio en tu navegador (`http://localhost:5555`). |
| `npm run db:seed` | Puebla la base de datos con usuarios y cursos de prueba. |
| `npm run db:seed:categories` | Inserta las más de 1,000 categorías profesionales en el catálogo. |
| `npm test` | Ejecuta la suite de pruebas E2E automatizadas. |
| `npm run test:qa` | Ejecuta la batería de pruebas de control de calidad (QA tiers 1 a 5). |
| `npm run test:qa:stress` | Ejecuta pruebas adversariales de estrés y concurrencia. |
| `npm run package:zip` | Genera el archivo ZIP de entrega del código fuente completo, limpio y sin dependencias pesadas. |

---

## 🗄 5. Gestión de Base de Datos y Modelos

El modelo de datos relacional de la plataforma está centralizado y compartido:
- **Esquema principal:** `apps/web/prisma/schema.prisma` y sincronizado en `packages/database/prisma/schema.prisma`.
- **Acceso en código:** Importa `prisma` desde `"database"` o `"@/lib/db"`.
- **Inspección visual:** Si deseas explorar o editar registros directamente con interfaz web, ejecuta:
  ```bash
  npm run db:studio
  ```

---

## 📚 6. Documentación Técnica de Referencia

En la carpeta [`docs/`](./docs/) encontrarás la documentación formal del proyecto elaborada para el equipo de desarrollo, arquitectura y ciberseguridad:

1. **`docs/Documento_Tecnico_CFH_SRS.docx`**:
   - Documento maestro de Requisitos de Software (SRS).
   - Arquitectura detallada, diccionario de datos completo de Prisma (modelos, campos, relaciones e índices).
   - Especificación técnica de los 11 módulos de ciberseguridad y mejoras acordadas (prevención de fugas, control de sesiones concurrentes, protección de videos HLS con DRM ligero, roles y permisos, auditoría y logging).
2. **`docs/Estudio_de_Mercado_CFH.docx`**:
   - Benchmark competitivo exhaustivo de plataformas referentes del mercado (**Preply, Udemy, Domestika, MentorCruise, Skool**).
   - Catálogo de 10 herramientas y patrones de conversión, UX y anti-desintermediación recomendados para CFH.
3. **`docs/COACHINGFROMHOME_Requerimientos_Originales.pdf`**:
   - Especificaciones de requerimientos de negocio iniciales del cliente.
4. **`docs/Plantilla_Requerimientos_CFH.pdf`**:
   - Plantilla de visión, requerimientos funcionales y alcance fundacional de Coaching From Home.


---

## 🔒 7. Políticas de Seguridad y Buenas Prácticas de Git

- **Variables Secretas:** Nunca hagas commit de archivos `.env`, `.env.local` o `.env.production`. Mantén únicamente `.env.example` en el repositorio con valores de plantilla.
- **Ramas de Trabajo:**
  - `main`: Código estable y listo para despliegues a producción.
  - `dev`: Rama de integración activa para pruebas del equipo.
  - `Derek`: Rama activa de desarrollo y refactorización técnica.
- **Antes de crear un Pull Request:** Verifica que tu código compile sin errores ejecutando `npm run check-types` y `npm run build`.
