import { ref, onMounted, onUnmounted } from 'vue'
import { api, isConfigured } from '../lib/api'

function toErrorState(error) {
  return {
    message: error.message || 'Error inesperado',
    stack: error.stack,
  }
}

export function useReceipts() {
  const receipts = ref([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref(null)
  const apiReady = ref(false)
  const controller = new AbortController()
  let disposed = false

  async function checkHealth(signal = controller.signal) {
    if (!isConfigured) {
      apiReady.value = false
      return false
    }
    try {
      const health = await api.health({ signal })
      if (disposed || signal?.aborted) return false
      apiReady.value = !!health?.redis
      return apiReady.value
    } catch {
      if (!signal?.aborted) apiReady.value = false
      return false
    }
  }

  async function fetchReceipts(signal = controller.signal) {
    if (!isConfigured) return
    loading.value = true
    error.value = null
    try {
      const ready = apiReady.value || (await checkHealth(signal))
      if (!ready || disposed || signal?.aborted) return
      const list = await api.listReceipts({ signal })
      if (disposed || signal?.aborted) return
      receipts.value = list
    } catch (e) {
      if (!signal?.aborted) error.value = toErrorState(e)
    } finally {
      if (!disposed && !signal?.aborted) loading.value = false
    }
  }

  async function saveReceipt(data) {
    if (!isConfigured) throw new Error('API deshabilitada')
    saving.value = true
    error.value = null
    try {
      const ready = apiReady.value || (await checkHealth())
      if (!ready) throw new Error('Backend o Redis no configurado')
      const receipt = await api.saveReceipt(data)
      await fetchReceipts()
      return receipt
    } catch (e) {
      error.value = toErrorState(e)
      throw e
    } finally {
      saving.value = false
    }
  }

  async function deleteReceipt(id) {
    error.value = null
    try {
      await api.deleteReceipt(id)
      receipts.value = receipts.value.filter(r => r.id !== id)
    } catch (e) {
      error.value = toErrorState(e)
      throw e
    }
  }

  onMounted(() => fetchReceipts())
  onUnmounted(() => {
    disposed = true
    controller.abort()
  })

  return {
    receipts,
    loading,
    saving,
    error,
    apiReady,
    saveReceipt,
    deleteReceipt,
    refetch: fetchReceipts,
  }
}
