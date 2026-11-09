#!/usr/bin/env bash
# Install the host nginx sites and issue certificates for nolossmeme.fun, app. and api.
# Runs as the deploy user (no root shell): certbot keeps its state in ~/le like the other sites on
# this VPS (renewed by the existing cron with `sudo systemctl reload nginx` as the deploy hook), and
# the two site files are copied into /etc/nginx through a throwaway container (the user is in the
# docker group). Only `nginx -t` and `systemctl reload nginx` need sudo, and both are NOPASSWD here.
#
#   bash deploy/vps/install-nginx.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
LE=(--config-dir "$HOME/le/config" --work-dir "$HOME/le/work" --logs-dir "$HOME/le/logs")
WEBROOT="$HOME/acme"
SITES=(nolossmeme.fun app.nolossmeme.fun api.nolossmeme.fun)
mkdir -p "$WEBROOT/.well-known/acme-challenge" "$HOME/le/config"

install_sites() { # $1 = directory with the site files
  docker run --rm -v /etc/nginx:/n -v "$1":/src:ro alpine:3.20 sh -c '
    for s in nolossmeme.fun app.nolossmeme.fun api.nolossmeme.fun; do
      cp "/src/$s" "/n/sites-available/$s" && chmod 644 "/n/sites-available/$s"
      ln -sf "/etc/nginx/sites-available/$s" "/n/sites-enabled/$s"
    done'
  sudo -n /usr/sbin/nginx -t
  sudo -n /usr/bin/systemctl reload nginx
}

# 1) HTTP-only stage: just the first server block (port 80 + ACME webroot) of each site.
STAGE="$(mktemp -d)"
declare -A PORT=([nolossmeme.fun]=3181 [app.nolossmeme.fun]=3183 [api.nolossmeme.fun]=3182)
for s in "${SITES[@]}"; do
  awk 'BEGIN{n=0} /^server \{/{n++} n<=1' "$HERE/nginx/$s" \
    | sed "s|return 301 https://[^;]*;|proxy_pass http://127.0.0.1:${PORT[$s]};|" > "$STAGE/$s"
done
need_stage=0; for s in "${SITES[@]}"; do [ -e "$HOME/le/config/live/$s/fullchain.pem" ] || need_stage=1; done
[ "$need_stage" = 0 ] || install_sites "$STAGE"

# 2) certificates (no-op while they are valid)
for s in "${SITES[@]}"; do
  certbot certonly --webroot -w "$WEBROOT" -d "$s" "${LE[@]}" --non-interactive --agree-tos --keep-until-expiring --register-unsafely-without-email
done

# 3) TLS sites
install_sites "$HERE/nginx"
rm -rf "$STAGE"
echo "done: https://nolossmeme.fun  https://app.nolossmeme.fun  https://api.nolossmeme.fun/health"
