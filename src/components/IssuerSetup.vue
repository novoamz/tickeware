<script setup>
import { ref, watch } from 'vue'
import { Building2, X, CheckCircle, ChevronRight } from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean,
  initialData: Object,
  isForced: Boolean,
})

const emit = defineEmits(['close'])

const form = ref({ name: '', taxId: '', address: '' })
const error = ref('')

watch(() => props.isOpen, (open) => {
  if (open) {
    form.value = { name: props.initialData.name, taxId: props.initialData.taxId, address: props.initialData.address }
    error.value = ''
  }
})

function handleSave() {
  if (!form.value.name.trim()) {
    error.value = 'El nombre o empresa es obligatorio.'
    return
  }
  emit('close', form.value)
}

function handleKey(e) {
  if (e.key === 'Escape' && !props.isForced) emit('close', null)
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    @keydown="handleKey"
  >
    <div
      class="absolute inset-0 bg-black/40 backdrop-blur-sm"
      @click="!isForced && emit('close', null)"
    />

    <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">

      <div class="bg-gray-700 px-6 py-5 text-white">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Building2 :size="18" />
            </div>
            <div>
              <h2 class="font-bold text-base leading-tight">
                {{ isForced ? 'Configura tu empresa' : 'Datos del emisor' }}
              </h2>
              <p class="text-gray-300 text-xs mt-0.5">
                {{ isForced ? 'Aparecerá en todos tus comprobantes' : 'Se aplica a todos los comprobantes nuevos' }}
              </p>
            </div>
          </div>
          <button
            v-if="!isForced"
            @click="emit('close', null)"
            class="p-1.5 text-gray-300 hover:text-white hover:bg-white/20 rounded-lg transition-all"
          >
            <X :size="16" />
          </button>
        </div>
      </div>

      <div class="px-6 py-5 space-y-4">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">
            Nombre / Empresa <span class="text-red-400">*</span>
          </label>
          <input
            autofocus
            type="text"
            v-model="form.name"
            @input="error = ''"
            placeholder="Mi Empresa S.A."
            :class="['input-field', error ? 'ring-2 ring-red-400 border-transparent' : '']"
          />
          <p v-if="error" class="text-xs text-red-500 mt-1">{{ error }}</p>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">
            RUT / NIT / ID Fiscal
          </label>
          <input
            type="text"
            v-model="form.taxId"
            placeholder="12.345.678-9"
            class="input-field"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Dirección</label>
          <textarea
            rows="2"
            v-model="form.address"
            placeholder="Av. Principal 123, Santiago, Chile"
            class="input-field resize-none"
          />
        </div>
      </div>

      <div class="px-6 pb-5 flex items-center justify-between gap-3">
        <button
          v-if="!isForced"
          type="button"
          @click="emit('close', null)"
          class="btn-secondary"
        >
          Cancelar
        </button>
        <button
          type="button"
          @click="handleSave"
          :class="['btn-primary', isForced ? 'w-full justify-center' : '']"
        >
          <template v-if="isForced">
            Guardar y comenzar
            <ChevronRight :size="15" />
          </template>
          <template v-else>
            <CheckCircle :size="14" />
            Guardar cambios
          </template>
        </button>
      </div>
    </div>
  </div>
</template>
