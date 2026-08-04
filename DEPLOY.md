# Deploy — Tickeware

## Arquitectura de producción

```
[CDN / static host]  Vue SPA (dist/)
        │
        │  HTTPS  /api/*  (mismo dominio o VITE_API_URL)
        ▼
[Node 18+]  Express API (backend/dist)
        │
        ▼
[Upstash Redis]  token solo en env del servidor
```

## 1. Backend

```bash
cd backend
cp .env.example .env
# Rellenar UPSTASH_*, API_KEY, CORS_ORIGIN, ALLOWED_TENANTS
npm install
npm run build
npm start   # o process manager (systemd, pm2, Docker)
```

Variables mínimas:

| Variable | Ejemplo |
|----------|---------|
| `PORT` | `3001` |
| `CORS_ORIGIN` | `https://app.tudominio.com` |
| `UPSTASH_REDIS_REST_URL` | `https://….upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | token **nuevo** (rotado si hubo VITE_*) |
| `API_KEY` | secreto largo aleatorio |
| `DEFAULT_TENANT` | `default` |
| `ALLOWED_TENANTS` | `default,acme` |
| `SOFT_DELETE_RETENTION_DAYS` | `30` |
| `RECEIPT_TTL_SECONDS` | `0` (sin TTL) o p.ej. `31536000` |

### Upstash ACL (ops)

En la consola Upstash, restringe el token a comandos usados (`GET`, `SET`, `MGET`, `DEL`, `EXPIRE`, `ZADD`, `ZREM`, `ZRANGE`, `LPUSH`, `LTRIM`) y prefijo `tickeware:*` si el plan lo permite.

### Reverse proxy (nginx ejemplo)

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:3001/api/;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
location / {
  root /var/www/tickeware/dist;
  try_files $uri $uri/ /index.html;
}
```

Con mismo origen, deja `VITE_API_URL` vacío en el build del front.

## 2. Frontend

```bash
cp .env.example .env.production.local
# VITE_API_URL=https://api.tudominio.com   # si API en otro origen
# VITE_API_KEY=...                         # mismo que backend API_KEY
# VITE_TENANT_ID=default
# VITE_API_ENABLED=true

npm install
npm run build
npm run check:bundle   # no debe haber upstash/token en dist/
```

Sirve `dist/` en Netlify/Vercel/nginx. Headers CSP: `public/_headers` (Netlify) o `vercel.json`.

**Nota CSP:** si la API está en otro origen, amplía `connect-src` en esos archivos con ese origen.

## 3. Checklist post-deploy

- [ ] `GET /api/health` → `{ ok: true, redis: true }`
- [ ] Front no muestra token Redis en DevTools → Network hacia upstash.io
- [ ] `npm run check:bundle` OK
- [ ] Crear / listar / borrar comprobante
- [ ] Borrado pide confirmación y deja de listarse (soft-delete)
- [ ] Sin `API_KEY` correcta → 401 en `/api/receipts`
- [ ] Token Upstash rotado si alguna vez estuvo en el browser

## 4. Purge de soft-deletes

```bash
curl -X POST https://api.../api/receipts/purge \
  -H "X-API-Key: $API_KEY" \
  -H "X-Tenant-Id: default"
```

Cron diario recomendado.
