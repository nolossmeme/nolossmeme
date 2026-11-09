# Static sites for nolossmeme.fun, built from the monorepo root.
#   docker build -f deploy/vps/site/Dockerfile --target landing -t nolossmeme-landing .
#   docker build -f deploy/vps/site/Dockerfile --target app     -t nolossmeme-app .
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
ARG VITE_APP_URL=https://app.nolossmeme.fun/
ARG VITE_LANDING_URL=https://nolossmeme.fun/
ENV VITE_INDEXER_URL=$VITE_INDEXER_URL VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
RUN pnpm --filter @nolossmeme/sdk build \
 && VITE_BASE=/ VITE_APP_URL=$VITE_APP_URL pnpm --filter @nolossmeme/landing build \
 && VITE_BASE=/ VITE_LANDING_URL=$VITE_LANDING_URL pnpm --filter @nolossmeme/web build

FROM nginx:1.27-alpine AS landing
COPY deploy/vps/site/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/landing/dist /usr/share/nginx/html
RUN rm -f /usr/share/nginx/html/404.html
EXPOSE 80

FROM nginx:1.27-alpine AS app
COPY deploy/vps/site/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
RUN rm -f /usr/share/nginx/html/404.html
EXPOSE 80
