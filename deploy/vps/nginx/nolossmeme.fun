# nolossmeme.fun: the landing -> landing container on 127.0.0.1:3181 (the dApp lives on app.nolossmeme.fun).
# Certificates: user certbot in /home/cuyvps/le (renewed by the existing cron, reload hook).
server {
    listen 80;
    listen [::]:80;
    server_name nolossmeme.fun www.nolossmeme.fun;
    access_log off;
    error_log /dev/null crit;
    location /.well-known/acme-challenge/ { root /home/cuyvps/acme; }
    location / { return 301 https://nolossmeme.fun$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name nolossmeme.fun;
    ssl_certificate     /home/cuyvps/le/config/live/nolossmeme.fun/fullchain.pem;
    ssl_certificate_key /home/cuyvps/le/config/live/nolossmeme.fun/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    access_log off;
    error_log /dev/null crit;
    server_tokens off;
    client_max_body_size 1m;
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    # The dApp moved to its own host; keep old links working.
    location ~ ^/app(/.*)?$ {
        return 301 https://app.nolossmeme.fun$1;
    }
    location / {
        proxy_pass http://127.0.0.1:3181;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
