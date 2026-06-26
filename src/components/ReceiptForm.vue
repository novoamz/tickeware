<script setup>
import { PlusCircle, User, FileText, Tag, ToggleLeft, ToggleRight } from 'lucide-vue-next'
import { DEFAULT_TAX_RATE, PAYMENT_METHODS, TAX_RATE } from '../constants'
import { uid } from '../utils'
import FormField from './FormField.vue'
import ItemRow from './ItemRow.vue'

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
})
const emit = defineEmits(['update:modelValue'])

function update(patch) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

function setNested(section, field, value) {
  update({ [section]: { ...props.modelValue[section], [field]: value } })
}

function addItem() {
  update({ items: [...props.modelValue.items, { id: uid(), description: '', quantity: '', unitPrice: 0 }] })
}

function updateItem(id, field, value) {
  update({ items: props.modelValue.items.map(item => item.id === id ? { ...item, [field]: value } : item) })
}

function removeItem(id) {
  update({ items: props.modelValue.items.filter(item => item.id !== id) })
}

function toggleTax() {
  update({ taxRate: props.modelValue.taxRate > 0 ? 0 : DEFAULT_TAX_RATE })
}
</script>

<template>
  <div class="space-y-4">

    <div class="card p-5">
      <div class="flex items-center gap-2 mb-4">
        <User :size="15" class="text-gray-500" />
        <p class="section-title mb-0">Datos del Cliente</p>
      </div>
      <div class="grid grid-cols-1 gap-3">
        <FormField
          label="Nombre / Empresa"
          :model-value="modelValue.client.name"
          placeholder="Cliente Ejemplo"
          @update:model-value="setNested('client', 'name', $event)"
        />
        <FormField
          label="RFC / NIT / Documento"
          :model-value="modelValue.client.taxId"
          placeholder="ID del cliente"
          @update:model-value="setNested('client', 'taxId', $event)"
        />
        <FormField
          as="textarea"
          label="Dirección"
          :model-value="modelValue.client.address"
          placeholder="Dirección del cliente"
          @update:model-value="setNested('client', 'address', $event)"
        />
      </div>
    </div>

    <div class="card p-5">
      <div class="flex items-center gap-2 mb-4">
        <FileText :size="15" class="text-gray-500" />
        <p class="section-title mb-0">Detalles del Comprobante</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <FormField
          label="N° de Recibo"
          :model-value="modelValue.meta.receiptNumber"
          placeholder="001"
          @update:model-value="setNested('meta', 'receiptNumber', $event)"
        />
        <FormField
          as="date"
          label="Fecha"
          :model-value="modelValue.meta.date"
          @update:model-value="setNested('meta', 'date', $event)"
        />
        <div class="col-span-2">
          <label class="block text-xs text-gray-500 mb-1 font-medium">Método de Pago</label>
          <select
            :value="modelValue.meta.paymentMethod"
            @change="setNested('meta', 'paymentMethod', $event.target.value)"
            class="input-field"
          >
            <option v-for="m in PAYMENT_METHODS" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </div>
    </div>

    <div class="card p-5">
      <div class="flex items-center gap-2 mb-4">
        <Tag :size="15" class="text-gray-500" />
        <p class="section-title mb-0">Ítems / Servicios</p>
      </div>

      <div class="overflow-x-auto -mx-1">
        <table class="w-full min-w-[480px]">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left text-xs text-gray-400 font-medium pb-2 pr-2">Descripción</th>
              <th class="text-center text-xs text-gray-400 font-medium pb-2 px-2 w-24">Cant.</th>
              <th class="text-right text-xs text-gray-400 font-medium pb-2 px-2 w-32">P. Unit.</th>
              <th class="text-right text-xs text-gray-400 font-medium pb-2 pl-2 w-28">Total</th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody>
            <ItemRow
              v-for="(item, index) in modelValue.items"
              :key="item.id"
              :item="item"
              :index="index"
              :is-only="modelValue.items.length === 1"
              @change="updateItem"
              @remove="removeItem"
            />
          </tbody>
        </table>
      </div>

      <button type="button" @click="addItem" class="btn-secondary mt-4 w-full justify-center">
        <PlusCircle :size="15" />
        Agregar ítem
      </button>
    </div>

    <div class="card p-5">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-700">Aplicar impuesto</p>
          <p class="text-xs text-gray-400 mt-0.5">Activa para incluir un % al subtotal</p>
        </div>
        <button type="button" @click="toggleTax" class="text-gray-600 hover:text-gray-800 transition-colors">
          <ToggleRight v-if="modelValue.taxRate > 0" :size="32" class="text-gray-700" />
          <ToggleLeft v-else :size="32" class="text-gray-300" />
        </button>
      </div>

      <div v-if="modelValue.taxRate > 0" class="mt-3 pt-3 border-t border-gray-100">
        <label class="block text-xs text-gray-500 mb-1 font-medium">Tasa de impuesto (%)</label>
        <div class="relative w-36">
          <input
            type="number"
            :min="TAX_RATE.min"
            :max="TAX_RATE.max"
            :step="TAX_RATE.step"
            :value="modelValue.taxRate"
            @input="update({ taxRate: parseFloat($event.target.value) || 0 })"
            class="input-field pr-8"
          />
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
        </div>
      </div>
    </div>

  </div>
</template>
