/**
 * Unified receipt storage: Upstash Redis preferred, IndexedDB fallback.
 *
 * source: 'redis' | 'local'
 */

import { redis, isConfigured as isRedisConfigured } from './redis'
import { idb, isIdbAvailable } from './idb'

export { isRedisConfigured, isIdbAvailable }

/** True if at least one backend can persist receipts. */
export const isStorageAvailable = isRedisConfigured || isIdbAvailable

function redisErrorMessage(error) {
  return error?.message || 'Error de conexión con Redis'
}

/**
 * Prefer Redis when configured; on any failure use IndexedDB.
 * When Redis succeeds, mirror into IDB as offline cache.
 */
export const storage = {
  isAvailable() {
    return isStorageAvailable
  },

  /**
   * @returns {Promise<{ receipts: Array, source: 'redis'|'local', redisError?: string }>}
   */
  async listReceipts(options = {}) {
    if (isRedisConfigured) {
      try {
        const receipts = await redis.listReceipts(options)
        // Cache for offline use (best-effort)
        idb.cacheMany(receipts).catch(() => {})
        return { receipts, source: 'redis' }
      } catch (error) {
        if (!isIdbAvailable) throw error
        const receipts = await idb.listReceipts(options)
        return {
          receipts,
          source: 'local',
          redisError: redisErrorMessage(error),
        }
      }
    }

    if (!isIdbAvailable) {
      throw new Error('No hay almacenamiento disponible (Redis ni IndexedDB)')
    }
    const receipts = await idb.listReceipts(options)
    return { receipts, source: 'local' }
  },

  /**
   * @returns {Promise<{ receipt: object, source: 'redis'|'local', redisError?: string }>}
   */
  async saveReceipt(data, options = {}) {
    if (isRedisConfigured) {
      try {
        const receipt = await redis.saveReceipt(data, options)
        idb.put({ ...receipt, source: 'redis' }).catch(() => {})
        return { receipt, source: 'redis' }
      } catch (error) {
        if (!isIdbAvailable) throw error
        const receipt = await idb.saveReceipt(data)
        return {
          receipt,
          source: 'local',
          redisError: redisErrorMessage(error),
        }
      }
    }

    if (!isIdbAvailable) {
      throw new Error('No hay almacenamiento disponible (Redis ni IndexedDB)')
    }
    const receipt = await idb.saveReceipt(data)
    return { receipt, source: 'local' }
  },

  /**
   * Soft-delete. Tries Redis first when configured; always updates IDB when present.
   * @returns {Promise<{ ok: boolean, source: 'redis'|'local', redisError?: string }>}
   */
  async deleteReceipt(id, options = {}) {
    if (isRedisConfigured) {
      try {
        const ok = await redis.deleteReceipt(id, options)
        idb.deleteReceipt(id).catch(() => {})
        return { ok, source: 'redis' }
      } catch (error) {
        if (!isIdbAvailable) throw error
        const ok = await idb.deleteReceipt(id)
        return {
          ok,
          source: 'local',
          redisError: redisErrorMessage(error),
        }
      }
    }

    if (!isIdbAvailable) {
      throw new Error('No hay almacenamiento disponible (Redis ni IndexedDB)')
    }
    const ok = await idb.deleteReceipt(id)
    return { ok, source: 'local' }
  },
}
