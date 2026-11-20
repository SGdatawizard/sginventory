export const money = (v, dp = 2) =>
  v === null || v === undefined || v === '' || Number.isNaN(Number(v))
    ? '—'
    : '£' + Number(v).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })

export const moneyRound = (v) => money(v, 0)

export const date = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB') : '—')

export const today = () => new Date().toISOString().slice(0, 10)

export const STATUS_LABEL = {
  in_stock: 'In stock',
  at_auction: 'At auction',
  sold: 'Sold',
  returned: 'Returned to vendor',
}

// strip characters that break Supabase "or" filters
export const safeTerm = (s) => s.replace(/[,()*%\\]/g, ' ').trim()

export const batchNo = (id) => (id ? 'B' + String(id).padStart(4, '0') : '—')

export const BATCH_STATUS = {
  open: 'Open',
  ready: 'Ready to print',
  printed: 'Printed',
  uploaded: 'Uploaded to web',
}

// download a Blob as a file
export function saveBlob(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
