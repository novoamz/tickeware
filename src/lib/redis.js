import { REDIS_REQUEST_TIMEOUT_MS } from '../constants'

const BASE = (import.meta.env.VITE_UPSTASH_REDIS_REST_URL ?? '').replace(/\/$/, '')
const TOKEN = (import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN ?? '').trim()
const TENANT_ID = (import.meta.env.VITE_TENANT_ID ?? 'default').trim() || 'default'

export const isConfigured = !!(BASE && TOKEN)

const LEGACY_INDEX = 'tickeware:index'
const legacyReceiptKey = (id) => `tickeware:receipt:${id}`

function indexKey(tenantId = TENANT_ID) {
  return `tickeware:${tenantId}:index`
}

function receiptKey(tenantId, id) {
  return `tickeware:${tenantId}:receipt:${id}`
}

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
  }, REDIS_REQUEST_TIMEOUT_MS)

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup() {
      clearTimeout(timeoutId)
      externalSignal?.removeEventListener('abort', abortFromExternal)
    },
  }
}

/** Execute a single Redis command via Upstash REST. */
async function command(args, { signal } = {}) {
  if (!isConfigured) throw new Error('Redis no configurado (VITE_UPSTASH_*)')

  const requestSignal = createRequestSignal(signal)

  try {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
      signal: requestSignal.signal,
    })

    const json = await res.json().catch(() => null)
    if (!res.ok) {
      const detail = json?.error || res.statusText || `HTTP ${res.status}`
      throw new Error(`Upstash HTTP ${res.status}: ${detail}`)
    }
    if (json?.error) throw new Error(json.error)
    return json?.result
  } catch (error) {
    if (requestSignal.timedOut()) {
      throw new Error(`Redis request timed out after ${REDIS_REQUEST_TIMEOUT_MS}ms`)
    }
    throw error
  } finally {
    requestSignal.cleanup()
  }
}

/** Execute multiple commands in one pipeline request. */
async function pipeline(commands, { signal } = {}) {
  if (!isConfigured) throw new Error('Redis no configurado (VITE_UPSTASH_*)')

  const requestSignal = createRequestSignal(signal)

  try {
    const res = await fetch(`${BASE}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
      signal: requestSignal.signal,
    })

    const json = await res.json().catch(() => null)
    if (!res.ok) {
      const detail = Array.isArray(json)
        ? json.find((r) => r?.error)?.error
        : json?.error || res.statusText || `HTTP ${res.status}`
      throw new Error(`Upstash pipeline HTTP ${res.status}: ${detail}`)
    }
    if (!Array.isArray(json)) {
      throw new Error(json?.error || 'Respuesta de pipeline inválida')
    }
    for (const row of json) {
      if (row?.error) throw new Error(row.error)
    }
    return json.map((row) => row.result)
  } catch (error) {
    if (requestSignal.timedOut()) {
      throw new Error(`Redis request timed out after ${REDIS_REQUEST_TIMEOUT_MS}ms`)
    }
    throw error
  } finally {
    requestSignal.cleanup()
  }
}

function parseReceipt(raw) {
  if (raw == null) return null
  let value = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!value || typeof value.id !== 'string') return null
  return value
}

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export const redis = {
  isReady() {
    return isConfigured
  },

  async listReceipts({ signal, limit = 100 } = {}) {
    const tenantId = TENANT_ID
    let ids = (await command(['ZRANGE', indexKey(tenantId), 0, limit - 1, 'REV'], { signal })) || []

    // Fallback: legacy global index for default tenant
    if (!ids.length && tenantId === 'default') {
      ids = (await command(['ZRANGE', LEGACY_INDEX, 0, limit - 1, 'REV'], { signal })) || []
      if (ids.length) {
        const keys = ids.map((id) => legacyReceiptKey(String(id)))
        const raws = (await command(['MGET', ...keys], { signal })) || []
        return raws
          .map(parseReceipt)
          .filter((r) => r != null && !r.deletedAt)
          .map((r) => ({ ...r, tenantId: r.tenantId || tenantId }))
      }
    }

    if (!ids.length) return []

    const keys = ids.map((id) => receiptKey(tenantId, String(id)))
    const raws = (await command(['MGET', ...keys], { signal })) || []

    return raws
      .map(parseReceipt)
      .filter((r) => r != null && !r.deletedAt)
  },

  async saveReceipt(data, { signal } = {}) {
    const tenantId = TENANT_ID
    const now = Date.now()
    const receipt = {
      id: newId(),
      tenantId,
      savedAt: now,
      savedAtISO: new Date(now).toISOString(),
      data,
      deletedAt: null,
      deletedAtISO: null,
    }

    const key = receiptKey(tenantId, receipt.id)
    await pipeline(
      [
        ['SET', key, JSON.stringify(receipt)],
        ['ZADD', indexKey(tenantId), receipt.savedAt, receipt.id],
      ],
      { signal },
    )
    return receipt
  },

  /** Soft-delete: mark deleted, keep key until manual purge. */
  async deleteReceipt(id, { signal } = {}) {
    const tenantId = TENANT_ID
    const key = receiptKey(tenantId, id)
    let raw = await command(['GET', key], { signal })

    if (raw == null && tenantId === 'default') {
      const legacyKey = legacyReceiptKey(id)
      raw = await command(['GET', legacyKey], { signal })
      if (raw != null) {
        const parsed = parseReceipt(raw)
        if (!parsed) return false
        const now = Date.now()
        const updated = {
          ...parsed,
          tenantId,
          deletedAt: now,
          deletedAtISO: new Date(now).toISOString(),
        }
        await pipeline(
          [
            ['SET', key, JSON.stringify(updated)],
            ['DEL', legacyKey],
            ['ZREM', LEGACY_INDEX, id],
            ['ZADD', indexKey(tenantId), parsed.savedAt, id],
          ],
          { signal },
        )
        return true
      }
      return false
    }

    const parsed = parseReceipt(raw)
    if (!parsed) return false

    const now = Date.now()
    const updated = {
      ...parsed,
      tenantId,
      deletedAt: now,
      deletedAtISO: new Date(now).toISOString(),
    }
    await command(['SET', key, JSON.stringify(updated)], { signal })
    return true
  },
}
