import { ref, onMounted } from 'vue'
import { redis, isConfigured } from '../lib/redis'

export function useReceipts() {
  const receipts = ref([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref(null)

  async function fetchReceipts() {
    if (!isConfigured) return
    loading.value = true
    error.value = null
    try {
      const list = await redis.listReceipts()
      receipts.value = list
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function saveReceipt(data) {
    if (!isConfigured) throw new Error('Upstash no configurado')
    saving.value = true
    error.value = null
    try {
      const id = String(Date.now())
      const receipt = {
        id,
        savedAt: Date.now(),
        savedAtISO: new Date().toISOString(),
        data,
      }
      await redis.saveReceipt(receipt)
      receipts.value = [receipt, ...receipts.value]
      return receipt
    } catch (e) {
      error.value = e.message
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
      error.value = e.message
      throw e
    }
  }

  onMounted(() => fetchReceipts())

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
