<script setup>
defineOptions({ inheritAttrs: false })

defineProps({
  as: {
    type: String,
    default: 'input',
  },
  label: {
    type: String,
    required: true,
  },
  modelValue: {
    type: [String, Number],
    default: '',
  },
  rows: {
    type: [String, Number],
    default: 2,
  },
})

const emit = defineEmits(['update:modelValue'])

function handleInput(event) {
  emit('update:modelValue', event.target.value)
}
</script>

<template>
  <div>
    <label class="block text-xs text-gray-500 mb-1 font-medium">{{ label }}</label>
    <textarea
      v-if="as === 'textarea'"
      :rows="rows"
      :value="modelValue"
      @input="handleInput"
      class="input-field resize-none"
      v-bind="$attrs"
    />
    <input
      v-else
      :type="as"
      :value="modelValue"
      @input="handleInput"
      class="input-field"
      v-bind="$attrs"
    />
  </div>
</template>
