#!/usr/bin/env bash
# Run ONCE as root on the VPS after DNS for nolossmeme.fun, www and api point here:
#   sudo bash deploy/vps/install-nginx.sh you@example.com
# 1) installs HTTP-only sites with the ACME webroot, 2) issues certificates, 3) installs the TLS sites.
set -euo pipefail
EMAIL="${1:?letsencrypt contact email}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p /var/www/acme

stage_http() {
  for site in nolossmeme.fun api.nolossmeme.fun; do
    # keep only the port-80 server block until certificates exist
    awk 'BEGIN{p=1} /listen 443/{p=0} p' "$HERE/nginx/$site" | awk 'BEGIN{d=0} /^server \{/{d++} d<=1' > "/etc/nginx/sites-available/$site"
    ln -sf "/etc/nginx/sites-available/$site" "/etc/nginx/sites-enabled/$site"
  done
  nginx -t && systemctl reload nginx
}

stage_http
certbot certonly --webroot -w /var/www/acme -d nolossmeme.fun -d www.nolossmeme.fun --non-interactive --agree-tos -m "$EMAIL" --keep-until-expiring
certbot certonly --webroot -w /var/www/acme -d api.nolossmeme.fun --non-interactive --agree-tos -m "$EMAIL" --keep-until-expiring
for site in nolossmeme.fun api.nolossmeme.fun; do
  install -m 644 "$HERE/nginx/$site" "/etc/nginx/sites-available/$site"
done
nginx -t && systemctl reload nginx
echo "done: https://nolossmeme.fun  https://nolossmeme.fun/app/  https://api.nolossmeme.fun/health"
