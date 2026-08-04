# Auditoría de Seguridad — Tickeware

| Campo | Valor |
|-------|-------|
| **Proyecto** | Tickeware — Generador de Comprobantes de Pago |
| **Rol** | Senior QA / Security Review |
| **Fecha** | 2026-08-03 |
| **Alcance** | Código fuente frontend (`src/`), configuración Vite, secrets, dependencias, modelo de datos en Upstash Redis |
| **Stack** | Vue 3 + Vite 6 + Tailwind + Upstash Redis REST (cliente browser) |
| **Metodología** | Revisión estática de código, modelado de amenazas (STRIDE), OWASP ASVS L1, análisis de superficie de ataque y `npm audit` |

> **⚠️ Documento histórico (estado pre-migración).**  
> Tras la migración a BFF Express/TS el diseño cambió. Estado actual: [`SECURITY-AUDIT-STATUS.md`](./SECURITY-AUDIT-STATUS.md) y [`MIGRATION.md`](./MIGRATION.md).

---

## 1. Resumen ejecutivo

Tickeware es una SPA de una sola página que genera, imprime y (opcionalmente) persiste comprobantes de pago. **No existe backend propio**: la aplicación habla **directamente desde el navegador** con la API REST de Upstash Redis usando credenciales embebidas vía variables `VITE_*`.

### Nivel de seguridad global: **CRÍTICO / INACEPTABLE para producción con Redis**

| Dimensión | Calificación | Comentario |
|-----------|--------------|------------|
| **Confidencialidad** | 🔴 Crítica | Token Redis expuesto en el cliente; datos de terceros legibles por cualquiera con el bundle |
| **Integridad** | 🔴 Crítica | Cualquiera con el token puede crear, modificar o borrar todos los comprobantes |
| **Disponibilidad** | 🟠 Alta | Sin rate limiting ni cuotas por usuario; un atacante puede saturar o vaciar Redis |
| **Autenticación / Autorización** | 🔴 Crítica | Inexistentes |
| **Protección de datos (PII)** | 🟠 Alta | RUT, nombres, direcciones sin cifrado ni control de acceso |
| **Higiene de dependencias** | 🟡 Media | 1 vulnerabilidad high en `postcss` (dev/build) |
| **XSS / DOM** | 🟢 Baja-Media | Vue escapa por defecto; no hay `v-html` |
| **Superficie sin Redis** | 🟢 Aceptable | Modo local-only es relativamente benigno (riesgo residual en `localStorage`) |

> **Veredicto:** Si se despliega con Upstash configurado tal como está hoy, **cualquier visitante de la app obtiene control total de la base de datos**. El diseño actual es incompatible con un entorno multi-usuario o con datos reales de clientes.

---

## 2. Superficie de ataque

```
┌─────────────────────────────────────────────────────────────┐
│  Navegador (SPA Vue)                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Formulario   │  │ localStorage │  │ Bundle JS (Vite)  │  │
│  │ + Preview    │  │ issuer PII   │  │ VITE_* secrets    │  │
│  └──────┬───────┘  └──────────────┘  └─────────┬─────────┘  │
│         │                                      │            │
│         │  Bearer token en cada request        │            │
│         ▼                                      ▼            │
│  fetch → https://*.upstash.io  (REST Redis)                 │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
  Redis keys globales:
    tickeware:index
    tickeware:receipt:{uuid}
```

| Activo | Ubicación | Sensibilidad |
|--------|-----------|--------------|
| Token REST Upstash | `import.meta.env.VITE_*` → bundle JS | **Secreto de infraestructura** |
| Comprobantes (cliente, montos, RUT) | Redis + UI | PII / financiero |
| Datos del emisor | `localStorage` (`tickeware:issuer`) | PII |
| Endpoint Redis | Público en bundle | Infraestructura |

---

## 3. Hallazgos

Severidad según impacto × explotabilidad en un despliegue real.

### 🔴 CRIT-01 — Credenciales de Redis expuestas en el cliente (CWE-798 / CWE-200)

**Ubicación:** `.env.local`, `.env.example`, `src/lib/redis.js`

```js
const BASE  = import.meta.env.VITE_UPSTASH_REDIS_REST_URL
const TOKEN = import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN
// ...
headers: { Authorization: `Bearer ${TOKEN}` }
```

**Problema:** El prefijo `VITE_` hace que Vite **incrusté** URL y token en el JavaScript del navegador. Cualquier usuario puede abrir DevTools → Network / Sources y copiar el Bearer token.

**Impacto:**
- Lectura de **todos** los comprobantes (`ZREVRANGE` + `MGET`)
- Escritura arbitraria (`SET` / `ZADD`)
- Borrado masivo (`DEL` / `ZREM` / `DEL tickeware:index`)
- Uso del token contra **toda** la instancia Redis (no solo las keys de la app), si los permisos del token lo permiten

**Evidencia en repo local:** `.env.local` contiene un token real (no commiteado gracias a `.gitignore` / `*.local`, lo cual es positivo). Aun así, en **build de producción** el token viaja en el bundle.

**Remediación (obligatoria):**
1. **Revocar y rotar** el token actual en la consola de Upstash de inmediato.
2. Eliminar `VITE_UPSTASH_REDIS_REST_TOKEN` del frontend.
3. Introducir un **backend/BFF** (Cloudflare Worker, Vercel/Netlify Function, Express, etc.) que:
   - Guarde el token solo en variables de entorno de servidor
   - Exponga endpoints acotados (`POST /api/receipts`, `GET /api/receipts`, `DELETE /api/receipts/:id`)
   - Valide y saneé el payload
4. Alternativa mínima: Upstash + **auth de aplicación** + token de solo lectura no aplica aquí porque se necesita escritura; el BFF es el camino correcto.

---

### 🔴 CRIT-02 — Ausencia total de autenticación y autorización (CWE-306 / CWE-862)

**Ubicación:** Toda la capa de persistencia (`useReceipts.js`, `redis.js`)

No hay:
- Login / sesión / JWT / cookies HttpOnly
- Multi-tenancy (todos los users comparten `tickeware:index`)
- Ownership de comprobantes (`receipt.id` es UUID, pero cualquiera que lo conozca —o liste el índice— puede borrarlo)
- Roles (admin vs operador)

**Impacto:** Modelo de “base de datos compartida global”. No es viable para:
- Varios comercios
- Varios empleados
- Datos personales reales (Ley 19.628 Chile / GDPR si aplica)

**Remediación:**
- Autenticación (OAuth, magic link, o al menos API key por tenant en el BFF)
- Namespacing por usuario/tenant: `tickeware:{tenantId}:receipt:{id}`
- Autorización en cada mutación (solo el dueño o rol autorizado)

---

### 🔴 CRIT-03 — API Redis de escritura completa desde el browser (CWE-749)

**Ubicación:** `src/lib/redis.js`

El cliente expone primitivas genéricas:

```js
zadd, zrevrange, zrem, del, set, mget, saveReceipt, deleteReceipt, listReceipts
```

Aunque la UI solo usa un subconjunto, el **token** permite cualquier comando que Upstash acepte con ese token (p. ej. `FLUSHDB`, `KEYS *`, `CONFIG`, según plan/ACL).

**Remediación:**
- Token con **ACL mínimo** en Upstash (solo `GET/SET/DEL/ZADD/ZREM/ZRANGE/MGET` sobre prefijo `tickeware:*`) — mitiga, **no elimina** el problema si el token sigue en el cliente.
- Ideal: el token **nunca** llega al browser.

---

### 🟠 HIGH-01 — Datos personales sin cifrado ni control de acceso (CWE-311 / CWE-359)

**Datos tratados:**
| Campo | Fuente |
|-------|--------|
| Nombre empresa / cliente | Formulario → Redis |
| RUT / NIT / ID fiscal | Formulario → Redis |
| Dirección | Formulario → Redis |
| Montos, ítems, método de pago | Formulario → Redis |
| Emisor | `localStorage` |

**Problemas:**
- Persistidos en **texto plano** en Redis
- Visibles a cualquiera con el token (CRIT-01)
- Emisor en `localStorage` accesible a XSS / extensiones maliciosas / otros scripts del origen
- Sin política de retención ni derecho al olvido automatizado
- Sin clasificación de datos ni aviso de privacidad en la app

**Remediación:**
- Minimización de datos
- Cifrado en reposo (Upstash lo ofrece a nivel infra; valorar cifrado de campos sensibles a nivel app con clave por tenant)
- TLS ya lo provee Upstash HTTPS — mantener only-HTTPS en deploy
- Documentar base legal / privacidad si se procesan RUT reales

---

### 🟠 HIGH-02 — Sin validación de esquema en datos entrantes/salientes (CWE-20)

**Ubicación:** `useReceipts.js` → `redis.saveReceipt`, `redis.listReceipts` + `JSON.parse`

- Se hace `JSON.stringify(receipt)` sin validar forma, longitudes, tipos numéricos, ni límites de ítems.
- Al leer: `JSON.parse(r)` sin try/catch por elemento ni schema (Zod/Valibot). Un valor corrupto o malicioso en Redis puede romper el parseo o inyectar propiedades inesperadas en el estado Vue.
- `taxRate`, `unitPrice`, `quantity` no se acotan en servidor (solo UI con `min`/`max` HTML, fácilmente bypasseable).
- IDs de borrado no se validan como UUID antes de armar la key.

**Impacto:**
- DoS por payloads enormes (costo Redis + memoria browser)
- Estados inconsistentes en UI
- Posible prototype pollution si en el futuro se hace merge inseguro de objetos parseados (hoy el riesgo es bajo porque Vue no mezcla ciegamente, pero la higiene es mala)

**Remediación:**
```js
// Ejemplo de contrato a validar en BFF
const ReceiptSchema = z.object({
  client: z.object({ name: z.string().max(200), taxId: z.string().max(50), address: z.string().max(500) }),
  items: z.array(...).max(100),
  taxRate: z.number().min(0).max(100),
  // ...
})
```

---

### 🟠 HIGH-03 — Operaciones destructivas sin confirmación ni soft-delete (CWE-463)

**Ubicación:** `ReceiptHistory.vue` → `handleDelete` → `deleteReceipt`

- Borrado **inmediato** y **permanente** (pipeline `DEL` + `ZREM`)
- Sin modal de confirmación (a diferencia de “Nuevo” que sí usa `window.confirm`)
- Sin soft-delete / papelera / audit log
- Sin autenticación (cualquiera con token borra todo)

**Remediación:** Confirmación UI + soft-delete + audit trail + auth.

---

### 🟠 HIGH-04 — Namespace Redis global y predecible (CWE-639)

Keys fijas:
- `tickeware:index`
- `tickeware:receipt:{id}`

Cualquier despliegue que reutilice la misma DB Upstash **comparte** el historial. No hay aislamiento por ambiente (`dev`/`prod`) ni por organización.

**Remediación:** Prefijo por env y tenant: `${APP}:${ENV}:${TENANT}:receipt:{id}`.

---

### 🟡 MED-01 — Sin cabeceras de seguridad HTTP / CSP (CWE-693)

**Ubicación:** `index.html`, `vite.config.js` (sin plugin de headers)

No se definen:
| Header | Riesgo si falta |
|--------|-----------------|
| `Content-Security-Policy` | XSS, supply-chain de scripts |
| `X-Content-Type-Options: nosniff` | MIME sniffing |
| `Referrer-Policy` | Fuga de URLs |
| `Permissions-Policy` | APIs del browser indebidas |
| `Strict-Transport-Security` | Downgrade HTTP (en hosting) |

`index.html` carga Google Fonts desde CDN — aceptable, pero debe reflejarse en CSP (`style-src` / `font-src`).

**Remediación:** Configurar headers en el hosting (Netlify `_headers`, Vercel `headers`, Cloudflare, nginx) + CSP estricta.

---

### 🟡 MED-02 — Fuga de información en errores (CWE-209)

**Ubicación:** `useReceipts.js` (`toErrorState` guarda `stack`), `redis.js` (incluye `json.error` de Upstash), UI muestra `error.message`.

- El stack se almacena en estado reactivo (aunque la UI solo pinta `message`).
- Mensajes tipo `Upstash HTTP 401: ...` revelan stack tecnológico y fallos de auth.

**Remediación:** Mapear a mensajes genéricos de usuario; loguear detalle solo en servidor.

---

### 🟡 MED-03 — Dependencia vulnerable: `postcss` (High)

```
npm audit → 1 high
postcss <= 8.5.22
GHSA-r28c-9q8g-f849 / GHSA-fxqj-rqcc-2cmp (path traversal via sourceMappingURL)
```

**Contexto:** Afecta principalmente **build-time** (devDependency transitiva de Tailwind/PostCSS), no el runtime del browser del usuario final. Riesgo real bajo en CI controlado, pero debe parchearse.

**Remediación:** `npm audit fix` y pin de versión segura.

---

### 🟡 MED-04 — Sin rate limiting ni protección anti-abuso

- Cada visita lista hasta 100 comprobantes
- Guardar/borrar sin throttle
- Timeout de 10s (`REDIS_REQUEST_TIMEOUT_MS`) mitiga hangs, no abuso
- Un bot puede agotar cuota Upstash o llenar la DB

**Remediación:** Rate limit en BFF (por IP / por usuario) + cuotas Upstash + captcha en endpoints públicos si aplica.

---

### 🟡 MED-05 — `localStorage` para PII del emisor (CWE-922)

**Ubicación:** `useIssuer.js`

- Persiste nombre, taxId, dirección sin cifrado
- Sobrevive a la sesión; accesible a cualquier JS del origen
- `JSON.parse` con try/catch (bien) pero sin validación de forma

**Remediación:** Si no hay auth, documentar el riesgo; con auth, preferir backend. Evitar datos sensibles innecesarios en `localStorage`.

---

### 🟢 LOW-01 — XSS: postura generalmente buena

- No hay `v-html`, `innerHTML`, `eval`, ni `document.write`
- Interpolación Vue (`{{ }}`) escapa HTML por defecto
- Riesgo residual: si en el futuro se imprime HTML “enriquecido” o se usa `v-html` con datos de Redis, el vector se activa (sobre todo con CRIT-01 permitiendo plantillas maliciosas en DB)

**Recomendación:** Mantener política “nunca `v-html` con datos de usuario”; sanitizar si se introduce.

---

### 🟢 LOW-02 — IDs con `crypto.randomUUID` (buena práctica)

`utils.uid()` usa `crypto.randomUUID` con fallback. Correcto para no adivinar IDs; **no sustituye** autorización (IDOR sigue existiendo vía listado global).

---

### 🟢 LOW-03 — `.env.local` correctamente ignorado por Git

`.gitignore` cubre `.env.local` y `*.local`. El token **no** está en el historial git revisado. Bien.

⚠️ El token **sí** está en el working tree local y se embebéra en `dist/` al hacer `npm run build`.

---

### 🟢 LOW-04 — CORS / origen

Upstash REST acepta requests desde el browser con el token. No hay allowlist de orígenes a nivel app. Mitigar con BFF.

---

## 4. Matriz STRIDE (resumen)

| Amenaza | ¿Aplica? | Ejemplo en Tickeware |
|---------|----------|----------------------|
| spoofing | Sí | Suplantación de “emisor” sin auth; cualquiera guarda comprobantes “como” la empresa |
| Tampering | Sí | Alteración/borrado de receipts en Redis con token robado |
| Repudiation | Sí | Sin audit log de quién creó/borró |
| Information Disclosure | Sí | Token en bundle; PII en Redis/listado |
| Denial of Service | Sí | Flood de `SET`/`pipeline`; vaciado de índice |
| Elevation of Privilege | Sí | Token client-side = privilegios de DB completos |

---

## 5. Cumplimiento y privacidad (orientativo)

| Control | Estado |
|---------|--------|
| Cifrado en tránsito (HTTPS a Upstash) | ✅ (si se sirve la app por HTTPS) |
| Cifrado en reposo controlado por app | ❌ |
| Control de acceso a PII | ❌ |
| Registro de accesos / auditoría | ❌ |
| Retención y borrado documentados | ❌ (borrado hard sin política) |
| Secrets fuera del cliente | ❌ |
| SBOM / escaneo CI de deps | ❌ |

Si se usan RUT y datos de clientes reales en Chile, el diseño actual **no es adecuado** para cumplir expectativas mínimas de debida diligencia en protección de datos.

---

## 6. Lo que está bien

| Práctica | Detalle |
|----------|---------|
| `.env.local` en `.gitignore` | Evita commit accidental de secrets |
| Timeout en requests Redis | `REDIS_REQUEST_TIMEOUT_MS = 10000` + `AbortController` |
| Cancelación al desmontar | `useReceipts` aborta fetch pendientes |
| Manejo HTTP de errores | `res.ok` + mensaje de error Upstash |
| Pipeline atómico save/delete | Consistencia índice ↔ documento |
| Vue text interpolation | Mitiga XSS clásico |
| `crypto.randomUUID` | IDs no secuenciales |
| Proyecto `private: true` | No se publica por error a npm |
| Superficie npm de producción pequeña | Solo `vue` + `lucide-vue-next` |

---

## 7. Scorecard

| Categoría OWASP / ASVS | Score (0–10) | Notas |
|------------------------|--------------|-------|
| V2 Authentication | 0 | No existe |
| V3 Session | 0 | N/A / no existe |
| V4 Access Control | 0 | DB compartida global |
| V5 Validation | 2 | Solo validación UI mínima |
| V6 Cryptography | 3 | HTTPS de terceros; secrets mal ubicados |
| V7 Error Handling | 5 | Timeout y errores presentes; posible info leak |
| V8 Data Protection | 1 | PII en claro + token cliente |
| V9 Communication | 6 | HTTPS a Upstash; app depende del hosting |
| V10 Malicious Code | 7 | Código simple, sin ofuscación sospechosa |
| V14 Config | 2 | `VITE_*` secrets; sin security headers |
| **Promedio ponderado** | **~2.5 / 10** | **No apto para producción con datos reales** |

### Escala de madurez

| Nivel | Descripción | Tickeware |
|-------|-------------|-----------|
| L0 | Prototipo inseguro | ← **aquí (con Redis)** |
| L1 | MVP con auth básica y secrets en servidor | — |
| L2 | Multi-tenant + validación + headers + audit | — |
| L3 | Hardened (CSP strict, WAF, threat model vivo, pentest) | — |

**Modo solo local (sin variables Upstash):** madurez ~L1- bajo (herramienta personal en el browser).  
**Modo con Redis actual:** **L0**.

---

## 8. Plan de remediación priorizado

### P0 — Antes de cualquier deploy público con Redis

1. **Rotar** el token de Upstash expuesto en `.env.local` / cualquier build previo.
2. **Dejar de usar** `VITE_UPSTASH_REDIS_REST_TOKEN` en el frontend.
3. Implementar **BFF/API** con el token solo en server env.
4. Añadir **autenticación** mínima (aunque sea un solo usuario admin con session cookie HttpOnly).
5. Confirmar que `dist/` nunca se sirve con secrets embebidos (revisar bundle: `rg "upstash|gQAAAA" dist`).

### P1 — Semana 1–2

6. Validación de esquema (Zod) en el BFF.
7. Namespacing por tenant/usuario.
8. Confirmación + soft-delete en borrados.
9. Security headers + CSP en hosting.
10. `npm audit fix` (postcss).
11. Rate limiting.

### P2 — Hardening

12. Audit log de mutaciones.
13. ACL de token Upstash por prefijo.
14. Tests de seguridad (token no en bundle, auth en mutaciones).
15. Política de retención de comprobantes.
16. Documentar privacidad / uso de PII.
17. Monitoreo de cuotas y alertas Upstash.

### Arquitectura objetivo (recomendada)

```
Browser (Vue)
    │  cookie/session o Bearer de app (NO token Redis)
    ▼
API / Worker (secrets en env de servidor)
    │  validación + authz + rate limit
    ▼
Upstash Redis (token server-side, ACL por prefijo)
```

---

## 9. Casos de prueba QA de seguridad (checklist)

| ID | Caso | Resultado esperado hoy | Resultado esperado post-fix |
|----|------|------------------------|-------------------------------|
| S-01 | Inspeccionar bundle/`import.meta.env` | Token visible | Token ausente |
| S-02 | Copiar Bearer y listar receipts con curl | 200 + datos | 401 sin auth de app |
| S-03 | DELETE de receipt ajeno | Éxito | 403 |
| S-04 | Payload con 10k ítems | Se acepta | 400 |
| S-05 | `taxRate: 999999` | Se guarda | 400 |
| S-06 | Borrar sin confirmación UI | Borra al click | Pide confirmación |
| S-07 | XSS en `client.name` = `<img onerror=...>` | Texto escapado (OK) | Sigue escapado |
| S-08 | App sin login en ruta de historial | Acceso total | Redirect login |
| S-09 | `npm audit` en CI | 1 high | 0 high explotables |
| S-10 | Response headers en prod | Sin CSP | CSP + nosniff + HSTS |

---

## 10. Conclusión

Tickeware como **generador local de comprobantes** (sin Redis) es un prototipo razonable con buena higiene de UI y bajo riesgo.  

En cuanto se activa la persistencia Upstash con el diseño actual (**token `VITE_*` en el browser + keys globales + cero auth**), el nivel de seguridad cae a **crítico**:

> **Cualquier persona que cargue la aplicación puede leer, crear y destruir todos los comprobantes y, potencialmente, abusar de la instancia Redis.**

**No se recomienda** usar esta configuración con datos reales de clientes ni en un despliegue público hasta completar al menos las acciones **P0**.

---

## 11. Referencias

- [OWASP ASVS 4.0](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Top 10 — A01 Broken Access Control, A02 Cryptographic Failures, A07 Identification/Auth Failures](https://owasp.org/Top10/)
- [Vite: Env variables and modes](https://vitejs.dev/guide/env-and-mode.html) — *“env variables prefixed with VITE_ are exposed to the client”*
- [Upstash Redis REST](https://upstash.com/docs/redis/features/restapi)
- CWE-798 (Hard-coded credentials), CWE-306 (Missing authentication), CWE-200 (Information exposure)

---

*Informe generado mediante revisión estática de código. No sustituye un pentest ni un scan dinámico (DAST) sobre un entorno desplegado. Se recomienda re-auditar tras implementar el BFF y la autenticación.*
