<script setup>
import { ref, watch } from 'vue'
import { FileText, History, Building2, Pencil } from 'lucide-vue-next'
import ReceiptForm from './components/ReceiptForm.vue'
import ReceiptPreview from './components/ReceiptPreview.vue'
import ReceiptHistory from './components/ReceiptHistory.vue'
import IssuerSetup from './components/IssuerSetup.vue'
import Toast from './components/Toast.vue'
import { useReceipts } from './composables/useReceipts'
import { useIssuer } from './composables/useIssuer'
import { useToast } from './composables/useToast'
import { isConfigured as redisConfigured } from './lib/redis'
import { blankReceipt, uid } from './utils'

const { issuer, saveIssuer, isConfigured: issuerConfigured } = useIssuer()
const receiptData = ref({ ...blankReceipt(), issuer: { ...issuer.value } })
const historyOpen = ref(false)
const issuerOpen = ref(!issuerConfigured.value)
const { toast, showToast } = useToast()

const { receipts, loading, saving, error, saveReceipt, deleteReceipt, refetch } = useReceipts()

watch(issuer, (newIssuer) => {
  receiptData.value = { ...receiptData.value, issuer: { ...newIssuer } }
})

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
  const { issuer: _issuer, ...rest } = data
  receiptData.value = {
    ...rest,
    issuer: { ...issuer.value },
    items: data.items.map(item => ({ ...item, id: uid() })),
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

        <div class="flex items-center gap-2 ml-auto">
          <button
            type="button"
            @click="issuerOpen = true"
            class="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-transparent sm:border-gray-200
                   text-gray-400 hover:text-gray-600 hover:bg-gray-100 sm:hover:border-gray-300 transition-all group max-w-xs"
            title="Configurar emisor"
          >
            <Building2 :size="16" class="sm:w-[13px] sm:h-[13px] shrink-0" />
            <span class="hidden sm:inline text-xs text-gray-600 font-medium truncate">
              {{ issuerConfigured ? issuer.name : 'Configurar emisor…' }}
            </span>
            <Pencil :size="11" class="hidden sm:block text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
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
            :hide-print="historyOpen"
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

    <Toast v-if="toast" :toast="toast" />

  </div>
</template>
