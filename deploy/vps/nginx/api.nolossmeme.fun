# Host nginx: TLS for api.nolossmeme.fun -> backend container on 127.0.0.1:3182
server {
    listen 80;
    listen [::]:80;
    server_name api.nolossmeme.fun;
    access_log off;
    error_log /dev/null crit;
    location /.well-known/acme-challenge/ { root /var/www/acme; }
    location / { return 301 https://api.nolossmeme.fun$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.nolossmeme.fun;
    ssl_certificate     /etc/letsencrypt/live/api.nolossmeme.fun/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.nolossmeme.fun/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    access_log off;
    error_log /dev/null crit;
    server_tokens off;
    client_max_body_size 64k;
    location / {
        proxy_pass http://127.0.0.1:3182;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 30s;
    }
}
