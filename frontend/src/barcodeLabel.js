const KEY = 'barcode-label-settings'

const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
]

export const barcodeLabelDefaults = {
  mode: 'a4',
  cols: 5,
  rows: 6,
  labelWidth: 40,
  labelHeight: 30,
  showName: true,
  showPrice: true,
  showUnit: true,
  showUnitPrice: true,
  showDomestic: true,
  showOrigin: true,
  showPriceDate: true,
  showCompany: true
}

function clamp(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

export function readBarcodeLabelSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      mode: raw.mode === 'label' ? 'label' : 'a4',
      cols: clamp(raw.cols, 1, 8, barcodeLabelDefaults.cols),
      rows: clamp(raw.rows, 1, 12, barcodeLabelDefaults.rows),
      labelWidth: clamp(raw.labelWidth, 20, 120, barcodeLabelDefaults.labelWidth),
      labelHeight: clamp(raw.labelHeight, 12, 160, barcodeLabelDefaults.labelHeight),
      showName: raw.showName !== false,
      showPrice: raw.showPrice !== false,
      showUnit: raw.showUnit !== false,
      showUnitPrice: raw.showUnitPrice !== false,
      showDomestic: raw.showDomestic !== false,
      showOrigin: raw.showOrigin !== false,
      showPriceDate: raw.showPriceDate !== false,
      showCompany: raw.showCompany !== false
    }
  } catch {
    return { ...barcodeLabelDefaults }
  }
}

export function saveBarcodeLabelSettings(patch) {
  const next = { ...readBarcodeLabelSettings(), ...patch }
  localStorage.setItem(KEY, JSON.stringify(next))
  return readBarcodeLabelSettings()
}

export function labelsPerSheet(settings = readBarcodeLabelSettings()) {
  if (settings.mode === 'label') return 1
  return settings.cols * settings.rows
}

export function code128Svg(text, height = 46) {
  const source = String(text || '').trim()
  const values = []
  for (const ch of source) {
    const code = ch.charCodeAt(0)
    if (code < 32 || code > 126) return ''
    values.push(code - 32)
  }
  if (!values.length) return ''
  let sum = 104
  values.forEach((value, index) => { sum += value * (index + 1) })
  const codes = [104, ...values, sum % 103, 106]
  let x = 10
  let on = true
  let bars = ''
  for (const code of codes) {
    const pattern = PATTERNS[code]
    if (!pattern) return ''
    for (const digit of pattern) {
      const width = Number(digit)
      if (on) bars += `<rect x="${x}" y="0" width="${width}" height="${height}" fill="#000"/>`
      x += width
      on = !on
    }
  }
  const total = x + 10
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height}" preserveAspectRatio="none" role="img">${bars}</svg>`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function labelDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })
}

function money(value) {
  return Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function packSize(job) {
  const qty = Number(job.unitQty)
  if (!Number.isFinite(qty) || qty <= 0) return ''
  const type = String(job.unitType || '').trim()
  const text = Number.isInteger(qty) ? String(qty) : String(qty)
  return `${text}${type}`
}

function unitPriceLine(job) {
  const qty = Number(job.unitQty)
  const price = Number(job.price)
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price)) return ''
  const type = String(job.unitType || '').trim()
  return `KDV Dahildir Birim Fiyat:${money(price / qty)} ₺${type ? `/ ${type}` : ''}`
}

function labelMarkup(job, settings) {
  const name = settings.showName ? `<div class="name">${escapeHtml(job.name)}</div>` : '<div class="name"></div>'
  const badge = settings.showDomestic && job.isDomestic
    ? '<div class="badge"><span>YERLİ</span><span>ÜRETİM</span></div>'
    : ''
  const size = settings.showUnit ? packSize(job) : ''
  const qty = size ? `<div class="qty">${escapeHtml(size)}</div>` : ''
  const price = settings.showPrice ? `<div class="price">${money(job.price)}₺</div>` : ''
  const unitPrice = settings.showUnitPrice ? unitPriceLine(job) : ''
  const changed = settings.showPriceDate ? labelDate(job.priceChangedAt) : ''
  const left = [
    unitPrice ? `<div>${escapeHtml(unitPrice)}</div>` : '',
    changed ? `<div>Fiyat Değişiklik Tarihi ${escapeHtml(changed)}</div>` : ''
  ].join('')
  const right = [
    settings.showOrigin && job.origin ? `<div>Menşei : ${escapeHtml(job.origin)}</div>` : '',
    settings.showCompany && job.company ? `<div class="company">${escapeHtml(job.company)}</div>` : ''
  ].join('')
  const foot = (left || right) ? `<div class="foot"><div class="foot-l">${left}</div><div class="foot-r">${right}</div></div>` : ''
  return `<div class="label"><div class="top">${name}${badge}</div>${qty}<div class="mid"><div class="bars">${code128Svg(job.barcode)}<div class="code">${escapeHtml(job.barcode)}</div></div>${price}</div>${foot}</div>`
}

export function printBarcodeLabels(jobs, mode) {
  const settings = readBarcodeLabelSettings()
  if (mode === 'a4' || mode === 'label') settings.mode = mode
  const list = (Array.isArray(jobs) ? jobs : [jobs])
    .map((job) => ({
      name: job?.name || '',
      barcode: String(job?.barcode || '').trim(),
      price: job?.price,
      origin: job?.origin || '',
      priceChangedAt: job?.priceChangedAt || '',
      company: job?.company || '',
      unitQty: job?.unitQty,
      unitType: job?.unitType || '',
      isDomestic: job?.isDomestic !== false
    }))
    .filter((job) => job.barcode)
  if (!list.length) throw new Error('Basılacak barkodlu kart seç.')
  const labels = list.map((job) => {
    if (!code128Svg(job.barcode)) throw new Error(`${job.name || job.barcode} barkodu yazdırılamıyor.`)
    return labelMarkup(job, settings)
  })
  const perSheet = labelsPerSheet(settings)
  const css = settings.mode === 'label'
    ? `@page { size: ${settings.labelWidth}mm ${settings.labelHeight}mm; margin: 1.2mm; }
       html, body { margin: 0; }
       .label { height: ${Math.max(8, settings.labelHeight - 2.4)}mm; break-after: page; }
       svg { height: ${Math.max(6, Math.round(settings.labelHeight * 0.28))}mm; }`
    : `@page { size: A4 portrait; margin: 8mm; }
       html, body { margin: 0; }
       .sheet { display: grid; grid-template-columns: repeat(${settings.cols}, 1fr); grid-auto-rows: ${Math.floor(275 / settings.rows)}mm; width: 194mm; break-after: page; align-content: start; }
       .label { border: 0.15mm dashed #cbd5e1; }
       svg { height: 8mm; }`
  const body = settings.mode === 'label'
    ? labels.join('')
    : chunk(labels, perSheet).map((page) => `<section class="sheet">${page.join('')}</section>`).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Barkod</title><style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #000; background: #fff; }
    .label { display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; padding: 0.6mm 1mm; text-align: left; }
    .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 1mm; }
    .name { flex: 1; font-size: 7.5pt; font-weight: 800; line-height: 1.05; text-transform: uppercase; max-height: 2.2em; overflow: hidden; }
    .badge { flex: 0 0 auto; border: 0.25mm solid #c81e1e; color: #c81e1e; font-size: 4.5pt; font-weight: 900; line-height: 1.05; text-align: center; padding: 0.3mm 0.5mm; }
    .badge span { display: block; }
    .qty { font-size: 6.5pt; font-weight: 700; line-height: 1; }
    .mid { display: flex; align-items: center; justify-content: space-between; gap: 1mm; }
    .bars { flex: 1; min-width: 0; }
    .bars svg { width: 100%; display: block; }
    .code { font-size: 6pt; font-family: Consolas, monospace; letter-spacing: 0.3px; text-align: center; }
    .price { font-size: ${settings.mode === 'label' ? Math.min(22, Math.max(12, Math.round(settings.labelWidth / 4.5))) : 11}pt; font-weight: 900; white-space: nowrap; line-height: 1; }
    .foot { display: flex; justify-content: space-between; gap: 1mm; font-size: 5pt; line-height: 1.15; }
    .foot-r { text-align: right; }
    .company { font-weight: 800; text-transform: uppercase; }
    ${css}
  </style></head><body>${body}</body></html>`

  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  doc.open()
  doc.write(html)
  doc.close()
  const win = frame.contentWindow
  win.focus()
  win.print()
  setTimeout(() => frame.remove(), 1500)
}

function chunk(items, size) {
  const pages = []
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size))
  return pages
}
