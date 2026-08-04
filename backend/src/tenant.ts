import type { NextFunction, Request, Response } from 'express'
import { config } from './config.js'
import { isValidTenantId } from './validate.js'

export type TenantRequest = Request & { tenantId: string }

export function resolveTenant(req: Request, res: Response, next: NextFunction) {
  const header = req.headers['x-tenant-id']
  const raw =
    (typeof header === 'string' && header.trim()) ||
    (typeof req.query.tenant === 'string' && req.query.tenant.trim()) ||
    config.defaultTenant

  if (!isValidTenantId(raw)) {
    res.status(400).json({ error: 'Invalid tenant id', code: 'INVALID_TENANT' })
    return
  }

  if (config.allowedTenants.length && !config.allowedTenants.includes(raw)) {
    res.status(403).json({ error: 'Tenant not allowed', code: 'TENANT_FORBIDDEN' })
    return
  }

  ;(req as TenantRequest).tenantId = raw
  next()
}
