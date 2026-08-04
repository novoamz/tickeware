import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isValidId, isValidTenantId, validateReceiptData } from './validate.js'

describe('validateReceiptData', () => {
  it('accepts a minimal valid payload', () => {
    const data = validateReceiptData({
      issuer: { name: 'ACME', taxId: '1-9', address: 'Calle 1' },
      client: { name: 'Cliente', taxId: '', address: '' },
      meta: { receiptNumber: '001', date: '2026-01-01', paymentMethod: 'Efectivo' },
      items: [{ description: 'Servicio', quantity: 1, unitPrice: 1000 }],
      taxRate: 19,
    })
    assert.equal(data.issuer.name, 'ACME')
    assert.equal(data.items.length, 1)
    assert.equal(data.taxRate, 19)
  })

  it('rejects taxRate out of range', () => {
    assert.throws(
      () => validateReceiptData({ taxRate: 999, items: [] }),
      /taxRate/,
    )
  })

  it('rejects too many items', () => {
    const items = Array.from({ length: 101 }, () => ({
      description: 'x',
      quantity: 1,
      unitPrice: 1,
    }))
    assert.throws(() => validateReceiptData({ items }), /items/)
  })

  it('rejects negative unitPrice', () => {
    assert.throws(
      () =>
        validateReceiptData({
          items: [{ description: 'x', quantity: 1, unitPrice: -1 }],
        }),
      /unitPrice|too small|greater/i,
    )
  })
})

describe('isValidId', () => {
  it('accepts uuid', () => {
    assert.equal(isValidId('550e8400-e29b-41d4-a716-446655440000'), true)
  })
  it('rejects garbage', () => {
    assert.equal(isValidId('../etc'), false)
  })
})

describe('isValidTenantId', () => {
  it('accepts simple ids', () => {
    assert.equal(isValidTenantId('default'), true)
    assert.equal(isValidTenantId('acme-co'), true)
  })
  it('rejects empty / invalid', () => {
    assert.equal(isValidTenantId(''), false)
    assert.equal(isValidTenantId('a b'), false)
  })
})
