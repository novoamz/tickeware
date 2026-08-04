import type { AuditAction, AuditEntry } from './types.js'
import { config, isRedisConfigured } from './config.js'
import { Redis } from '@upstash/redis'

let client: Redis | null = null

function getClient(): Redis | null {
  if (!isRedisConfigured || !config.redisUrl || !config.redisToken) return null
  if (!client) {
    client = new Redis({ url: config.redisUrl, token: config.redisToken })
  }
  return client
}

function auditKey(tenantId: string) {
  return `tickeware:${tenantId}:audit`
}

export async function writeAudit(entry: {
  action: AuditAction
  tenantId: string
  receiptId?: string
  ip?: string
}): Promise<void> {
  const now = Date.now()
  const full: AuditEntry = {
    at: now,
    atISO: new Date(now).toISOString(),
    action: entry.action,
    tenantId: entry.tenantId,
    receiptId: entry.receiptId,
    ip: entry.ip,
  }

  console.info('[audit]', JSON.stringify(full))

  const redis = getClient()
  if (!redis) return

  try {
    const key = auditKey(entry.tenantId)
    await redis.lpush(key, full)
    await redis.ltrim(key, 0, config.auditMaxEntries - 1)
  } catch (err) {
    console.error('[audit] redis write failed', err)
  }
}
