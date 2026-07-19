FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/next.config.js apps/web/tsconfig.json ./apps/web/
COPY packages/ packages/

RUN pnpm install --frozen-lockfile --filter @vaeloom/web

COPY apps/web/ ./apps/web/

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN cd apps/web && pnpm build

FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

WORKDIR /app

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./public

USER nextjs

EXPOSE 3000

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

CMD ["node", "server.js"]
