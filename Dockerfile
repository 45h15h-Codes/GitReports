FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

# Install deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --prod

# Copy source
COPY apps/api ./apps/api

# Build
RUN pnpm --filter api build

EXPOSE 3000

CMD ["node", "apps/api/dist/index.js"]
