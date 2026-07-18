FROM node:20-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS build
WORKDIR /app
RUN npm install -g pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
USER nestjs
EXPOSE 3170
ENV NODE_ENV=production
CMD ["node", "dist/main"]
