<script setup>
import { computed } from 'vue'
import { calcSubtotal, calcTotal, effectiveQty, fmtCLP, formatDate } from '../utils'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
})

const subtotal = computed(() => calcSubtotal(props.data.items))
const taxAmount = computed(() => subtotal.value * (props.data.taxRate / 100))
const total = computed(() => calcTotal(props.data.items, props.data.taxRate))
const hasTax = computed(() => props.data.taxRate > 0)

const now = computed(() => {
  const d = new Date()
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
})

const line = '─'.repeat(48)
const doubleLine = '═'.repeat(48)
const dash = '· · · · · · · · · · · · · · · · · · · · · · · · ·'
</script>

<template>
  <div class="receipt-thermal">
    <div class="receipt-header">
      <p class="receipt-title">{{ data.issuer.name || 'Nombre de la Empresa' }}</p>
      <p v-if="data.issuer.taxId" class="receipt-meta">RUT: {{ data.issuer.taxId }}</p>
      <p v-if="data.issuer.address" class="receipt-meta whitespace-pre-line">{{ data.issuer.address }}</p>
    </div>

    <div class="receipt-divider">{{ line }}</div>

    <div class="receipt-info">
      <div class="receipt-info-row">
        <span>COMPROBANTE #{{ data.meta.receiptNumber || '001' }}</span>
      </div>
      <div class="receipt-info-row">
        <span>Fecha: {{ formatDate(data.meta.date) }}</span>
        <span>{{ now }}</span>
      </div>
      <div class="receipt-info-row">
        <span>Pago: {{ data.meta.paymentMethod || 'Efectivo' }}</span>
      </div>
    </div>

    <div class="receipt-divider">{{ line }}</div>

    <div class="receipt-client">
      <p class="receipt-client-label">CLIENTE</p>
      <p class="receipt-client-name">{{ data.client.name || '-' }}</p>
      <p v-if="data.client.taxId" class="receipt-client-detail">RUT: {{ data.client.taxId }}</p>
      <p v-if="data.client.address" class="receipt-client-detail whitespace-pre-line">{{ data.client.address }}</p>
    </div>

    <div class="receipt-divider">{{ line }}</div>

    <div class="receipt-items">
      <div class="receipt-items-header">
        <span class="receipt-col-desc">Detalle</span>
        <span class="receipt-col-qty">Cant</span>
        <span class="receipt-col-price">Precio</span>
        <span class="receipt-col-total">Total</span>
      </div>

      <div
        v-for="(item, i) in data.items"
        :key="item.id ?? i"
        class="receipt-item-row"
      >
        <span class="receipt-col-desc">
          <span v-if="item.description">{{ item.description }}</span>
          <span v-else class="receipt-empty">Sin descripción</span>
        </span>
        <span class="receipt-col-qty">
          {{ (item.quantity === '' || item.quantity == null) ? '1' : item.quantity }}
        </span>
        <span class="receipt-col-price">{{ fmtCLP(item.unitPrice) }}</span>
        <span class="receipt-col-total">{{ fmtCLP(effectiveQty(item.quantity) * (item.unitPrice || 0)) }}</span>
      </div>
    </div>

    <div class="receipt-divider">{{ line }}</div>

    <div class="receipt-totals">
      <div class="receipt-total-row">
        <span>Subtotal</span>
        <span>{{ fmtCLP(subtotal) }}</span>
      </div>
      <div v-if="hasTax" class="receipt-total-row">
        <span>IVA ({{ data.taxRate }}%)</span>
        <span>{{ fmtCLP(taxAmount) }}</span>
      </div>
      <div class="receipt-divider">{{ line }}</div>
      <div class="receipt-total-final">
        <span>TOTAL</span>
        <span>{{ fmtCLP(total) }}</span>
      </div>
    </div>

    <div class="receipt-divider">{{ doubleLine }}</div>

    <div class="receipt-footer">
      <p>Gracias por su preferencia</p>
      <p class="receipt-footer-small">Generado con Tickeware</p>
    </div>
  </div>
</template>

<style scoped>
.receipt-thermal {
  max-width: 480px;
  margin: 0 auto;
  background: white;
  border: 1px solid #d1d5db;
  padding: 28px 24px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #111;
}

.receipt-header {
  text-align: center;
  margin-bottom: 6px;
}

.receipt-title {
  font-size: 18px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.receipt-meta {
  font-size: 13px;
  color: #374151;
  margin-top: 2px;
}

.receipt-divider {
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
  line-height: 1;
  margin: 8px 0;
}

.receipt-info {
  text-align: center;
}

.receipt-info-row {
  display: flex;
  justify-content: center;
  gap: 12px;
  font-size: 13px;
}

.receipt-client {
  text-align: center;
}

.receipt-client-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #6b7280;
  margin-bottom: 4px;
}

.receipt-client-name {
  font-weight: 600;
  font-size: 14px;
}

.receipt-client-detail {
  font-size: 13px;
  color: #4b5563;
}

.receipt-items {
  margin: 6px 0;
}

.receipt-items-header {
  display: flex;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #6b7280;
  padding: 4px 0;
  border-bottom: 1px dashed #9ca3af;
  margin-bottom: 4px;
}

.receipt-col-desc {
  flex: 1;
  text-align: left;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.receipt-col-qty {
  width: 48px;
  text-align: right;
  flex-shrink: 0;
}

.receipt-col-price {
  width: 90px;
  text-align: right;
  flex-shrink: 0;
}

.receipt-col-total {
  width: 95px;
  text-align: right;
  flex-shrink: 0;
}

.receipt-item-row {
  display: flex;
  gap: 4px;
  padding: 5px 0;
  border-bottom: 1px dotted #e5e7eb;
  font-size: 13px;
}

.receipt-empty {
  color: #9ca3af;
  font-style: italic;
}

.receipt-totals {
  padding: 4px 0;
}

.receipt-total-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 3px 0;
}

.receipt-total-final {
  display: flex;
  justify-content: space-between;
  font-size: 17px;
  font-weight: 700;
  padding: 6px 0;
}

.receipt-footer {
  text-align: center;
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
}

.receipt-footer-small {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
}

@media print {
  .receipt-thermal {
    max-width: 100%;
    border: none;
    padding: 16px;
  }
}
</style>
