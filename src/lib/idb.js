/**
 * Local receipt store via IndexedDB.
 * Used when Upstash is unavailable or not configured.
 */

const DB_NAME = 'tickeware'
const DB_VERSION = 1
const STORE = 'receipts'

const TENANT_ID = (import.meta.env.VITE_TENANT_ID ?? 'default').trim() || 'default'

/** @type {Promise<IDBDatabase> | null} */
let dbPromise = null

function openDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB no está disponible en este navegador'))
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onerror = () => reject(req.error || new Error('No se pudo abrir IndexedDB'))
      req.onsuccess = () => resolve(req.result)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' })
          store.createIndex('savedAt', 'savedAt', { unique: false })
          store.createIndex('tenantId', 'tenantId', { unique: false })
        }
      }
    })
  }
  return dbPromise
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'))
  })
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IndexedDB request failed'))
  })
}

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/**
 * IndexedDB uses structured clone, which cannot clone Vue reactive Proxies.
 * JSON round-trip produces a plain, cloneable object.
 */
function toPlain(value) {
  if (value == null) return value
  return JSON.parse(JSON.stringify(value))
}

function isActive(receipt) {
  return receipt != null && typeof receipt.id === 'string' && !receipt.deletedAt
}

export const isIdbAvailable = typeof indexedDB !== 'undefined'

export const idb = {
  isReady() {
    return isIdbAvailable
  },

  async listReceipts({ limit = 100, tenantId = TENANT_ID } = {}) {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const all = await reqToPromise(store.getAll())
    await txDone(tx)

    return (all || [])
      .filter((r) => isActive(r) && (r.tenantId || 'default') === tenantId)
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
      .slice(0, limit)
  },

  async saveReceipt(data, { tenantId = TENANT_ID } = {}) {
    const now = Date.now()
    const receipt = toPlain({
      id: newId(),
      tenantId,
      savedAt: now,
      savedAtISO: new Date(now).toISOString(),
      data,
      deletedAt: null,
      deletedAtISO: null,
      source: 'local',
    })
    await this.put(receipt)
    return receipt
  },

  /** Upsert a full receipt record (cache or local create). */
  async put(receipt) {
    if (!receipt?.id) throw new Error('Receipt id required')
    const plain = toPlain(receipt)
    const db = await openDb()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(plain)
    await txDone(tx)
    return plain
  },

  /** Best-effort cache of remote receipts. */
  async cacheMany(receipts = []) {
    if (!receipts.length) return
    const db = await openDb()
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    for (const receipt of receipts) {
      if (!receipt?.id) continue
      store.put(toPlain({ ...receipt, source: receipt.source || 'redis' }))
    }
    await txDone(tx)
  },

  async deleteReceipt(id) {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const existing = await reqToPromise(store.get(id))
    if (!existing) {
      await txDone(tx)
      return false
    }
    const now = Date.now()
    store.put(
      toPlain({
        ...existing,
        deletedAt: now,
        deletedAtISO: new Date(now).toISOString(),
      }),
    )
    await txDone(tx)
    return true
  },

  async get(id) {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readonly')
    const result = await reqToPromise(tx.objectStore(STORE).get(id))
    await txDone(tx)
    return result ?? null
  },
}
