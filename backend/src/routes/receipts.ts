import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { writeAudit } from '../audit.js'
import { receiptStore } from '../redis.js'
import type { TenantRequest } from '../tenant.js'
import { isValidId, validateReceiptData } from '../validate.js'

export const receiptsRouter = Router()

function tenantOf(req: import('express').Request): string {
  return (req as unknown as TenantRequest).tenantId
}

function requireRedis(
  _req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
) {
  if (!receiptStore.isReady()) {
    res.status(503).json({
      error: 'Redis is not configured on the server',
      code: 'REDIS_NOT_CONFIGURED',
    })
    return
  }
  next()
}

function clientIp(req: import('express').Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket.remoteAddress || undefined
}

receiptsRouter.use(requireRedis)

/** GET /api/receipts — list latest non-deleted receipts */
receiptsRouter.get('/', async (req, res) => {
  const tenantId = tenantOf(req)
  try {
    const receipts = await receiptStore.list(tenantId, 100)
    res.json({ receipts, tenantId })
  } catch (error) {
    console.error('[GET /api/receipts]', error)
    res.status(502).json({ error: 'Failed to list receipts' })
  }
})

/** POST /api/receipts — create receipt { data } */
receiptsRouter.post('/', async (req, res) => {
  const tenantId = tenantOf(req)
  try {
    const data = validateReceiptData(req.body?.data)
    const now = Date.now()
    const receipt = {
      id: randomUUID(),
      tenantId,
      savedAt: now,
      savedAtISO: new Date(now).toISOString(),
      data,
      deletedAt: null,
      deletedAtISO: null,
    }
    await receiptStore.save(tenantId, receipt)
    await writeAudit({
      action: 'receipt.create',
      tenantId,
      receiptId: receipt.id,
      ip: clientIp(req),
    })
    res.status(201).json({ receipt })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid payload'
    if (message.startsWith('data.') || message.startsWith('body.')) {
      res.status(400).json({ error: message })
      return
    }
    console.error('[POST /api/receipts]', error)
    res.status(502).json({ error: 'Failed to save receipt' })
  }
})

/** POST /api/receipts/purge — hard-delete expired soft-deletes */
receiptsRouter.post('/purge', async (req, res) => {
  const tenantId = tenantOf(req)
  try {
    const purged = await receiptStore.purgeDeleted(tenantId)
    await writeAudit({
      action: 'receipt.purge',
      tenantId,
      ip: clientIp(req),
    })
    res.json({ purged, tenantId })
  } catch (error) {
    console.error('[POST /api/receipts/purge]', error)
    res.status(502).json({ error: 'Failed to purge receipts' })
  }
})

/** DELETE /api/receipts/:id — soft delete */
receiptsRouter.delete('/:id', async (req, res) => {
  const tenantId = tenantOf(req)
  try {
    const { id } = req.params
    if (!isValidId(id)) {
      res.status(400).json({ error: 'Invalid receipt id' })
      return
    }
    const ok = await receiptStore.softRemove(tenantId, id)
    if (!ok) {
      res.status(404).json({ error: 'Receipt not found' })
      return
    }
    await writeAudit({
      action: 'receipt.delete',
      tenantId,
      receiptId: id,
      ip: clientIp(req),
    })
    res.status(204).send()
  } catch (error) {
    console.error('[DELETE /api/receipts/:id]', error)
    res.status(502).json({ error: 'Failed to delete receipt' })
  }
})
