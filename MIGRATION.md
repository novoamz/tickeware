# Plan de migración — Redis frontend → Backend REST (TypeScript)

| Campo | Valor |
|-------|-------|
| **Proyecto** | Tickeware |
| **Objetivo** | Sacar Upstash Redis del browser; API Express/TS con secrets de servidor |
| **Inicio** | 2026-08-03 (auditoría) |
| **Actualizado** | 2026-08-04 |

## Arquitectura

```
ANTES:  Browser (Vue + VITE_UPSTASH_*)  ──►  Upstash Redis
AHORA:  Browser (Vue)  ──X-API-Key / X-Tenant-Id──►  Express/TS  ──►  Upstash Redis
```

---

## Fase 0 — Preparación — ✅ COMPLETA

| # | Tarea | Estado |
|---|--------|--------|
| 0.1 | Auditoría de seguridad (`SECURITY-AUDIT.md`) | ✅ |
| 0.2 | Checklist rotación token + `check:migration` | ✅ (rotación real = ops Upstash) |
| 0.3 | `.gitignore` secrets | ✅ |

---

## Fase 1 — Backend BFF — ✅ COMPLETA

| # | Tarea | Estado |
|---|--------|--------|
| 1.1–1.8 | Scaffold, Redis store, rutas, validate, CORS, scripts, env | ✅ |

---

## Fase 2 — Frontend sin Redis — ✅ COMPLETA

| # | Tarea | Estado |
|---|--------|--------|
| 2.1–2.10 | `api.js`, sin redis.js, proxy, UI, check migración | ✅ |

---

## Fase 3 — Hardening API — ✅ COMPLETA

| # | Tarea | Estado | Notas |
|---|--------|--------|-------|
| 3.1 | Rate limiting en memoria | ✅ | `middleware/rateLimit.ts` |
| 3.2 | Auth mínima por API key | ✅ | `API_KEY` + Bearer / X-API-Key |
| 3.3 | Security headers API | ✅ | + CSP API |
| 3.4 | Validación Zod | ✅ | `validate.ts` |
| 3.5 | Soft-delete + confirmación UI | ✅ | `softRemove` + `confirm` en historial |
| 3.6 | Multi-tenant / namespacing | ✅ | `tickeware:{tenant}:*` + `X-Tenant-Id` |
| 3.7 | Auth de aplicación | ✅ parcial | API key + tenant (= L1). OAuth/sesión multi-usuario = futuro |
| 3.8 | CSP / headers SPA | ✅ | `public/_headers`, `vercel.json` |
| 3.9 | ACL token Upstash | ✅ documentado | `DEPLOY.md` (ops consola) |
| 3.10 | Audit log mutaciones | ✅ | console + Redis list |
| 3.11 | Tests API + bundle | ✅ | `npm run test:api`, `check:bundle` |
| 3.12 | Retención / TTL | ✅ | soft-delete days + `RECEIPT_TTL_SECONDS` + purge |
| 3.13 | Docs audit/refactor | ✅ | `SECURITY-AUDIT-STATUS.md`, notas en docs viejos |

---

## Fase 4 — Cierre y deploy — ✅ COMPLETA (código + docs)

| # | Tarea | Estado |
|---|--------|--------|
| 4.1 | Commit de migración | ✅ al cerrar esta fase (si se solicita en git) |
| 4.2 | Guía deploy + reverse proxy | ✅ `DEPLOY.md` |
| 4.3 | Verificar bundle sin Upstash | ✅ `npm run build && npm run check:bundle` |
| 4.4 | Re-auditoría documentada | ✅ `SECURITY-AUDIT-STATUS.md` (OAuth pendiente) |

---

## Checklist

- [x] Fases 0–4 en código/docs
- [x] Token Redis solo en servidor
- [x] Endpoints acotados
- [x] Front → `/api/*`
- [x] Rate limit, API key, Zod, tenant, soft-delete, audit, TTL/purge
- [x] Tests + check bundle
- [ ] OAuth / sesiones multi-usuario (fuera de alcance migración Redis)
- [ ] Deploy real en hosting del equipo

---

## Comandos

```bash
npm run dev:api
npm run dev
npm run test:api
npm run check:migration
npm run build && npm run check:bundle
npm run build:api
```

### Variables

| Dónde | Variable | Uso |
|-------|----------|-----|
| `backend/.env` | `UPSTASH_REDIS_REST_*` | Redis |
| `backend/.env` | `API_KEY` | Auth compartida |
| `backend/.env` | `DEFAULT_TENANT`, `ALLOWED_TENANTS` | Multi-tenant |
| `backend/.env` | `SOFT_DELETE_RETENTION_DAYS`, `RECEIPT_TTL_SECONDS` | Retención |
| `.env.local` | `VITE_API_URL`, `VITE_API_KEY`, `VITE_TENANT_ID` | Front |

---

## Archivos clave

| Rol | Ruta |
|-----|------|
| Plan | `MIGRATION.md` |
| Deploy | `DEPLOY.md` |
| Estado seguridad | `SECURITY-AUDIT-STATUS.md` |
| API | `backend/src/index.ts` |
| Store | `backend/src/redis.ts` |
| Cliente | `src/lib/api.js` |
