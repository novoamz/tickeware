# Tickeware — Generador de Comprobantes de Pago

Aplicación web para generar, previsualizar, imprimir y guardar comprobantes de pago. Construida con **Vue 3**, **Vite** y **Tailwind CSS**, con API **TypeScript** y persistencia opcional en **Upstash Redis**.

## Arquitectura

```
Browser (Vue)  ──►  API REST (Express/TS)  ──►  Upstash Redis
                         ▲
                   secrets solo aquí
```

El frontend **nunca** recibe el token de Redis. Las credenciales viven solo en `backend/.env`.

## Características

- Formulario de ingreso de datos del cliente, emisor, método de pago y detalle de ítems
- Vista previa en vivo del comprobante
- Impresión y exportación a PDF desde el navegador
- Guardado y carga de comprobantes vía API + Upstash Redis
- Historial de comprobantes con carga, impresión y eliminación
- Configuración del emisor persistida en `localStorage`
- Formato monetario en pesos chilenos (CLP)

## Requisitos

- Node.js 20+

## Instalación

```bash
npm install
# instala también dependencias de backend/ (postinstall)
```

## Configuración

### Backend (Redis)

```bash
cp backend/.env.example backend/.env
```

Edita `backend/.env` con tus credenciales de [Upstash](https://console.upstash.com) (REST URL + token).

Opcional: define `API_KEY` en el backend y el mismo valor en `VITE_API_KEY` del front para proteger el CRUD.

### Frontend

```bash
cp .env.example .env.local
```

En desarrollo deja `VITE_API_URL` vacío: Vite hace proxy de `/api` → `http://localhost:3001`.

Plan de migración: [`MIGRATION.md`](./MIGRATION.md) · Deploy: [`DEPLOY.md`](./DEPLOY.md) · Seguridad actual: [`SECURITY-AUDIT-STATUS.md`](./SECURITY-AUDIT-STATUS.md).

## Desarrollo

En dos terminales:

```bash
# Terminal 1 — API
npm run dev:api

# Terminal 2 — Frontend
npm run dev
```

- Frontend: http://localhost:5173  
- API health: http://localhost:3001/api/health  

Si no configuras Redis, la app sigue funcionando para generar/imprimir comprobantes; el historial quedará deshabilitado.

## API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/health` | Estado del servicio, Redis y si exige API key |
| `GET` | `/api/receipts` | Lista los últimos 100 comprobantes |
| `POST` | `/api/receipts` | Crea un comprobante `{ "data": { ... } }` |
| `DELETE` | `/api/receipts/:id` | Elimina un comprobante |

Rate limit: ~120 req/min por IP. Si `API_KEY` está definido, receipts requieren `X-API-Key` o `Authorization: Bearer`.

## Producción

```bash
npm run build          # frontend → dist/
npm run build:api      # backend → backend/dist/
npm run start:api      # node backend/dist/index.js
```

Sirve el frontend estático y apunta `VITE_API_URL` al origen público de la API (o usa el mismo dominio con reverse proxy a `/api`).

## Tecnologías

- [Vue 3](https://vuejs.org/) — Frontend
- [Vite](https://vitejs.dev/) — Build tool
- [Express](https://expressjs.com/) + TypeScript — API
- [Upstash Redis](https://upstash.com/) — Persistencia
- [Tailwind CSS](https://tailwindcss.com/) — Estilos
- [Lucide](https://lucide.dev/) — Iconos

## Licencia

MIT
