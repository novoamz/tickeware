import { ref, onMounted, onUnmounted } from 'vue'
import { storage, isStorageAvailable, isRedisConfigured } from '../lib/storage'

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
  /** 'redis' | 'local' | null */
  const storageSource = ref(null)
  /** Soft warning when using IDB because Redis failed */
  const redisWarning = ref(null)
  const storageReady = ref(isStorageAvailable)
  const controller = new AbortController()
  let disposed = false

  function applyResultMeta({ source, redisError } = {}) {
    storageSource.value = source || null
    redisWarning.value = redisError || null
    storageReady.value = true
  }

  async function fetchReceipts(signal = controller.signal) {
    if (!isStorageAvailable) {
      storageReady.value = false
      storageSource.value = null
      return
    }
    loading.value = true
    error.value = null
    try {
      const result = await storage.listReceipts({ signal })
      if (disposed || signal?.aborted) return
      applyResultMeta(result)
      receipts.value = result.receipts
    } catch (e) {
      if (!signal?.aborted) {
        storageReady.value = false
        storageSource.value = null
        error.value = toErrorState(e)
      }
    } finally {
      if (!disposed && !signal?.aborted) loading.value = false
    }
  }

  async function saveReceipt(data) {
    if (!isStorageAvailable) {
      throw new Error('No hay almacenamiento disponible')
    }
    saving.value = true
    error.value = null
    try {
      const result = await storage.saveReceipt(data)
      applyResultMeta(result)
      await fetchReceipts()
      return result.receipt
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
      const result = await storage.deleteReceipt(id)
      applyResultMeta(result)
      receipts.value = receipts.value.filter((r) => r.id !== id)
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
    storageReady,
    storageSource,
    redisWarning,
    isRedisConfigured,
    saveReceipt,
    deleteReceipt,
    refetch: fetchReceipts,
  }
}
