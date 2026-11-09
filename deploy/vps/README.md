# VPS deployment (nolossmeme.fun)

The whole product runs on one VPS behind the host nginx: the static sites (landing at `/`,
dApp at `/app`) in one nginx container and the backend (indexer, API, keeper, faucet) in another.
Containers listen on loopback only; host nginx terminates TLS.

| Host                    | Container port | Image                         |
| ----------------------- | -------------- | ----------------------------- |
| `nolossmeme.fun`, `www` | 127.0.0.1:3181 | `deploy/vps/site/Dockerfile`  |
| `api.nolossmeme.fun`    | 127.0.0.1:3182 | `services/backend/Dockerfile` |

## First time

```bash
# on the VPS
git clone https://github.com/nolossmeme/nolossmeme.git ~/apps/nolossmeme && cd ~/apps/nolossmeme
cp deploy/vps/.env.example deploy/vps/.env && $EDITOR deploy/vps/.env     # Turnstile, keeper, faucet keys
docker compose -f deploy/vps/compose.yml --env-file deploy/vps/.env up -d --build
bash deploy/vps/install-nginx.sh                                            # nginx sites + certificates (once)
```

## Update

```bash
cd ~/apps/nolossmeme && git pull && docker compose -f deploy/vps/compose.yml --env-file deploy/vps/.env up -d --build
```

`.github/workflows/deploy-vps.yml` does the same on every push to `main` over SSH when the
`VPS_SSH_KEY`, `VPS_HOST` and `VPS_USER` secrets are set.

TLS: Let's Encrypt certificates live in `~/le/config/live/<host>` (same layout as the other
sites on this VPS) and are renewed by the existing certbot cron, whose deploy hook reloads nginx.
Issued 2026-11-09 for `nolossmeme.fun` and `api.nolossmeme.fun`. `www.nolossmeme.fun` only
redirects over HTTP until it has a DNS record and a certificate.

The indexer resumes from its cursor on restart (data in the `backend-data` volume); the first
start backfills from `START_BLOCK`.
