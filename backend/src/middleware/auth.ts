import type { NextFunction, Request, Response } from 'express'
import { config } from '../config.js'
import { timingSafeEqual, createHash } from 'node:crypto'

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

function extractKey(req: Request): string | undefined {
  const header = req.headers['x-api-key']
  if (typeof header === 'string' && header.trim()) return header.trim()

  const auth = req.headers.authorization
  if (typeof auth === 'string') {
    const m = /^Bearer\s+(.+)$/i.exec(auth)
    if (m?.[1]) return m[1].trim()
  }
  return undefined
}

/**
 * If API_KEY is set in env, require matching X-API-Key or Authorization: Bearer.
 * If unset, requests pass (dev / single-trust network).
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  if (!config.apiKey) {
    next()
    return
  }

  const provided = extractKey(req)
  if (!provided || !safeEqual(provided, config.apiKey)) {
    res.status(401).json({ error: 'Unauthorized', code: 'INVALID_API_KEY' })
    return
  }

  next()
}
