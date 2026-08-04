import { z } from 'zod'
import type { ReceiptData } from './types.js'

const MAX_STRING = 500
const MAX_ITEMS = 100

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const partySchema = z.object({
  name: z.string().max(200).default(''),
  taxId: z.string().max(50).default(''),
  address: z.string().max(MAX_STRING).default(''),
})

const itemSchema = z.object({
  id: z.string().max(64).optional(),
  description: z.string().max(300).default(''),
  quantity: z.union([z.number().finite().min(0), z.literal(''), z.string()]).optional(),
  unitPrice: z.coerce.number().finite().min(0).default(0),
})

const receiptDataSchema = z.object({
  issuer: partySchema.default({ name: '', taxId: '', address: '' }),
  client: partySchema.default({ name: '', taxId: '', address: '' }),
  meta: z
    .object({
      receiptNumber: z.string().max(40).default(''),
      date: z.string().max(32).default(''),
      paymentMethod: z.string().max(60).default(''),
    })
    .default({ receiptNumber: '', date: '', paymentMethod: '' }),
  items: z.array(itemSchema).max(MAX_ITEMS).default([]),
  taxRate: z.coerce.number().finite().min(0).max(100).default(0),
})

export function isValidId(id: string): boolean {
  return UUID_RE.test(id) || /^[a-z0-9]{8,40}$/i.test(id)
}

export function isValidTenantId(id: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,62}$/i.test(id)
}

export function validateReceiptData(raw: unknown): ReceiptData {
  const parsed = receiptDataSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue?.path?.length ? issue.path.join('.') : 'data'
    throw new Error(`data.${path}: ${issue?.message ?? 'invalid'}`)
  }

  const data = parsed.data
  const items = data.items.map((row) => {
    let quantity: number | string = ''
    if (row.quantity === '' || row.quantity == null) {
      quantity = ''
    } else if (typeof row.quantity === 'number') {
      quantity = row.quantity
    } else {
      const q = Number(row.quantity)
      if (!Number.isFinite(q) || q < 0) {
        throw new Error('data.items.quantity must be a non-negative number')
      }
      quantity = q
    }
    return {
      id: row.id,
      description: row.description,
      quantity,
      unitPrice: row.unitPrice,
    }
  })

  return {
    issuer: data.issuer,
    client: data.client,
    meta: data.meta,
    items,
    taxRate: data.taxRate,
  }
}
