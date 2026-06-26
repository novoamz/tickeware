<script setup>
import { ref, watch } from 'vue'
import { FileText, History, CheckCircle, AlertCircle, Building2, Pencil } from 'lucide-vue-next'
import ReceiptForm from './components/ReceiptForm.vue'
import ReceiptPreview from './components/ReceiptPreview.vue'
import ReceiptHistory from './components/ReceiptHistory.vue'
import IssuerSetup from './components/IssuerSetup.vue'
import { useReceipts } from './composables/useReceipts'
import { useIssuer } from './composables/useIssuer'
import { isConfigured as redisConfigured } from './lib/redis'

const blankReceipt = () => ({
  issuer: { name: '', taxId: '', address: '' },
  client: { name: '', taxId: '', address: '' },
  meta: {
    receiptNumber: '001',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Efectivo',
  },
  items: [{ id: Date.now(), description: '', quantity: '', unitPrice: 0 }],
  taxRate: 0,
})

const { issuer, saveIssuer, isConfigured: issuerConfigured } = useIssuer()
const receiptData = ref({ ...blankReceipt(), issuer: { ...issuer.value } })
const historyOpen = ref(false)
const issuerOpen = ref(!issuerConfigured.value)
const toast = ref(null)

const { receipts, loading, saving, error, saveReceipt, deleteReceipt, refetch } = useReceipts()

watch(issuer, (newIssuer) => {
  receiptData.value = { ...receiptData.value, issuer: { ...newIssuer } }
}, { deep: true })

let toastTimer = null
watch(toast, (newToast) => {
  if (toastTimer) clearTimeout(toastTimer)
  if (newToast) {
    toastTimer = setTimeout(() => { toast.value = null }, 3500)
  }
})

function showToast(type, message) {
  toast.value = { type, message }
}

function handleIssuerClose(data) {
  if (data) saveIssuer(data)
  issuerOpen.value = false
}

async function handleSave() {
  try {
    await saveReceipt(receiptData.value)
    showToast('success', 'Comprobante guardado correctamente')
  } catch (e) {
    showToast('error', e.message || 'Error al guardar')
  }
}

function handleLoad(data) {
  receiptData.value = {
    ...data,
    issuer: { ...issuer.value },
    items: data.items.map(item => ({ ...item, id: Date.now() + Math.random() })),
  }
  showToast('success', 'Comprobante cargado en el formulario')
}

function handleReset() {
  if (window.confirm('¿Deseas limpiar todos los datos del formulario?')) {
    receiptData.value = { ...blankReceipt(), issuer: { ...issuer.value } }
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">

    <header class="no-print sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

        <div class="flex items-center gap-2.5 shrink-0">
          <div class="w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center">
            <FileText :size="14" class="text-white" />
          </div>
          <span class="font-bold text-gray-900 text-base tracking-tight">
            Ticke<span class="text-gray-600">ware</span>
          </span>
        </div>

        <button
          type="button"
          @click="issuerOpen = true"
          class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200
                 hover:border-gray-300 hover:bg-gray-50 transition-all group max-w-xs"
        >
          <Building2 :size="13" class="text-gray-400 shrink-0" />
          <span class="text-xs text-gray-600 font-medium truncate">
            {{ issuerConfigured ? issuer.name : 'Configurar emisor…' }}
          </span>
          <Pencil :size="11" class="text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
        </button>

        <div class="flex items-center gap-2 ml-auto">
          <button
            type="button"
            @click="issuerOpen = true"
            class="sm:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            title="Configurar emisor"
          >
            <Building2 :size="16" />
          </button>

          <button
            type="button"
            @click="historyOpen = true"
            class="btn-secondary text-xs py-1.5 px-3 relative"
          >
            <History :size="13" />
            Historial
            <span
              v-if="redisConfigured && receipts.length > 0"
              class="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-700 text-white
                     text-[10px] font-bold rounded-full flex items-center justify-center"
            >
              {{ receipts.length > 99 ? '99' : receipts.length }}
            </span>
          </button>

          <button
            type="button"
            @click="handleReset"
            class="btn-secondary text-xs py-1.5 px-3"
          >
            Nuevo
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        <div class="no-print">
          <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Formulario
          </h2>
          <ReceiptForm v-model="receiptData" />
        </div>

        <div>
          <ReceiptPreview
            :data="receiptData"
            :saving="saving"
            @save="handleSave"
          />
        </div>

      </div>
    </main>

    <IssuerSetup
      :is-open="issuerOpen"
      :initial-data="issuer"
      :is-forced="!issuerConfigured"
      @close="handleIssuerClose"
    />

    <ReceiptHistory
      :is-open="historyOpen"
      :receipts="receipts"
      :loading="loading"
      :error="error"
      @close="historyOpen = false"
      @load="handleLoad"
      @delete="deleteReceipt"
      @refetch="refetch"
    />

    <div
      v-if="toast"
      :class="[
        'no-print fixed bottom-5 left-1/2 -translate-x-1/2 z-[60]',
        'flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium',
        'animate-fade-in whitespace-nowrap',
        toast.type === 'success' ? 'bg-gray-800 text-white' : 'bg-red-600 text-white'
      ]"
    >
      <CheckCircle v-if="toast.type === 'success'" :size="15" class="text-green-400" />
      <AlertCircle v-else :size="15" class="text-red-200" />
      {{ toast.message }}
    </div>

  </div>
</template>
