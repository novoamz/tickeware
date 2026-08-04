export interface Issuer {
  name: string
  taxId: string
  address: string
}

export interface Client {
  name: string
  taxId: string
  address: string
}

export interface ReceiptMeta {
  receiptNumber: string
  date: string
  paymentMethod: string
}

export interface ReceiptItem {
  id?: string
  description: string
  quantity: number | string
  unitPrice: number
}

export interface ReceiptData {
  issuer: Issuer
  client: Client
  meta: ReceiptMeta
  items: ReceiptItem[]
  taxRate: number
}

export interface StoredReceipt {
  id: string
  tenantId: string
  savedAt: number
  savedAtISO: string
  data: ReceiptData
  deletedAt?: number | null
  deletedAtISO?: string | null
}

export type AuditAction = 'receipt.create' | 'receipt.delete' | 'receipt.purge'

export interface AuditEntry {
  at: number
  atISO: string
  action: AuditAction
  tenantId: string
  receiptId?: string
  ip?: string
}
