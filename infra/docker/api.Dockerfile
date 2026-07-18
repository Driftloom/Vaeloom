# Vaeloom API (NestJS). Multi-stage build for a small production image.
# See Docs/DevOps/Docker.md, Docs/Engineering/Implementation/01-foundation-infra.md
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

# ---- deps: install workspace deps with cached store ----
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* .npmrc* nx.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile=false

# ---- build ----
FROM deps AS build
COPY apps/api ./apps/api
WORKDIR /repo/apps/api
RUN pnpm exec prisma generate
RUN pnpm run build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo/apps/api
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/apps/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
EXPOSE 4000
CMD ["node", "dist/main.js"]
