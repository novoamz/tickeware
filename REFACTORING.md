# Informe de Refactorización — Tickeware

## Resumen de Hallazgos

| Prioridad | Problema | Archivo(s) | Impacto |
|-----------|----------|------------|---------|
| **1** | Template de comprobante duplicado ~120 líneas | `ReceiptPreview.vue`, `ReceiptHistory.vue` | Violación DRY, mantenimiento duplicado |
| **2** | `formatDate()`, `calcSubtotal()`, `calcTotal()` duplicados | `ReceiptPreview.vue`, `ReceiptHistory.vue` | Código duplicado, implementaciones inconsistentes |
| **3** | Sin timeout en peticiones Redis | `redis.js:6-18,20-32` | Hangs de red bloquean la UI indefinidamente |
| **4** | Sin validación de estado HTTP en cliente Redis | `redis.js:15-17` | Fallos silenciosos en respuestas no-2xx |
| **5** | Timer de toast sin limpieza al desmontar | `App.vue:36-42` | Fuga de memoria / closure obsoleto |
| **6** | Números mágicos hardcodeados (tasa 16, toast 3500, etc.) | Múltiples archivos | Mala mantenibilidad |
| **7** | `window.print()` asume global del navegador | `ReceiptPreview.vue:39`, `ReceiptHistory.vue:246` | Rompe en SSR |
| **8** | Sin cancelación de peticiones al desmontar | `useReceipts.js:58` | Actualizaciones de estado en componente desmontado |
| **9** | Escape key en elemento no focuseable | `IssuerSetup.vue:40` | Tecla Escape no funciona como se espera |
| **10** | `Intl.NumberFormat` recreado en cada llamada | `utils.js:1-8` | Penalización de rendimiento en listas |

---

## 1. `src/App.vue`

### A2 — Watcher con `deep: true` innecesario (línea 32)
`watch(issuer, ..., { deep: true })` es excesivo porque `issuer` tiene solo 3 campos planos. Al reemplazarse completo con `issuer.value = trimmed`, un shallow watch basta.

**Sugerencia**: Eliminar `deep: true`.

### A3 — Fuga de memoria en timer del toast (líneas 36–42)
`let toastTimer = null` no se limpia si el componente se desmonta mientras el timer está pendiente.

**Sugerencia**: Extraer a un composable `useToast` que maneje el ciclo de vida, o limpiar con `onUnmounted`.

### A4 — Spread innecesario en `handleLoad` (líneas 63–66)
```js
receiptData.value = {
  ...data,          // data.issuer se descarta inmediatamente
  issuer: { ...issuer.value },
}
```

**Sugerencia**: Destructurar `issuer` aparte:
```js
const { issuer: _, ...rest } = data
receiptData.value = { ...rest, issuer: { ...issuer.value }, items: ... }
```

### A5 — Botones duplicados para issuer (responsive)
Dos `<button>` separados para mobile/desktop con el mismo `@click`.

**Sugerencia**: Un solo botón con clases responsive que cambien el contenido.

### A6 — Toast debería ser componente
Markup y lógica condicional del toast viven inline en `App.vue`.

**Sugerencia**: Extraer a `components/Toast.vue`.

### A7 — `blankReceipt()` definida dentro del script setup (líneas 12–22)
Función pura creada en cada instancia del componente.

**Sugerencia**: Mover a `utils.js` o ámbito de módulo.

### A8 — Duración hardcodeada del toast (línea 40)
`3500` ms es un número mágico.

**Sugerencia**: `const TOAST_DURATION = 3500` como constante de módulo.

### A9 — Estrategia de ID inconsistente (línea 20)
`Date.now()` puede colisionar con adiciones rápidas. `handleLoad` usa `Date.now() + Math.random()`.

**Sugerencia**: Centralizar generación de IDs en `utils.js`:
```js
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
```

---

## 2. `src/components/ReceiptForm.vue`

### B1 — Métodos de pago hardcodeados (línea 5)
`PAYMENT_METHODS` dentro del componente. No reutilizable.

**Sugerencia**: Mover a `src/constants.js`.

### B2 — Tasa de impuesto por defecto hardcodeada (línea 31)
`16` en `toggleTax()`.

**Sugerencia**: `const DEFAULT_TAX_RATE = 16` como constante exportable.

### B3 — `modelValue` sin validación (línea 7)
`defineProps({ modelValue: Object })` sin `required` ni `default`.

**Sugerencia**: Agregar `required: true` o factory por defecto.

### B4 — Grupos de input casi idénticos repetidos
Campos de cliente (nombre, taxId, address) y meta (número, fecha, método) repiten el mismo patrón label/input.

**Sugerencia**: Crear componente `FormField` o renderizar desde un array de configuración.

### B7 — Step/precision de tasa hardcodeados en template (línea 171)
`step="0.5"`, `min="0"`, `max="100"` son números mágicos.

**Sugerencia**: Constantes `TAX_RATE = { min: 0, max: 100, step: 0.5 }`.

---

## 3. `src/components/ReceiptPreview.vue`

### C1/C2/C3 — Duplicación de utilidades
`formatDate()`, `subtotal`, `total` están definidos también en `ReceiptHistory.vue` con implementaciones diferentes.

**Sugerencia**: Extraer a `utils.js`:
```js
export function formatDate(iso) { ... }
export function calcSubtotal(items) { ... }
export function calcTotal(items, taxRate) { ... }
```

### C4 — Template de comprobante duplicado (~120 líneas)
El markup del card de recibo se repite casi idéntico en `ReceiptPreview.vue:46-160` y `ReceiptHistory.vue:262-384`.

**Sugerencia**: Extraer componente compartido `ReceiptCard.vue`:
```vue
<script setup>
defineProps({ data: Object })
</script>
<template>
  <div class="card overflow-hidden">
    ... markup compartido ...
  </div>
</template>
```

### C5 — `window.print()` asume navegador (línea 39)
**Sugerencia**: Envolver en utility:
```js
export function printPage() {
  if (typeof window !== 'undefined') window.print()
}
```

---

## 4. `src/components/ReceiptHistory.vue`

### D1/D2/D3 — Utilidades duplicadas
`calcSubtotal()`, `calcTotal()`, `formatDate()`, `fmtSavedAt()` deberían vivir en `utils.js`.

### D4 — `:key` inconsistente entre componentes
Preview usa `item.id`, History usa `item.id ?? i`.

**Sugerencia**: Resuelto automáticamente al extraer `ReceiptCard.vue`.

### D6 — Template duplicado (~120 líneas)
Ver C4.

---

## 5. `src/components/IssuerSetup.vue`

### E1 — `form` poblado via watcher (líneas 16–21)
`watch` de `isOpen` para resetear el formulario.

**Sugerencia**: Usar `watch` con `immediate: true` y derivar de `props.initialData`.

### E2 — Escape key en elemento no focuseable (línea 40)
`@keydown="handleKey"` en un `div` sin `tabindex`. El escape solo funciona si un hijo focuseable está activo.

**Sugerencia**: Agregar `tabindex="-1"` y `autofocus` al contenedor del modal.

### E3 — Lógica condicional inline en template (línea 44)
`@click="!isForced && emit('close', null)"`

**Sugerencia**: Extraer a método:
```js
function handleBackdropClick() {
  if (!props.isForced) emit('close', null)
}
```

---

## 6. `src/components/ItemRow.vue`

### F1 — Validación inconsistente
`handleQtyChange` sanitiza dígitos no numéricos, pero `unitPrice` no tiene sanitización similar.

**Sugerencia**: Aplicar la misma validación en `unitPrice`.

---

## 7. `src/composables/useReceipts.js`

### G1 — Error object truncado (líneas 18, 40, 53)
`error.value = e.message` pierde stack trace y causa.

**Sugerencia**: Almacenar error estructurado: `error.value = { message: e.message, stack: e.stack }`.

### G2 — Sin cancelación de fetch al desmontar (línea 58)
`fetchReceipts()` corre en mount sin `AbortController`.

**Sugerencia**:
```js
const controller = new AbortController()
onMounted(() => fetchReceipts(controller.signal))
onUnmounted(() => controller.abort())
```

### G3 — Optimistic update puede causar desorden (línea 37)
Prepend local antes de confirmar consistencia con Redis.

**Sugerencia**: Refetchear lista tras guardar, o al menos reordenar en próximo fetch.

---

## 8. `src/composables/useIssuer.js`

### H1 — Composable limpio
Sin issues significativos. Es el archivo mejor estructurado del proyecto.

---

## 9. `src/lib/redis.js`

### I1 — Sin timeout en requests (líneas 6–18)
`fetch()` sin timeout puede colgarse indefinidamente.

**Sugerencia**:
```js
const controller = new AbortController()
const id = setTimeout(() => controller.abort(), 10000)
try { ... } finally { clearTimeout(id) }
```

### I2 — Sin validación de HTTP status (líneas 15–17)
No se chequea `res.ok` antes de parsear JSON.

**Sugerencia**:
```js
if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`)
```

### I3 — Pipeline asume que todos los comandos funcionan (línea 31)
`results.map(r => r.result)` asume que siempre existe `result`.

**Sugerencia**: Validar cada resultado: `if (r.error) throw new Error(r.error)`.

### I6 — IDs duplicados por `Date.now()`
Potencial race condition si dos `saveReceipt` ocurren en el mismo ms.

**Sugerencia**: Usar crypto UUID + timestamp.

---

## 10. `src/utils.js`

### J1 — `Intl.NumberFormat` creado en cada llamada (líneas 1–8)
Se crea una nueva instancia cada vez que se llama `fmtCLP()`.

**Sugerencia**: Cachear a nivel de módulo:
```js
const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', ... })
export function fmtCLP(num) { return CLP.format(Math.round(num || 0)) }
```

---

## 11. `src/index.css`

### K1 — Animación custom sin Tailwind (líneas 45–51)
`animate-fade-in` con `@keyframes` manual.

**Sugerencia**: Registrar en `tailwind.config.js`:
```js
animation: { 'fade-in': 'fade-in 0.2s ease-out both' }
```

---

## 12. `src/main.js`

### L1 — Sin verificación de mount target (línea 5)
`#root` se asume existente.

**Sugerencia**:
```js
const root = document.getElementById('root')
if (!root) { console.error('Mount target #root not found'); return }
createApp(App).mount(root)
```
