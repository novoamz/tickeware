import { API_REQUEST_TIMEOUT_MS } from '../constants'

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const API_KEY = (import.meta.env.VITE_API_KEY ?? '').trim()
const TENANT_ID = (import.meta.env.VITE_TENANT_ID ?? '').trim()

/** True when the frontend is allowed to call the API (opt-out with VITE_API_ENABLED=false). */
export const isConfigured = import.meta.env.VITE_API_ENABLED !== 'false'

function createRequestSignal(externalSignal) {
  const controller = new AbortController()
  let timedOut = false

  function abortFromExternal() {
    controller.abort(externalSignal.reason)
  }

  if (externalSignal?.aborted) {
    controller.abort(externalSignal.reason)
  } else {
    externalSignal?.addEventListener('abort', abortFromExternal, { once: true })
  }

  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, API_REQUEST_TIMEOUT_MS)

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup() {
      clearTimeout(timeoutId)
      externalSignal?.removeEventListener('abort', abortFromExternal)
    },
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const requestSignal = createRequestSignal(signal)

  try {
    const headers = {}
    if (body) headers['Content-Type'] = 'application/json'
    if (API_KEY) headers['X-API-Key'] = API_KEY
    if (TENANT_ID) headers['X-Tenant-Id'] = TENANT_ID

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: requestSignal.signal,
    })

    if (res.status === 204) return null

    const json = await res.json().catch(() => null)
    if (!res.ok) {
      const detail = json?.error || res.statusText || `HTTP ${res.status}`
      throw new Error(detail)
    }
    return json
  } catch (error) {
    if (requestSignal.timedOut()) {
      throw new Error(`API request timed out after ${API_REQUEST_TIMEOUT_MS}ms`)
    }
    throw error
  } finally {
    requestSignal.cleanup()
  }
}

export const api = {
  health(options = {}) {
    return request('/api/health', options)
  },

  async listReceipts(options = {}) {
    const json = await request('/api/receipts', options)
    return json?.receipts ?? []
  },

  async saveReceipt(data, options = {}) {
    const json = await request('/api/receipts', {
      method: 'POST',
      body: { data },
      ...options,
    })
    return json?.receipt
  },

  async deleteReceipt(id, options = {}) {
    await request(`/api/receipts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      ...options,
    })
  },
}
