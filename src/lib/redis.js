import { REDIS_REQUEST_TIMEOUT_MS } from '../constants'

const BASE  = import.meta.env.VITE_UPSTASH_REDIS_REST_URL
const TOKEN = import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN

export const isConfigured = !!(BASE && TOKEN && !BASE.includes('YOUR-ENDPOINT'))

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

async function request(path, body, options = {}) {
  const requestSignal = createRequestSignal(options.signal)

  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: requestSignal.signal,
    })

    const json = await res.json().catch(() => null)
    if (!res.ok) {
      const detail = json?.error ? `: ${json.error}` : ''
      throw new Error(`Upstash HTTP ${res.status}${detail}`)
    }
    if (json?.error) throw new Error(json.error)
    return json
  } catch (error) {
    if (requestSignal.timedOut()) {
      throw new Error(`Redis request timed out after ${REDIS_REQUEST_TIMEOUT_MS}ms`)
    }
    throw error
  } finally {
    requestSignal.cleanup()
  }
}

async function cmd(args, options = {}) {
  const json = await request('', args, options)
  return json.result
}

async function pipeline(commands, options = {}) {
  const results = await request('/pipeline', commands, options)
  if (!Array.isArray(results)) throw new Error('Pipeline error')
  return results.map((result, index) => {
    if (result?.error) throw new Error(`Pipeline command ${index + 1}: ${result.error}`)
    return result?.result
  })
}

export const redis = {
  zadd:     (key, score, member, options) => cmd(['ZADD', key, score, member], options),
  zrevrange:(key, start, stop, options)   => cmd(['ZREVRANGE', key, start, stop], options),
  zrem:     (key, member, options)        => cmd(['ZREM', key, member], options),
  del:      (key, options)                => cmd(['DEL', key], options),

  set: (key, value, options) => cmd(['SET', key, JSON.stringify(value)], options),

  async mget(keys, options = {}) {
    if (!keys.length) return []
    const raws = await cmd(['MGET', ...keys], options)
    return raws.map(r => (r ? JSON.parse(r) : null))
  },

  // Guarda el comprobante y actualiza el indice en un pipeline atomico
  async saveReceipt(receipt) {
    const key = `tickeware:receipt:${receipt.id}`
    await pipeline([
      ['SET', key, JSON.stringify(receipt)],
      ['ZADD', 'tickeware:index', receipt.savedAt, receipt.id],
    ])
  },

  async deleteReceipt(id) {
    await pipeline([
      ['DEL', `tickeware:receipt:${id}`],
      ['ZREM', 'tickeware:index', id],
    ])
  },

  async listReceipts(options = {}) {
    const ids = await cmd(['ZREVRANGE', 'tickeware:index', 0, 99], options)
    if (!ids || !ids.length) return []
    const raws = await cmd(['MGET', ...ids.map(id => `tickeware:receipt:${id}`)], options)
    return raws.map(r => (r ? JSON.parse(r) : null)).filter(Boolean)
  },
}
