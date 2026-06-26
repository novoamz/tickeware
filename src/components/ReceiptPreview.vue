<script setup>
import { computed } from 'vue'
import { Printer, Save } from 'lucide-vue-next'
import ReceiptCard from './ReceiptCard.vue'
import { printPage } from '../utils'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
  saving: Boolean,
  hidePrint: Boolean,
})

const emit = defineEmits(['save'])

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
        <button @click="printPage" class="btn-primary">
          <Printer :size="15" />
          Imprimir / PDF
        </button>
      </div>
    </div>

    <div
      id="receipt-printable"
      :class="['print-only', { 'no-print': hidePrint }]"
    >
      <ReceiptCard :data="data" />
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
