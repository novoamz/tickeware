# Estado post-migración (vs SECURITY-AUDIT.md)

La auditoría original (2026-08-03) describía **token Redis en el browser**. Ese diseño **ya no aplica**.

| Hallazgo original | Estado actual |
|-------------------|---------------|
| CRIT-01 Token en `VITE_*` | **Mitigado** — token solo en `backend/.env` |
| CRIT-02 Sin auth | **Parcial** — `API_KEY` opcional + tenant allowlist; sin OAuth multi-usuario |
| CRIT-03 Comandos Redis desde browser | **Mitigado** — solo REST acotado |
| HIGH validación | **Mitigado** — Zod en API |
| Rate limit | **Mitigado** — middleware en memoria |
| Soft-delete / confirmación | **Mitigado** |
| Multi-tenant | **Mitigado** — `X-Tenant-Id` + keys `tickeware:{tenant}:*` |
| Audit log | **Mitigado** — console + lista Redis |
| CSP SPA | **Mitigado** — `public/_headers`, `vercel.json` |
| ACL Upstash | **Ops manual** — ver `DEPLOY.md` |
| Auth sesión/OAuth | **Pendiente** (fase futura) |

**Madurez estimada:** L1+ (MVP con secrets en servidor, validación, rate limit, tenant básico).  
Re-auditar cuando exista login de usuario real.
