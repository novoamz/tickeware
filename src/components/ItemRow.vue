<script setup>
import { computed } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import { fmtCLP, effectiveQty } from '../utils'

const props = defineProps({
  item: Object,
  index: Number,
  isOnly: Boolean,
})

const emit = defineEmits(['change', 'remove'])

const lineTotal = computed(() => effectiveQty(props.item.quantity) * (props.item.unitPrice || 0))

function handleQtyChange(e) {
  const digits = e.target.value.replace(/[^0-9]/g, '')
  emit('change', props.item.id, 'quantity', digits === '' ? '' : parseInt(digits, 10))
}

function handleUnitPriceChange(e) {
  const digits = e.target.value.replace(/[^0-9]/g, '')
  emit('change', props.item.id, 'unitPrice', digits === '' ? 0 : parseInt(digits, 10))
}
</script>

<template>
  <tr class="group border-b border-gray-100 last:border-0">
    <td class="py-2 pr-2">
      <input
        type="text"
        :value="item.description"
        @input="emit('change', item.id, 'description', $event.target.value)"
        placeholder="Descripción del servicio o producto"
        class="input-field"
      />
    </td>
    <td class="py-2 px-2 w-24">
      <input
        type="text"
        inputmode="numeric"
        :value="item.quantity"
        @input="handleQtyChange"
        placeholder="—"
        class="input-field text-center"
      />
    </td>
    <td class="py-2 px-2 w-36">
      <input
        type="text"
        inputmode="numeric"
        :value="item.unitPrice"
        @input="handleUnitPriceChange"
        placeholder="0"
        class="input-field text-right"
      />
    </td>
    <td class="py-2 pl-2 w-32 text-right">
      <span class="text-sm font-medium text-gray-700">{{ fmtCLP(lineTotal) }}</span>
    </td>
    <td class="py-2 pl-2 w-10 text-center">
      <button
        type="button"
        @click="emit('remove', item.id)"
        :disabled="isOnly"
        title="Eliminar fila"
        :class="['btn-danger', isOnly ? 'opacity-20 cursor-not-allowed' : '']"
      >
        <Trash2 :size="15" />
      </button>
    </td>
  </tr>
</template>
