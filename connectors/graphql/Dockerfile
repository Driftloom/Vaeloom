FROM node:20-alpine AS base
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/index.js"]
