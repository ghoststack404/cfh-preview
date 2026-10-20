FROM node:22-alpine AS base

# Dependencias necesarias para construir en Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Primero copiamos lo esencial para instalar dependencias y aprovechar la caché
COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json ./apps/web/package.json

RUN npm install

# Copiamos todo el código fuente
COPY . .

# Generamos el cliente de Prisma
RUN npx prisma generate --schema=apps/web/prisma/schema.prisma

# Compilamos la aplicación web usando Turborepo
RUN npm run build --workspace=apps/web

# Exponemos el puerto
EXPOSE 3000

# Iniciamos la aplicación
CMD ["npm", "run", "start", "--workspace=apps/web"]
