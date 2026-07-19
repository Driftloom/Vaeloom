FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY packages/ packages/
COPY services/ services/

RUN pnpm install --frozen-lockfile --filter @vaeloom/api

COPY apps/api/ ./apps/api/

RUN cd apps/api && pnpm prisma:generate && pnpm build

FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/src/generated ./src/generated
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/.pnpm ./node_modules/.pnpm

USER nestjs

EXPOSE 4000

ENV NODE_ENV=production
ENV PORT=4000

CMD ["node", "dist/main"]
