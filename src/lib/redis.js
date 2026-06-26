const BASE  = import.meta.env.VITE_UPSTASH_REDIS_REST_URL
const TOKEN = import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN

export const isConfigured = !!(BASE && TOKEN && !BASE.includes('YOUR-ENDPOINT'))

async function cmd(...args) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.result
}

async function pipeline(commands) {
  const res = await fetch(`${BASE}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  })
  const results = await res.json()
  if (!Array.isArray(results)) throw new Error('Pipeline error')
  return results.map(r => r.result)
}

export const redis = {
  zadd:     (key, score, member)    => cmd('ZADD', key, score, member),
  zrevrange:(key, start, stop)      => cmd('ZREVRANGE', key, start, stop),
  zrem:     (key, member)           => cmd('ZREM', key, member),
  del:      (key)                   => cmd('DEL', key),

  set: (key, value) => cmd('SET', key, JSON.stringify(value)),

  async mget(keys) {
    if (!keys.length) return []
    const raws = await cmd('MGET', ...keys)
    return raws.map(r => (r ? JSON.parse(r) : null))
  },

  // Guarda el comprobante y actualiza el índice en un pipeline atómico
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

  async listReceipts() {
    const ids = await cmd('ZREVRANGE', 'tickeware:index', 0, 99)
    if (!ids || !ids.length) return []
    const raws = await cmd('MGET', ...ids.map(id => `tickeware:receipt:${id}`))
    return raws.map(r => (r ? JSON.parse(r) : null)).filter(Boolean)
  },
}
