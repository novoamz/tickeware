import { Redis } from '@upstash/redis'
import { config, isRedisConfigured } from './config.js'
import type { StoredReceipt } from './types.js'

function indexKey(tenantId: string) {
  return `tickeware:${tenantId}:index`
}

function receiptKey(tenantId: string, id: string) {
  return `tickeware:${tenantId}:receipt:${id}`
}

/** Legacy global keys (pre multi-tenant). */
const LEGACY_INDEX = 'tickeware:index'
const legacyReceiptKey = (id: string) => `tickeware:receipt:${id}`

let client: Redis | null = null

function getClient(): Redis {
  if (!isRedisConfigured || !config.redisUrl || !config.redisToken) {
    throw new Error('Redis is not configured')
  }
  if (!client) {
    client = new Redis({
      url: config.redisUrl,
      token: config.redisToken,
    })
  }
  return client
}

function parseReceipt(raw: StoredReceipt | string | null): StoredReceipt | null {
  if (raw == null) return null
  let value: StoredReceipt
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw) as StoredReceipt
    } catch {
      return null
    }
  } else {
    value = raw
  }
  if (!value || typeof value.id !== 'string') return null
  return value
}

export const receiptStore = {
  isReady(): boolean {
    return isRedisConfigured
  },

  async list(tenantId: string, limit = 100): Promise<StoredReceipt[]> {
    const redis = getClient()
    let ids = (await redis.zrange(indexKey(tenantId), 0, limit - 1, { rev: true })) as string[]

    // Fallback: migrate-read from legacy global index for default tenant only
    if (!ids.length && tenantId === config.defaultTenant) {
      ids = (await redis.zrange(LEGACY_INDEX, 0, limit - 1, { rev: true })) as string[]
      if (ids.length) {
        const keys = ids.map((id) => legacyReceiptKey(String(id)))
        const raws = await redis.mget<(StoredReceipt | string | null)[]>(...keys)
        return raws
          .map(parseReceipt)
          .filter((r): r is StoredReceipt => r != null && !r.deletedAt)
          .map((r) => ({ ...r, tenantId: r.tenantId || tenantId }))
      }
    }

    if (!ids.length) return []

    const keys = ids.map((id) => receiptKey(tenantId, String(id)))
    const raws = await redis.mget<(StoredReceipt | string | null)[]>(...keys)

    return raws
      .map(parseReceipt)
      .filter((r): r is StoredReceipt => r != null && !r.deletedAt)
  },

  async save(tenantId: string, receipt: StoredReceipt): Promise<StoredReceipt> {
    const redis = getClient()
    const key = receiptKey(tenantId, receipt.id)
    const payload = { ...receipt, tenantId, deletedAt: null, deletedAtISO: null }
    const pipe = redis.pipeline().set(key, payload)

    if (config.receiptTtlSeconds > 0) {
      pipe.expire(key, config.receiptTtlSeconds)
    }

    pipe.zadd(indexKey(tenantId), { score: receipt.savedAt, member: receipt.id })
    await pipe.exec()
    return payload
  },

  /** Soft-delete: mark deleted, keep in index until purge. */
  async softRemove(tenantId: string, id: string): Promise<boolean> {
    const redis = getClient()
    const key = receiptKey(tenantId, id)
    let raw = await redis.get<StoredReceipt | string | null>(key)

    // Legacy fallback
    if (raw == null && tenantId === config.defaultTenant) {
      const legacyKey = legacyReceiptKey(id)
      raw = await redis.get<StoredReceipt | string | null>(legacyKey)
      if (raw != null) {
        const parsed = parseReceipt(raw)
        if (!parsed) return false
        const now = Date.now()
        const updated: StoredReceipt = {
          ...parsed,
          tenantId,
          deletedAt: now,
          deletedAtISO: new Date(now).toISOString(),
        }
        await redis
          .pipeline()
          .set(key, updated)
          .del(legacyKey)
          .zrem(LEGACY_INDEX, id)
          .zadd(indexKey(tenantId), { score: parsed.savedAt, member: id })
          .exec()
        return true
      }
      return false
    }

    const parsed = parseReceipt(raw)
    if (!parsed) return false

    const now = Date.now()
    const updated: StoredReceipt = {
      ...parsed,
      tenantId,
      deletedAt: now,
      deletedAtISO: new Date(now).toISOString(),
    }
    await redis.set(key, updated)
    return true
  },

  /** Hard-delete receipts soft-deleted longer than retention. */
  async purgeDeleted(tenantId: string): Promise<number> {
    if (config.softDeleteRetentionDays <= 0) return 0

    const redis = getClient()
    const cutoff = Date.now() - config.softDeleteRetentionDays * 86_400_000
    const ids = (await redis.zrange(indexKey(tenantId), 0, -1)) as string[]
    if (!ids.length) return 0

    let purged = 0
    for (const id of ids) {
      const raw = await redis.get<StoredReceipt | string | null>(receiptKey(tenantId, String(id)))
      const parsed = parseReceipt(raw)
      if (!parsed?.deletedAt || parsed.deletedAt > cutoff) continue
      await redis
        .pipeline()
        .del(receiptKey(tenantId, String(id)))
        .zrem(indexKey(tenantId), id)
        .exec()
      purged += 1
    }
    return purged
  },
}
