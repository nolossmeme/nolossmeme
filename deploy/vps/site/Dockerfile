# Static sites for nolossmeme.fun: landing at / and the dApp at /app, served by nginx.
# Build from the monorepo root: docker build -f deploy/vps/site/Dockerfile -t nolossmeme-site .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/sdk/package.json packages/sdk/
COPY packages/ui/package.json packages/ui/
COPY apps/landing/package.json apps/landing/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @nolossmeme/landing... --filter @nolossmeme/web...
COPY packages packages
COPY apps/landing apps/landing
COPY apps/web apps/web
ARG VITE_INDEXER_URL=https://api.nolossmeme.fun
ARG VITE_TURNSTILE_SITE_KEY=
ENV VITE_INDEXER_URL=$VITE_INDEXER_URL VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
RUN pnpm --filter @nolossmeme/sdk build \
 && VITE_BASE=/ VITE_APP_URL=/app/ pnpm --filter @nolossmeme/landing build \
 && VITE_BASE=/app/ VITE_LANDING_URL=/ pnpm --filter @nolossmeme/web build

FROM nginx:1.27-alpine
COPY deploy/vps/site/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/landing/dist /usr/share/nginx/html
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html/app
RUN rm -f /usr/share/nginx/html/app/404.html
EXPOSE 80
