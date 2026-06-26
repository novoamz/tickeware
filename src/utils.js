export function fmtCLP(num) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(num || 0))
}

// Devuelve el multiplicador efectivo de cantidad: vacío = 1 (precio unitario directo)
export function effectiveQty(qty) {
  return qty === '' || qty === null || qty === undefined ? 1 : Number(qty) || 0
}
