import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Cpu, Layers, Package, Palette, Pencil, Percent, Plus, Shirt, Star, Tag, Trash2, UserCog, X } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { allows } from '../permissions'

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#64748b']
const VAT_RATES = [0, 1, 10, 20]

const NAV = [
  { id: 'stock', title: 'Stok', hint: 'Ürün kartı ve barkod', icon: Package },
  { id: 'category', title: 'Kategori', hint: 'Ürün grupları', icon: Tag },
  { id: 'department', title: 'Departman', hint: 'ÖKC tuş takımı', icon: Cpu },
  { id: 'size', title: 'Beden', hint: 'Hazır beden listesi', icon: Layers },
  { id: 'color', title: 'Renk', hint: 'Hazır renk listesi', icon: Palette },
  { id: 'users', title: 'Kullanıcı', hint: 'Personel ve yetki', icon: UserCog, href: '/app/users' }
]

const UNITS = ['Adet', 'Kg', 'Gram', 'Litre', 'Paket', 'Koli']
const UNIT_TYPES = ['Adet', 'KG', 'Litre', 'Gram', 'Metre', 'Paket']

const emptyProduct = {
  name: '',
  barcode: '',
  categoryId: '',
  unit: 'Adet',
  criticalStockLevel: 5,
  vatRate: 20,
  salePrice: '',
  originCountry: '',
  unitQty: 1,
  unitType: 'Adet',
  isDomestic: true,
  hasVariants: false,
  stockQuantity: '',
  purchasePrice: '',
  pinShortcut: false
}

function ColorDots({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`swatch ${value === color ? 'on' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
          aria-label={color}
        />
      ))}
    </div>
  )
}

function Chips({ items, empty, onRemove, label }) {
  if (!items.length) return <p className="muted">{empty}</p>
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item.id} className="def-chip" style={{ borderColor: item.color || item.hex || undefined }}>
          {(item.color || item.hex) && (
            <span className="w-3 h-3 rounded-full" style={{ background: item.color || item.hex }} />
          )}
          <span>{label(item)}</span>
          <button type="button" className="icon-x" onClick={() => onRemove(item.id)} aria-label="Sil">×</button>
        </span>
      ))}
    </div>
  )
}

export default function ProductsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState('stock')
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [departments, setDepartments] = useState([])
  const [sizes, setSizes] = useState([])
  const [colors, setColors] = useState([])
  const [form, setForm] = useState(emptyProduct)
  const [variantRows, setVariantRows] = useState([])
  const [pickSize, setPickSize] = useState('')
  const [pickColor, setPickColor] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [lookup, setLookup] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [categoryColor, setCategoryColor] = useState(COLORS[0])
  const [deptName, setDeptName] = useState('')
  const [deptColor, setDeptColor] = useState('#6366f1')
  const [deptVat, setDeptVat] = useState(20)
  const [sizeName, setSizeName] = useState('')
  const [colorName, setColorName] = useState('')
  const [colorHex, setColorHex] = useState(COLORS[3])
  const [error, setError] = useState('')
  const [stockPage, setStockPage] = useState(1)
  const [stockTotal, setStockTotal] = useState(0)
  const [stockPages, setStockPages] = useState(1)
  const [stockQuery, setStockQuery] = useState('')

  async function load(page = stockPage, q = stockQuery) {
    setError('')
    const token = session.token
    const params = new URLSearchParams({ page: String(page), pageSize: '100' })
    if (q.trim()) params.set('q', q.trim())
    const [productPage, cats, depts, sizeList, colorList] = await Promise.all([
      api(`/api/products?${params}`, { token }),
      api('/api/categories', { token }),
      api('/api/definitions/departments', { token }),
      api('/api/definitions/sizes', { token }),
      api('/api/definitions/colors', { token })
    ])
    setItems(productPage.items || [])
    setStockTotal(productPage.total || 0)
    setStockPage(productPage.page || page)
    setStockPages(productPage.pageCount || 1)
    setCategories(cats)
    setDepartments(depts)
    setSizes(sizeList)
    setColors(colorList)
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    const code = params.get('barkod')
    if (!code) return
    setTab('stock')
    setEditingId(null)
    setForm({ ...emptyProduct, barcode: code })
    setVariantRows([])
    setPickSize('')
    setPickColor('')
    setLookup('')
    setShowModal(true)
    setParams({}, { replace: true })
  }, [params])

  async function run(action) {
    setError('')
    try {
      await action()
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  function randomBarcode() {
    setForm((prev) => ({ ...prev, barcode: String(Math.floor(100000000000 + Math.random() * 900000000000)) }))
    setLookup('')
  }

  async function lookupBarcode() {
    const code = form.barcode.trim()
    if (!code) return
    try {
      const found = await api(`/api/products/by-barcode/${encodeURIComponent(code)}`, { token: session.token })
      setForm((prev) => ({
        ...prev,
        name: found.name || prev.name,
        salePrice: found.salePrice ?? prev.salePrice,
        vatRate: found.vatRate ?? prev.vatRate,
        purchasePrice: found.purchasePrice ?? prev.purchasePrice
      }))
      setLookup('Bu barkod zaten stokta var.')
    } catch {
      setLookup('Kayıtlarda bu barkod yok. Yeni kart olarak kaydedebilirsin.')
    }
  }

  function addVariantRow(size, color) {
    const sizeName = size || pickSize
    const colorName = color || pickColor
    if (!sizeName && !colorName) return
    setVariantRows((rows) => [...rows, { size: sizeName, color: colorName, stock: '' }])
  }

  function shortcutIds() {
    try { return JSON.parse(localStorage.getItem('pos-shortcuts') || '[]') } catch { return [] }
  }

  function sameId(a, b) {
    return String(a).toLowerCase() === String(b).toLowerCase()
  }

  function setShortcut(productId, pinned) {
    const current = shortcutIds().filter((id) => !sameId(id, productId))
    localStorage.setItem('pos-shortcuts', JSON.stringify(pinned ? [...current, productId] : current))
  }

  function openNew() {
    setEditingId(null)
    setForm(emptyProduct)
    setVariantRows([])
    setPickSize('')
    setPickColor('')
    setLookup('')
    setShowModal(true)
  }

  function openEdit(product) {
    const variants = product.variants || []
    setEditingId(product.id)
    setForm({
      name: product.name || '',
      barcode: product.barcode || '',
      categoryId: product.categoryId || '',
      unit: product.unit || 'Adet',
      criticalStockLevel: product.criticalStockLevel ?? 5,
      vatRate: product.vatRate ?? 20,
      salePrice: product.salePrice ?? '',
      originCountry: product.originCountry || '',
      unitQty: product.unitQty || 1,
      unitType: product.unitType || 'Adet',
      isDomestic: product.isDomestic !== false,
      hasVariants: variants.length > 0,
      stockQuantity: product.stockQuantity ?? '',
      purchasePrice: product.purchasePrice ?? '',
      pinShortcut: shortcutIds().some((id) => sameId(id, product.id))
    })
    setVariantRows(variants.map((row) => ({
      size: row.sizeName || '',
      color: row.colorName || '',
      stock: row.stockQuantity ?? ''
    })))
    setPickSize('')
    setPickColor('')
    setLookup('')
    setShowModal(true)
  }

  function amount(value) {
    const n = Number(String(value ?? '').trim().replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  async function saveProduct(e) {
    e.preventDefault()
    const salePrice = amount(form.salePrice)
    const stockQuantity = amount(form.stockQuantity)
    const purchasePrice = amount(form.purchasePrice)
    if (!form.name.trim()) {
      setError('Ürün adı gerekli.')
      return
    }
    if (salePrice === null || salePrice < 0) {
      setError('Satış fiyatı sayı olmalı.')
      return
    }
    if (!form.hasVariants && form.stockQuantity !== '' && stockQuantity === null) {
      setError('Stok adedi sayı olmalı. Ondalık için virgül ya da nokta kullan.')
      return
    }
    if (form.hasVariants && variantRows.some((row) => (row.size || row.color) && amount(row.stock) === null && String(row.stock ?? '').trim() !== '')) {
      setError('Varyant stoğu sayı olmalı.')
      return
    }
    if (form.hasVariants && variantRows.length > 0 && variantRows.every((row) => !row.size && !row.color)) {
      setError('Stok satırı için beden veya renk seç.')
      return
    }
    await run(async () => {
      const lines = form.hasVariants
        ? variantRows.filter((row) => row.size || row.color).map((row) => ({
            size: row.size,
            color: row.color,
            stockQuantity: amount(row.stock) || 0
          }))
        : []
      const saved = await api(editingId ? `/api/products/${editingId}` : '/api/products', {
        method: editingId ? 'PUT' : 'POST',
        token: session.token,
        body: {
          name: form.name.trim(),
          barcode: form.barcode.trim(),
          categoryId: form.categoryId || null,
          purchasePrice: purchasePrice || 0,
          salePrice,
          vatRate: amount(form.vatRate) || 0,
          stockQuantity: form.hasVariants ? 0 : (stockQuantity || 0),
          criticalStockLevel: Number(form.criticalStockLevel || 0),
          unit: form.unit,
          originCountry: form.originCountry,
          isDomestic: !!form.isDomestic,
          unitQty: Number(form.unitQty || 1),
          unitType: form.unitType,
          variants: lines
        }
      })
      const productId = saved?.id || editingId
      if (productId) setShortcut(productId, form.pinShortcut)
      setShowModal(false)
      setEditingId(null)
      setForm(emptyProduct)
    })
  }

  const unitPrice = Number(form.salePrice) > 0 && Number(form.unitQty) > 0
    ? (Number(form.salePrice) / Number(form.unitQty)).toFixed(2)
    : ''

  const counts = {
    stock: stockTotal,
    category: categories.length,
    department: departments.length,
    size: sizes.length,
    color: colors.length
  }

  return (
    <div className="p-4 lg:p-6">
      <h1>Tanımlamalar</h1>
      <p className="muted mb-4">Kartlar solda duruyor. Yeni tanım ekledikçe menü uzar, sağdaki alan değişir.</p>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">
        <nav className="panel def-side lg:sticky lg:top-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1 mb-2">Tanım kartları</div>
          {NAV.filter((item) => item.id !== 'users' || allows(session, 'can_manage_users')).map((item) => {
            const Icon = item.icon
            const on = tab === item.id
            return (
              <button key={item.id} type="button" className={`nav ${on ? 'on' : ''}`} onClick={() => { if (item.href) { navigate(item.href); return } setTab(item.id); setError('') }}>
                <Icon className="w-4 h-4 shrink-0" />
                <span>
                  <span className="block font-bold">{item.title}</span>
                  <span className="sub">{item.id === 'users' ? item.hint : `${counts[item.id]} kayıt · ${item.hint}`}</span>
                </span>
              </button>
            )
          })}
        </nav>

        <section className="panel">
          {error && <p className="error mb-3">{error}</p>}

          {tab === 'stock' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2>Stok kartları</h2>
                  <p className="muted">Sayfa başı 100 kart. Yeni ürünü pencereden ekle.</p>
                </div>
                <button className="primary" type="button" onClick={openNew}>
                  Yeni Ürün Ekle
                </button>
              </div>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); load(1, stockQuery).catch((err) => setError(err.message)) }}>
                <input value={stockQuery} onChange={(e) => setStockQuery(e.target.value)} placeholder="Ürün adı veya barkod ara" className="flex-1" />
                <button type="submit" className="primary">Ara</button>
                {stockQuery && (
                  <button type="button" onClick={() => { setStockQuery(''); load(1, '').catch((err) => setError(err.message)) }}>Temizle</button>
                )}
              </form>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ürün</th>
                      <th>Kategori</th>
                      <th>Barkod</th>
                      <th>Satış</th>
                      <th>Stok</th>
                      <th>KDV</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{p.categoryName || '-'}</td>
                        <td>{p.barcode || '-'}</td>
                        <td>{Number(p.salePrice).toFixed(2)} ₺</td>
                        <td>{p.stockQuantity}</td>
                        <td>%{p.vatRate}</td>
                        <td>
                          <button type="button" className="row-edit" onClick={() => openEdit(p)}>
                            <Pencil className="w-3.5 h-3.5" /> Düzenle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                <span>{stockTotal === 0 ? '0 kayıt' : `${(stockPage - 1) * 100 + 1}-${Math.min(stockPage * 100, stockTotal)} / ${stockTotal} kayıt`}</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={stockPage <= 1} onClick={() => load(stockPage - 1).catch((err) => setError(err.message))}>Önceki</button>
                  <span className="font-bold text-slate-200">Sayfa {stockPage} / {stockPages}</span>
                  <button type="button" disabled={stockPage >= stockPages} onClick={() => load(stockPage + 1).catch((err) => setError(err.message))}>Sonraki</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'category' && (
            <div className="space-y-4">
              <h2>Kategori</h2>
              <p className="muted">Stok penceresindeki kategori listesine düşer.</p>
              <form className="stack" onSubmit={(e) => {
                e.preventDefault()
                run(async () => {
                  await api('/api/categories', { method: 'POST', token: session.token, body: { name: categoryName.trim(), color: categoryColor } })
                  setCategoryName('')
                })
              }}>
                <label>
                  Kategori adı
                  <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required placeholder="Örn: Gıda, İçecek, Tişört" />
                </label>
                <div>
                  <span className="text-xs font-semibold text-slate-300">Renk</span>
                  <ColorDots value={categoryColor} onChange={setCategoryColor} />
                </div>
                <button className="primary" type="submit">Kategori ekle</button>
              </form>
              <Chips items={categories} empty="Henüz kategori yok." onRemove={(id) => run(() => api(`/api/categories/${id}`, { method: 'DELETE', token: session.token }))} label={(c) => c.name} />
            </div>
          )}

          {tab === 'department' && (
            <div className="space-y-4">
              <h2>Departman</h2>
              <p className="muted">Hızlı satıştaki departman tuşları buradan gelir.</p>
              <form className="stack" onSubmit={(e) => {
                e.preventDefault()
                run(async () => {
                  await api('/api/definitions/departments', {
                    method: 'POST',
                    token: session.token,
                    body: { name: deptName.trim(), color: deptColor, vatRate: Number(deptVat) }
                  })
                  setDeptName('')
                })
              }}>
                <label>
                  Departman adı
                  <input value={deptName} onChange={(e) => setDeptName(e.target.value)} required placeholder="Örn: Gıda %1" />
                </label>
                <div>
                  <span className="text-xs font-semibold text-slate-300">KDV</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {VAT_RATES.map((rate) => (
                      <button key={rate} type="button" className={`chip ${Number(deptVat) === rate ? 'on' : ''}`} style={Number(deptVat) === rate ? { background: '#10b981' } : undefined} onClick={() => setDeptVat(rate)}>
                        %{rate}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-300">Tuş rengi</span>
                  <ColorDots value={deptColor} onChange={setDeptColor} />
                </div>
                <button className="primary" type="submit">Departman ekle</button>
              </form>
              <Chips
                items={departments}
                empty="Henüz departman yok. Ekleyene kadar satış ekranında hazır üç tuş durur."
                onRemove={(id) => run(() => api(`/api/definitions/departments/${id}`, { method: 'DELETE', token: session.token }))}
                label={(d) => `${d.name} · %${d.vatRate}`}
              />
            </div>
          )}

          {tab === 'size' && (
            <div className="space-y-4">
              <h2>Beden</h2>
              <p className="muted">Detaylı ürün eklerken bu bedenler buton olur.</p>
              <form className="flex flex-wrap gap-2 items-end" onSubmit={(e) => {
                e.preventDefault()
                run(async () => {
                  await api('/api/definitions/sizes', { method: 'POST', token: session.token, body: { name: sizeName.trim() } })
                  setSizeName('')
                })
              }}>
                <label className="flex-1 min-w-[180px]">
                  Beden
                  <input value={sizeName} onChange={(e) => setSizeName(e.target.value)} required placeholder="Örn: S, M, XL, 38-40" />
                </label>
                <button className="primary" type="submit">Beden ekle</button>
              </form>
              <Chips items={sizes} empty="Henüz beden yok." onRemove={(id) => run(() => api(`/api/definitions/sizes/${id}`, { method: 'DELETE', token: session.token }))} label={(s) => s.name} />
            </div>
          )}

          {tab === 'color' && (
            <div className="space-y-4">
              <h2>Renk</h2>
              <p className="muted">Detaylı ürün eklerken bu renkler buton olur.</p>
              <form className="stack" onSubmit={(e) => {
                e.preventDefault()
                run(async () => {
                  await api('/api/definitions/colors', { method: 'POST', token: session.token, body: { name: colorName.trim(), color: colorHex } })
                  setColorName('')
                })
              }}>
                <label>
                  Renk adı
                  <input value={colorName} onChange={(e) => setColorName(e.target.value)} required placeholder="Örn: Siyah, Lacivert, Vizon" />
                </label>
                <div>
                  <span className="text-xs font-semibold text-slate-300">Görünen renk</span>
                  <ColorDots value={colorHex} onChange={setColorHex} />
                </div>
                <button className="primary" type="submit">Renk ekle</button>
              </form>
              <Chips items={colors} empty="Henüz renk yok." onRemove={(id) => run(() => api(`/api/definitions/colors/${id}`, { method: 'DELETE', token: session.token }))} label={(c) => c.name} />
            </div>
          )}

        </section>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="product-modal bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                {editingId ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
              </h3>
              <button type="button" className="close-x" onClick={() => { setShowModal(false); setEditingId(null) }} aria-label="Kapat">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form className="space-y-4" onSubmit={saveProduct}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">Barkod *</span>
                    <div className="flex items-center gap-3">
                      <button type="button" className="linkish text-emerald-400" onClick={lookupBarcode}>Sorgula</button>
                      <button type="button" className="linkish text-purple-400" onClick={randomBarcode}>Rastgele Üret</button>
                    </div>
                  </div>
                  <input
                    value={form.barcode}
                    onChange={(e) => { setForm({ ...form, barcode: e.target.value }); setLookup('') }}
                    placeholder="Barkod Okutun veya Yazın..."
                    className="font-mono"
                    required={!editingId}
                    autoFocus
                  />
                  {lookup && <p className="text-[11px] text-emerald-300 mt-1">{lookup}</p>}
                </div>
                <label>
                  Kategori
                  <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                    <option value="">Genel Kategori</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              </div>

              <label>
                Ürün Adı *
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Örn: Polo Yaka Tişört, Slim Fit Kot Pantolon veya Çaykur Rize 500g"
                  required
                />
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <label>
                  Birim
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    {UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                  </select>
                </label>
                <label>
                  Kritik Stok
                  <input type="number" className="text-center" value={form.criticalStockLevel} onChange={(e) => setForm({ ...form, criticalStockLevel: e.target.value })} />
                </label>
                <label>
                  <span className="text-amber-300 inline-flex items-center gap-1"><Percent className="w-3 h-3" /> KDV Oranı (%) *</span>
                  <select className="text-amber-300 font-bold border-amber-500/40" value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: e.target.value })}>
                    {[20, 10, 1, 0].map((rate) => <option key={rate} value={rate}>%{rate}</option>)}
                  </select>
                </label>
                <label>
                  Satış Fiyatı (₺) *
                  <input type="text" inputMode="decimal" required className="text-center text-emerald-400 font-bold font-mono" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} placeholder="0.00" />
                </label>
              </div>

              <div className="p-3.5 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/40 to-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white inline-flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-400" /> Resmî Fiyat Etiketi & Yerli Üretim Detayları
                  </span>
                  <label className="flex items-center gap-2 text-xs text-blue-300 font-semibold cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" checked={form.isDomestic} onChange={(e) => setForm({ ...form, isDomestic: e.target.checked })} />
                    Yerli Üretim Amblemi Göster (TR)
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label>
                    Üretim Yeri / Menşei
                    <input value={form.originCountry} onChange={(e) => setForm({ ...form, originCountry: e.target.value })} placeholder="Örn: TÜRKİYE" />
                  </label>
                  <label>
                    Birim Miktarı (Ambalaj)
                    <input type="number" step="0.01" className="text-center font-mono" value={form.unitQty} onChange={(e) => setForm({ ...form, unitQty: e.target.value })} />
                  </label>
                  <label>
                    Birim Cinsi
                    <select value={form.unitType} onChange={(e) => setForm({ ...form, unitType: e.target.value })}>
                      {UNIT_TYPES.map((unit) => <option key={unit}>{unit}</option>)}
                    </select>
                  </label>
                </div>
                {unitPrice && (
                  <div className="text-[11px] font-mono text-slate-300 bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 flex justify-between">
                    <span>Hesaplanan Birim Fiyatı</span>
                    <span className="text-emerald-400 font-bold">{unitPrice} TL / {form.unitType}</span>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 to-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-white inline-flex items-center gap-2">
                    <Shirt className="w-4 h-4 text-purple-400" /> Detaylı Ürün (Beden / Renk Varyantlı Stok)
                  </span>
                  <button
                    type="button"
                    className={`switch ${form.hasVariants ? 'bg-purple-600' : 'bg-slate-700'}`}
                    onClick={() => setForm({ ...form, hasVariants: !form.hasVariants })}
                    aria-label="Detaylı ürün"
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${form.hasVariants ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
                {form.hasVariants && (
                  <div className="space-y-2 border-t border-purple-500/20 pt-3">
                    <div className="text-[11px] text-slate-300">Beden</div>
                    <div className="flex flex-wrap gap-1.5">
                      {sizes.length === 0 && <span className="hint">Beden kartından beden ekle.</span>}
                      {sizes.map((size) => {
                        const selected = pickSize === size.name
                        return (
                          <button key={size.id} type="button" className={`mini ${selected ? 'on' : ''}`} aria-pressed={selected} onClick={() => setPickSize(size.name)}>
                            {selected && <Check className="w-3 h-3" />}
                            {size.name}
                          </button>
                        )
                      })}
                    </div>
                    <div className="text-[11px] text-slate-300">Renk</div>
                    <div className="flex flex-wrap gap-1.5">
                      {colors.length === 0 && <span className="hint">Renk kartından renk ekle.</span>}
                      {colors.map((color) => {
                        const selected = pickColor === color.name
                        return (
                          <button key={color.id} type="button" className={`mini ${selected ? 'on' : ''}`} aria-pressed={selected} onClick={() => setPickColor(color.name)}>
                            <span className="dot" style={{ background: color.hex || '#64748b' }} />
                            {selected && <Check className="w-3 h-3" />}
                            {color.name}
                          </button>
                        )
                      })}
                    </div>
                    {(pickSize || pickColor) && (
                      <p className="text-[11px] font-bold text-purple-200">Seçili: {pickSize || 'beden yok'} · {pickColor || 'renk yok'}</p>
                    )}
                    <button type="button" className="mini add" onClick={() => addVariantRow()}>
                      <Plus className="w-3 h-3" /> Bu çifti ekle
                    </button>
                    {variantRows.length === 0 ? (
                      <p className="hint">Henüz satır yok. Beden ve renk seçip ekle.</p>
                    ) : variantRows.map((row, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input className="text-center" value={row.size} onChange={(e) => setVariantRows(variantRows.map((item, i) => i === index ? { ...item, size: e.target.value } : item))} placeholder="Beden" />
                        <input className="text-center" value={row.color} onChange={(e) => setVariantRows(variantRows.map((item, i) => i === index ? { ...item, color: e.target.value } : item))} placeholder="Renk" />
                        <input className="text-center font-mono text-emerald-400" type="text" inputMode="decimal" value={row.stock} onChange={(e) => setVariantRows(variantRows.map((item, i) => i === index ? { ...item, stock: e.target.value } : item))} placeholder="Stok" />
                        <button type="button" className="close-x" onClick={() => setVariantRows(variantRows.filter((_, i) => i !== index))} aria-label="Satırı sil">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!form.hasVariants && (
                <div className="p-3 rounded-xl border border-slate-700 bg-slate-800/60 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-300">Stok adedi</span>
                  <p className="text-[11px] text-slate-400">Kart açılırken eldeki adet buraya yazılır. Sonraki mal girişi alış faturasıyla gelir.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" inputMode="decimal" placeholder="Adet (Örn: 20)" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} />
                    <input type="text" inputMode="decimal" placeholder="Birim maliyet ₺" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
                  </div>
                </div>
              )}

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-700 bg-slate-800/80 cursor-pointer">
                <input type="checkbox" className="mt-1 w-4 h-4" checked={form.pinShortcut} onChange={(e) => setForm({ ...form, pinShortcut: e.target.checked })} />
                <span>
                  <span className="text-xs font-semibold text-amber-300 inline-flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Hızlı Satış (POS) Ekranında Kısayol Tuşu Olarak Göster
                  </span>
                  <span className="block text-[11px] text-slate-400 mt-0.5">Kasiyer ekranında barkodsuz veya tek tıkla sepete eklenmesi gereken ürünler için (Örn: Ekmek, Su, Poşet).</span>
                </span>
              </label>

              {error && <p className="error">{error}</p>}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" className="cancel" onClick={() => { setShowModal(false); setEditingId(null) }}>İptal</button>
                <button type="submit" className="save">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
