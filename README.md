# Tickeware — Generador de Comprobantes de Pago

Aplicación web para generar, previsualizar, imprimir y guardar comprobantes de pago. Construida con **Vue 3**, **Vite** y **Tailwind CSS**, con persistencia opcional en **Upstash Redis**.

## Características

- Formulario de ingreso de datos del cliente, emisor, método de pago y detalle de ítems
- Vista previa en vivo del comprobante
- Impresión y exportación a PDF desde el navegador
- Guardado y carga de comprobantes mediante Upstash Redis (serverless)
- Historial de comprobantes guardados con opciones de carga, impresión y eliminación
- Configuración del emisor persistida en `localStorage`
- Formato monetario en pesos chilenos (CLP)

## Requisitos

- Node.js 18+

## Instalación y uso

```bash
npm install
npm run dev
```

Para construir para producción:

```bash
npm run build
npm run preview
```

## Configuración de Redis (opcional)

Copia el archivo de ejemplo y completa tus credenciales de Upstash:

```bash
cp .env.example .env.local
```

Luego edita `.env.local` con los valores de tu base de datos en [Upstash](https://console.upstash.com). Si no configuras estas variables, la aplicación funciona igual pero sin persistencia ni historial.

## Tecnologías

- [Vue 3](https://vuejs.org/) — Framework frontend
- [Vite](https://vitejs.dev/) — Build tool
- [Tailwind CSS](https://tailwindcss.com/) — Estilos utilitarios
- [Lucide](https://lucide.dev/) — Iconos
- [Upstash Redis](https://upstash.com/) — Base de datos serverless

## Licencia

MIT
