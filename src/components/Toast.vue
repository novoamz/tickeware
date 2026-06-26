<script setup>
import { AlertCircle, CheckCircle } from 'lucide-vue-next'

defineProps({
  toast: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <div
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
</template>
