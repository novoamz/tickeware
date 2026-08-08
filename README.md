# Tickeware — Generador de Comprobantes de Pago

Aplicación web para generar, previsualizar, imprimir y guardar comprobantes de pago. Construida con **Vue 3**, **Vite** y **Tailwind CSS**, con persistencia en **Upstash Redis** y fallback local en **IndexedDB**.

## Arquitectura

```
Browser (Vue)  ──►  Upstash Redis REST  (preferido)
                 └──►  IndexedDB         (si no hay Upstash o falla la red)
```

SPA estática: no hay backend propio. Las credenciales REST de Upstash se configuran con variables `VITE_*` y se embeben en el bundle del cliente.

Cuando Redis responde, los comprobantes se cachean también en IndexedDB para uso offline. Si Upstash no está configurado o no hay conexión, la app guarda y lista solo en IndexedDB (por dispositivo/navegador).

> **Nota de seguridad:** el token Redis queda visible en el navegador. Úsalo solo en prototipos o uso personal. Para producción multi-usuario, vuelve a un BFF/API con secrets de servidor.

## Características

- Formulario de ingreso de datos del cliente, emisor, método de pago y detalle de ítems
- Vista previa en vivo del comprobante
- Impresión y exportación a PDF desde el navegador
- Guardado y carga de comprobantes en Upstash Redis
- Historial de comprobantes con carga, impresión y eliminación
- Configuración del emisor persistida en `localStorage`
- Formato monetario en pesos chilenos (CLP)

## Requisitos

- Node.js 20+

## Instalación

```bash
npm install
```

## Configuración

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales de [Upstash](https://console.upstash.com) (REST URL + token):

```env
VITE_UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
VITE_UPSTASH_REDIS_REST_TOKEN=...
# opcional
# VITE_TENANT_ID=default
```

Si no configuras Redis, el historial usa **IndexedDB** del navegador (datos solo en ese dispositivo).

## Desarrollo

```bash
npm run dev
```

- Frontend: http://localhost:5173

## Producción

```bash
npm run build      # → dist/
npm run preview    # opcional, sirve dist/
```

Sirve el contenido de `dist/` como sitio estático (Vercel, Netlify, Nginx, etc.). El CSP de `vercel.json` / `public/_headers` permite `connect-src` hacia `https://*.upstash.io`.

## Tecnologías

- [Vue 3](https://vuejs.org/) — Frontend
- [Vite](https://vitejs.dev/) — Build tool
- [Upstash Redis](https://upstash.com/) — Persistencia (REST desde el browser)
- [Tailwind CSS](https://tailwindcss.com/) — Estilos
- [Lucide](https://lucide.dev/) — Iconos

## Licencia

MIT
