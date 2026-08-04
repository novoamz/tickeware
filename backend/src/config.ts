import 'dotenv/config'

function required(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed || trimmed.includes('YOUR-') || trimmed.includes('YOUR_')) {
    return undefined
  }
  return trimmed
}

function parseList(value: string | undefined): string[] {
  if (!value?.trim()) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const defaultTenant = required(process.env.DEFAULT_TENANT) || 'default'
const allowedTenants = parseList(process.env.ALLOWED_TENANTS)
if (!allowedTenants.includes(defaultTenant)) {
  allowedTenants.unshift(defaultTenant)
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  redisUrl: required(process.env.UPSTASH_REDIS_REST_URL),
  redisToken: required(process.env.UPSTASH_REDIS_REST_TOKEN),
  /** When set, all /api/receipts* routes require this key. */
  apiKey: required(process.env.API_KEY),
  defaultTenant,
  allowedTenants,
  /** Soft-deleted receipts retained this many days before eligible for purge (0 = keep forever). */
  softDeleteRetentionDays: Math.max(0, Number(process.env.SOFT_DELETE_RETENTION_DAYS) || 30),
  /** Optional Redis TTL on live receipt keys (seconds). 0 = no expiry. */
  receiptTtlSeconds: Math.max(0, Number(process.env.RECEIPT_TTL_SECONDS) || 0),
  /** Max audit entries kept per tenant in Redis. */
  auditMaxEntries: Math.max(10, Number(process.env.AUDIT_MAX_ENTRIES) || 500),
}

export const isRedisConfigured = !!(config.redisUrl && config.redisToken)
