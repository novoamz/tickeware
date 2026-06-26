<script setup>
import { computed } from 'vue'
import { Printer, Save, User, CreditCard, Calendar } from 'lucide-vue-next'
import { fmtCLP, effectiveQty } from '../utils'

const props = defineProps({
  data: Object,
  saving: Boolean,
})

const emit = defineEmits(['save'])

function formatDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const subtotal = computed(() =>
  props.data.items.reduce((acc, item) => acc + effectiveQty(item.quantity) * (item.unitPrice || 0), 0)
)
const taxAmount = computed(() => subtotal.value * (props.data.taxRate / 100))
const total = computed(() => subtotal.value + taxAmount.value)
const hasTax = computed(() => props.data.taxRate > 0)
const hasContent = computed(() =>
  props.data.issuer.name || props.data.client.name || props.data.items.some(i => i.description)
)
</script>

<template>
  <div class="sticky top-6">
    <div class="flex items-center justify-between mb-4 no-print">
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-widest">Vista previa</h2>
      <div class="flex items-center gap-2">
        <button @click="emit('save')" :disabled="saving" class="btn-secondary py-2">
          <Save :size="14" :class="saving ? 'animate-pulse' : ''" />
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </button>
        <button @click="window.print()" class="btn-primary">
          <Printer :size="15" />
          Imprimir / PDF
        </button>
      </div>
    </div>

    <div
      id="receipt-printable"
      class="print-only card overflow-hidden"
      style="font-family: 'Inter', system-ui, sans-serif"
    >
      <div class="bg-gray-700 px-8 py-6 text-white">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <h1 class="text-xl font-bold leading-tight">
              {{ data.issuer.name || 'Nombre de la Empresa' }}
            </h1>
            <p v-if="data.issuer.taxId" class="text-gray-300 text-sm mt-0.5">
              RFC/NIT: {{ data.issuer.taxId }}
            </p>
            <p v-if="data.issuer.address" class="text-gray-300 text-xs mt-1 leading-relaxed whitespace-pre-line">
              {{ data.issuer.address }}
            </p>
          </div>
          <div class="text-right shrink-0">
            <div class="inline-block bg-white/20 rounded-lg px-4 py-2">
              <p class="text-xs text-gray-300 uppercase tracking-widest">Comprobante</p>
              <p class="text-2xl font-bold font-mono leading-tight">
                #{{ data.meta.receiptNumber || '001' }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="px-8 py-6 space-y-6">

        <div class="flex flex-wrap gap-4">
          <div class="flex items-center gap-2 text-sm text-gray-600">
            <Calendar :size="14" class="text-gray-400" />
            <span class="font-medium">Fecha:</span>
            <span>{{ formatDate(data.meta.date) }}</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-gray-600">
            <CreditCard :size="14" class="text-gray-400" />
            <span class="font-medium">Método de pago:</span>
            <span>{{ data.meta.paymentMethod || 'Efectivo' }}</span>
          </div>
        </div>

        <div class="h-px bg-gradient-to-r from-gray-200 via-gray-100 to-transparent" />

        <div class="bg-gray-50 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <User :size="13" class="text-gray-400" />
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest">Cliente</p>
          </div>
          <p class="font-semibold text-gray-800">{{ data.client.name || '—' }}</p>
          <p v-if="data.client.taxId" class="text-sm text-gray-500 mt-0.5">RFC/ID: {{ data.client.taxId }}</p>
          <p v-if="data.client.address" class="text-sm text-gray-500 mt-0.5 whitespace-pre-line">{{ data.client.address }}</p>
        </div>

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
                v-for="(item, i) in data.items"
                :key="item.id"
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

        <div class="flex justify-end">
          <div class="w-64 space-y-2">
            <div class="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{{ fmtCLP(subtotal) }}</span>
            </div>
            <div v-if="hasTax" class="flex justify-between text-sm text-gray-600">
              <span>Impuesto ({{ data.taxRate }}%)</span>
              <span>{{ fmtCLP(taxAmount) }}</span>
            </div>
            <div class="h-px bg-gray-200" />
            <div class="flex justify-between items-center">
              <span class="text-base font-bold text-gray-800">Total</span>
              <span class="text-xl font-bold text-gray-800">{{ fmtCLP(total) }}</span>
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-dashed border-gray-200 text-center">
          <p class="text-xs text-gray-400">
            Generado con Tickeware &bull; {{ formatDate(data.meta.date) }}
          </p>
        </div>

      </div>
    </div>

    <div
      v-if="!hasContent"
      class="no-print mt-4 rounded-xl border-2 border-dashed border-gray-200 p-8 text-center"
    >
      <p class="text-gray-400 text-sm">
        Completa el formulario para ver la vista previa en tiempo real
      </p>
    </div>
  </div>
</template>
