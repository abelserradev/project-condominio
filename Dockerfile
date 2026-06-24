FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apk add --no-cache python3 make g++

WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# --shamefully-hoist genera estructura flat (como npm) necesaria para que módulos
# transitivos como express sean resolubles desde dist/ al copiar entre stages
RUN pnpm install --frozen-lockfile --ignore-scripts --shamefully-hoist
# Compilar paquetes con addons nativos
RUN pnpm rebuild bcrypt sharp @nestjs/core tesseract.js

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN ./node_modules/.bin/nest build
# Scripts de migración/ops compilados para ejecutar en prod: node dist/scripts/...
RUN ./node_modules/.bin/tsc -p tsconfig.scripts.json

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
