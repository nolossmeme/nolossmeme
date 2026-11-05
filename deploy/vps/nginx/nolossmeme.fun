# Host nginx: TLS for nolossmeme.fun (landing + /app) -> site container on 127.0.0.1:3181
server {
    listen 80;
    listen [::]:80;
    server_name nolossmeme.fun www.nolossmeme.fun;
    access_log off;
    error_log /dev/null crit;
    location /.well-known/acme-challenge/ { root /var/www/acme; }
    location / { return 301 https://nolossmeme.fun$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.nolossmeme.fun;
    ssl_certificate     /etc/letsencrypt/live/nolossmeme.fun/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nolossmeme.fun/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    server_tokens off;
    return 301 https://nolossmeme.fun$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name nolossmeme.fun;
    ssl_certificate     /etc/letsencrypt/live/nolossmeme.fun/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nolossmeme.fun/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    access_log off;
    error_log /dev/null crit;
    server_tokens off;
    client_max_body_size 1m;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    location / {
        proxy_pass http://127.0.0.1:3181;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
