const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function fmtCLP(num) {
  return CLP.format(Math.round(num || 0))
}

// Devuelve el multiplicador efectivo de cantidad: vacío = 1 (precio unitario directo)
export function effectiveQty(qty) {
  return qty === '' || qty === null || qty === undefined ? 1 : Number(qty) || 0
}

export function formatDate(iso) {
  if (!iso) return '-'
  const [year, month, day] = iso.split('-')
  return day && month && year ? `${day}/${month}/${year}` : '-'
}

export function formatSavedAt(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function calcSubtotal(items = []) {
  return items.reduce(
    (acc, item) => acc + effectiveQty(item.quantity) * (item.unitPrice || 0),
    0
  )
}

export function calcTotal(items = [], taxRate = 0) {
  const subtotal = calcSubtotal(items)
  return subtotal + subtotal * (taxRate / 100)
}

export function printPage() {
  if (typeof window !== 'undefined') window.print()
}

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export function blankReceipt() {
  return {
    issuer: { name: '', taxId: '', address: '' },
    client: { name: '', taxId: '', address: '' },
    meta: {
      receiptNumber: '001',
      date: todayISO(),
      paymentMethod: 'Efectivo',
    },
    items: [{ id: uid(), description: '', quantity: '', unitPrice: 0 }],
    taxRate: 0,
  }
}
