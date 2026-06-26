import { ref, computed } from 'vue'

const STORAGE_KEY = 'tickeware:issuer'
const empty = { name: '', taxId: '', address: '' }

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { ...empty }
  } catch {
    return { ...empty }
  }
}

export function useIssuer() {
  const issuer = ref(load())
  const isConfigured = computed(() => !!issuer.value.name.trim())

  function saveIssuer(data) {
    const trimmed = {
      name: data.name.trim(),
      taxId: data.taxId.trim(),
      address: data.address.trim(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    issuer.value = trimmed
    return trimmed
  }

  return { issuer, saveIssuer, isConfigured }
}
