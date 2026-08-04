import type { NextFunction, Request, Response } from 'express'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

const WINDOW_MS = 60_000
const MAX_REQUESTS = 120

function clientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket.remoteAddress || 'unknown'
}

/** Simple in-memory rate limit (per process). */
export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = clientKey(req)
  const now = Date.now()
  let bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS }
    buckets.set(key, bucket)
  }

  bucket.count += 1

  res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - bucket.count)))
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)))

  if (bucket.count > MAX_REQUESTS) {
    res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' })
    return
  }

  next()
}

// Opportunistic cleanup to avoid unbounded growth in long-lived processes
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key)
  }
}, WINDOW_MS).unref?.()
