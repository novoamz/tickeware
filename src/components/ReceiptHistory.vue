<script setup>
import { ref, watch } from 'vue'
import {
  X, FolderOpen, Trash2, RefreshCw, AlertCircle, Clock,
  Receipt, Printer, ChevronLeft, User, CreditCard, Calendar, FileText
} from 'lucide-vue-next'
import { fmtCLP, effectiveQty } from '../utils'
import { isConfigured } from '../lib/redis'

const props = defineProps({
  isOpen: Boolean,
  receipts: Array,
  loading: Boolean,
  error: { default: null },
})

const emit = defineEmits(['close', 'load', 'delete', 'refetch'])

const selected = ref(null)

watch(() => props.isOpen, (open) => {
  if (!open) selected.value = null
})

function calcSubtotal(data) {
  return data.items.reduce(
    (acc, item) => acc + effectiveQty(item.quantity) * (item.unitPrice || 0), 0
  )
}

function calcTotal(data) {
  const sub = calcSubtotal(data)
  return sub + sub * (data.taxRate / 100)
}

function fmtSavedAt(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(iso) {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${d}/${m}/${iso.split('-')[0]}`
}

function handleLoad() {
  emit('load', selected.value.data)
  emit('close')
}

function handleDelete(id) {
  emit('delete', id)
  if (selected.value?.id === id) selected.value = null
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex flex-col bg-gray-50 transform transition-transform duration-300 ease-out"
    :class="isOpen ? 'translate-x-0' : 'translate-x-full'"
  >

    <!-- ── Top bar ── -->
    <div class="bg-white border-b border-gray-200 px-5 py-3.5 flex items-center gap-3 shrink-0 shadow-sm">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
          <Receipt :size="14" class="text-gray-500" />
        </div>
        <h2 class="font-semibold text-gray-800">Historial de comprobantes</h2>
        <span
          v-if="receipts.length > 0"
          class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full
                 bg-gray-100 text-gray-600 text-xs font-semibold"
        >
          {{ receipts.length }}
        </span>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <button
          @click="emit('refetch')"
          :disabled="loading"
          title="Actualizar"
          class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
        >
          <RefreshCw :size="15" :class="loading ? 'animate-spin' : ''" />
        </button>
        <button
          @click="emit('close')"
          class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
        >
          <X :size="18" />
        </button>
      </div>
    </div>

    <!-- ── Body ── -->
    <div class="flex flex-1 overflow-hidden">

      <!-- ── Lista (izquierda) ── -->
      <div
        class="flex flex-col bg-white border-r border-gray-100 shrink-0
               w-full sm:w-80 xl:w-96"
        :class="selected ? 'hidden sm:flex' : 'flex'"
      >
        <!-- Alertas -->
        <div v-if="!isConfigured" class="m-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <div class="flex gap-2.5">
            <AlertCircle :size="15" class="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p class="text-xs font-medium text-amber-800">Upstash no configurado</p>
              <p class="text-xs text-amber-600 mt-0.5 leading-relaxed">
                Agrega <code class="bg-amber-100 px-1 rounded">VITE_UPSTASH_REDIS_REST_URL</code> y
                <code class="bg-amber-100 px-1 rounded">VITE_UPSTASH_REDIS_REST_TOKEN</code> en tu <code class="bg-amber-100 px-1 rounded">.env</code>.
              </p>
            </div>
          </div>
        </div>

        <div v-if="error" class="mx-3 mt-3 p-3 rounded-xl bg-red-50 border border-red-200 flex gap-2">
          <AlertCircle :size="14" class="text-red-400 shrink-0 mt-0.5" />
          <p class="text-xs text-red-600">{{ error }}</p>
        </div>

        <!-- Cargando -->
        <div v-if="loading" class="flex-1 flex flex-col items-center justify-center gap-3 py-16">
          <RefreshCw :size="22" class="text-gray-300 animate-spin" />
          <p class="text-sm text-gray-400">Cargando historial…</p>
        </div>

        <!-- Sin comprobantes -->
        <div
          v-else-if="isConfigured && !error && receipts.length === 0"
          class="flex-1 flex flex-col items-center justify-center gap-3 py-16 px-8 text-center"
        >
          <div class="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
            <Receipt :size="26" class="text-gray-300" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500">Sin comprobantes guardados</p>
            <p class="text-xs text-gray-400 mt-1">
              Usa el botón "Guardar" en la vista previa para almacenar comprobantes aquí.
            </p>
          </div>
        </div>

        <!-- Lista -->
        <ul v-else-if="!loading" class="flex-1 overflow-y-auto divide-y divide-gray-50">
          <li
            v-for="r in receipts"
            :key="r.id"
            @click="selected = r"
            :class="[
              'px-4 py-3.5 cursor-pointer transition-all',
              selected?.id === r.id
                ? 'bg-gray-50 border-l-2 border-gray-700'
                : 'hover:bg-gray-50 border-l-2 border-transparent'
            ]"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-0.5">
                  <span class="text-[11px] font-mono font-semibold text-gray-400 shrink-0">
                    #{{ r.data.meta.receiptNumber || '—' }}
                  </span>
                  <span class="text-sm font-medium text-gray-800 truncate">
                    {{ r.data.client.name || 'Sin cliente' }}
                  </span>
                </div>
                <div class="flex items-center gap-2.5">
                  <span class="text-sm font-bold text-gray-700">
                    {{ fmtCLP(calcTotal(r.data)) }}
                  </span>
                  <span class="flex items-center gap-1 text-[11px] text-gray-400">
                    <Clock :size="10" />
                    {{ fmtSavedAt(r.savedAtISO) }}
                  </span>
                </div>
                <p v-if="r.data.issuer.name" class="text-[11px] text-gray-400 mt-0.5 truncate">
                  {{ r.data.issuer.name }}
                </p>
              </div>
              <div class="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 shrink-0"
                   :class="selected?.id === r.id ? 'bg-gray-700' : ''" />
            </div>
          </li>
        </ul>

        <!-- Footer -->
        <div class="px-4 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
          <p class="text-[11px] text-gray-400 text-center">
            Upstash Redis &bull; Últimos 100 comprobantes
          </p>
        </div>
      </div>

      <!-- ── Panel derecho: comprobante ── -->
      <div
        class="flex-1 overflow-y-auto flex flex-col"
        :class="!selected && 'hidden sm:flex'"
      >
        <!-- Sin selección -->
        <div v-if="!selected" class="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
          <div class="w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
            <FileText :size="28" class="text-gray-300" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500">Selecciona un comprobante</p>
            <p class="text-xs text-gray-400 mt-1">Haz clic en cualquier comprobante de la lista para verlo aquí</p>
          </div>
        </div>

        <!-- Detalle del comprobante seleccionado -->
        <template v-else>

          <!-- Barra de acciones -->
          <div class="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 shrink-0">
            <!-- Volver (solo mobile) -->
            <button
              @click="selected = null"
              class="sm:hidden p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
            >
              <ChevronLeft :size="18" />
            </button>

            <div class="min-w-0">
              <p class="font-semibold text-gray-800 text-sm">
                Comprobante #{{ selected.data.meta.receiptNumber || '001' }}
              </p>
              <p class="text-xs text-gray-400">{{ fmtSavedAt(selected.savedAtISO) }}</p>
            </div>

            <div class="ml-auto flex items-center gap-2">
              <button
                @click="handleDelete(selected.id)"
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500
                       hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-all"
              >
                <Trash2 :size="13" />
                Eliminar
              </button>
              <button
                @click="() => { window.print() }"
                class="btn-secondary text-xs py-1.5 px-3"
              >
                <Printer :size="13" />
                Imprimir
              </button>
              <button @click="handleLoad" class="btn-primary text-xs py-1.5 px-3">
                <FolderOpen :size="13" />
                Cargar en formulario
              </button>
            </div>
          </div>

          <!-- Comprobante formateado -->
          <div class="flex-1 p-6 sm:p-8">
            <div class="max-w-2xl mx-auto">
              <div class="card overflow-hidden" style="font-family: 'Inter', system-ui, sans-serif">

                <!-- Cabecera -->
                <div class="bg-gray-700 px-8 py-6 text-white">
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex-1">
                      <h1 class="text-xl font-bold leading-tight">
                        {{ selected.data.issuer.name || 'Nombre de la Empresa' }}
                      </h1>
                      <p v-if="selected.data.issuer.taxId" class="text-gray-300 text-sm mt-0.5">
                        RFC/NIT: {{ selected.data.issuer.taxId }}
                      </p>
                      <p v-if="selected.data.issuer.address" class="text-gray-300 text-xs mt-1 leading-relaxed whitespace-pre-line">
                        {{ selected.data.issuer.address }}
                      </p>
                    </div>
                    <div class="text-right shrink-0">
                      <div class="inline-block bg-white/20 rounded-lg px-4 py-2">
                        <p class="text-xs text-gray-300 uppercase tracking-widest">Comprobante</p>
                        <p class="text-2xl font-bold font-mono leading-tight">
                          #{{ selected.data.meta.receiptNumber || '001' }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Cuerpo -->
                <div class="px-8 py-6 space-y-6">

                  <!-- Meta -->
                  <div class="flex flex-wrap gap-4">
                    <div class="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar :size="14" class="text-gray-400" />
                      <span class="font-medium">Fecha:</span>
                      <span>{{ formatDate(selected.data.meta.date) }}</span>
                    </div>
                    <div class="flex items-center gap-2 text-sm text-gray-600">
                      <CreditCard :size="14" class="text-gray-400" />
                      <span class="font-medium">Método de pago:</span>
                      <span>{{ selected.data.meta.paymentMethod || 'Efectivo' }}</span>
                    </div>
                  </div>

                  <div class="h-px bg-gradient-to-r from-gray-200 via-gray-100 to-transparent" />

                  <!-- Cliente -->
                  <div class="bg-gray-50 rounded-xl p-4">
                    <div class="flex items-center gap-2 mb-2">
                      <User :size="13" class="text-gray-400" />
                      <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest">Cliente</p>
                    </div>
                    <p class="font-semibold text-gray-800">{{ selected.data.client.name || '—' }}</p>
                    <p v-if="selected.data.client.taxId" class="text-sm text-gray-500 mt-0.5">
                      RFC/ID: {{ selected.data.client.taxId }}
                    </p>
                    <p v-if="selected.data.client.address" class="text-sm text-gray-500 mt-0.5 whitespace-pre-line">
                      {{ selected.data.client.address }}
                    </p>
                  </div>

                  <!-- Tabla ítems -->
                  <div>
                    <table class="w-full text-sm">
                      <thead>
                        <tr class="border-b-2 border-gray-200">
                          <th class="text-left text-xs text-gray-400 font-semibold uppercase tracking-wide pb-2">Descripción</th>
                          <th class="text-center text-xs text-gray-400 font-semibold uppercase tracking-wide pb-2 w-16">Cant.</th>
                          <th class="text-right text-xs text-gray-400 font-semibold uppercase tracking-wide pb-2 w-28">P. Unit.</th>
                          <th class="text-right text-xs text-gray-400 font-semibold uppercase tracking-wide pb-2 w-28">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="(item, i) in selected.data.items"
                          :key="item.id ?? i"
                          class="border-b border-gray-100"
                          :class="i % 2 === 0 ? '' : 'bg-gray-50/50'"
                        >
                          <td class="py-2.5 pr-3 text-gray-700">
                            <span v-if="item.description">{{ item.description }}</span>
                            <span v-else class="text-gray-300 italic">Sin descripción</span>
                          </td>
                          <td class="py-2.5 text-center text-gray-500">
                            {{ (item.quantity === '' || item.quantity == null) ? '—' : item.quantity }}
                          </td>
                          <td class="py-2.5 text-right text-gray-600">{{ fmtCLP(item.unitPrice) }}</td>
                          <td class="py-2.5 text-right font-medium text-gray-800">
                            {{ fmtCLP(effectiveQty(item.quantity) * (item.unitPrice || 0)) }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <!-- Totales -->
                  <div class="flex justify-end">
                    <div class="w-64 space-y-2">
                      <div class="flex justify-between text-sm text-gray-600">
                        <span>Subtotal</span>
                        <span>{{ fmtCLP(calcSubtotal(selected.data)) }}</span>
                      </div>
                      <div v-if="selected.data.taxRate > 0" class="flex justify-between text-sm text-gray-600">
                        <span>Impuesto ({{ selected.data.taxRate }}%)</span>
                        <span>{{ fmtCLP(calcSubtotal(selected.data) * selected.data.taxRate / 100) }}</span>
                      </div>
                      <div class="h-px bg-gray-200" />
                      <div class="flex justify-between items-center">
                        <span class="text-base font-bold text-gray-800">Total</span>
                        <span class="text-xl font-bold text-gray-800">{{ fmtCLP(calcTotal(selected.data)) }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Pie -->
                  <div class="pt-4 border-t border-dashed border-gray-200 text-center">
                    <p class="text-xs text-gray-400">
                      Generado con Tickeware &bull; {{ formatDate(selected.data.meta.date) }}
                    </p>
                  </div>

                </div>
              </div>
            </div>
          </div>

        </template>
      </div>

    </div>
  </div>
</template>
