# Build from the monorepo root: docker build -f services/backend/Dockerfile -t nolossmeme-backend .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/sdk/package.json packages/sdk/
COPY services/backend/package.json services/backend/
RUN pnpm install --frozen-lockfile --filter @nolossmeme/backend... 
COPY packages/sdk packages/sdk
COPY services/backend services/backend
RUN pnpm --filter @nolossmeme/sdk build && pnpm --filter @nolossmeme/backend build

FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production DATABASE_URL=file:/data/nolossmeme.db PORT=8787
COPY --from=build /repo ./
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "services/backend/dist/main.js"]
