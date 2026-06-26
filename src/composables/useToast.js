import { onUnmounted, ref, watch } from 'vue'
import { TOAST_DURATION } from '../constants'

export function useToast(duration = TOAST_DURATION) {
  const toast = ref(null)
  let toastTimer = null

  function clearToastTimer() {
    if (toastTimer) {
      clearTimeout(toastTimer)
      toastTimer = null
    }
  }

  watch(toast, (newToast) => {
    clearToastTimer()
    if (newToast) {
      toastTimer = setTimeout(() => {
        toast.value = null
        toastTimer = null
      }, duration)
    }
  })

  onUnmounted(clearToastTimer)

  function showToast(type, message) {
    toast.value = { type, message }
  }

  return {
    toast,
    showToast,
  }
}
