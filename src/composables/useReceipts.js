import { ref, onMounted, onUnmounted } from 'vue'
import { redis, isConfigured } from '../lib/redis'
import { uid } from '../utils'

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
  const controller = new AbortController()
  let disposed = false

  async function fetchReceipts(signal = controller.signal) {
    if (!isConfigured) return
    loading.value = true
    error.value = null
    try {
      const list = await redis.listReceipts({ signal })
      if (disposed || signal?.aborted) return
      receipts.value = list
    } catch (e) {
      if (!signal?.aborted) error.value = toErrorState(e)
    } finally {
      if (!disposed && !signal?.aborted) loading.value = false
    }
  }

  async function saveReceipt(data) {
    if (!isConfigured) throw new Error('Upstash no configurado')
    saving.value = true
    error.value = null
    try {
      const id = uid()
      const receipt = {
        id,
        savedAt: Date.now(),
        savedAtISO: new Date().toISOString(),
        data,
      }
      await redis.saveReceipt(receipt)
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
      await redis.deleteReceipt(id)
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
    saveReceipt,
    deleteReceipt,
    refetch: fetchReceipts,
  }
}
