import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

const emptyLine = { productId: '', variantId: '', quantity: '', unitCost: '' }

export default function PurchaseInvoicesPage() {
  const { session } = useAuth()
  const [products, setProducts] = useState([])
  const [invoices, setInvoices] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [supplierName, setSupplierName] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [purchasedAt, setPurchasedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [line, setLine] = useState(emptyLine)
  const [productQuery, setProductQuery] = useState('')
  const [lines, setLines] = useState([])
  const [paymentKind, setPaymentKind] = useState('debt')
  const [accountId, setAccountId] = useState('')
  const [accounts, setAccounts] = useState([])
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const quantityRef = useRef(null)

  async function load() {
    const token = session.token
    const [productList, invoiceList, supplierList, accountList] = await Promise.all([
      api('/api/products', { token }),
      api('/api/purchases', { token }),
      api('/api/suppliers', { token }).catch(() => []),
      api('/api/accounts', { token }).catch(() => [])
    ])
    setProducts(productList)
    setInvoices(invoiceList)
    setSuppliers(supplierList)
    const rows = Array.isArray(accountList) ? accountList : []
    setAccounts(rows)
    setAccountId((current) => current || rows[0]?.id || '')
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [])

  const query = productQuery.trim().toLowerCase()
  const filteredProducts = products.filter((product) => {
    if (!query) return true
    return product.name.toLowerCase().includes(query) || (product.barcode || '').toLowerCase().includes(query)
  })
  const selected = products.find((p) => String(p.id) === String(line.productId))
  const variants = selected?.variants || []

  function pickProduct(product) {
    setLine({
      ...emptyLine,
      productId: String(product.id),
      unitCost: product.purchasePrice ?? ''
    })
    setError('')
  }

  function matchBarcode(value) {
    const term = value.trim().toLowerCase()
    if (!term) return null
    return products.find((product) => (product.barcode || '').trim().toLowerCase() === term) || null
  }

  function searchProduct(value) {
    setProductQuery(value)
    const exact = matchBarcode(value)
    if (exact) pickProduct(exact)
  }

  function onBarcodeKey(event) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const exact = matchBarcode(productQuery)
    if (!exact) {
      setError('Bu barkod stokta yok.')
      return
    }
    pickProduct(exact)
    quantityRef.current?.focus()
  }

  function addLine(e) {
    e.preventDefault()
    setError('')
    if (!selected) return
    if (variants.length > 0 && !line.variantId) {
      setError('Beden ve renk seç.')
      return
    }
    if (!(Number(line.quantity) > 0)) {
      setError('Miktar gir.')
      return
    }
    const variant = variants.find((v) => String(v.id) === String(line.variantId))
    const name = variant
      ? `${selected.name} · ${[variant.sizeName, variant.colorName].filter(Boolean).join(' ')}`
      : selected.name
    setLines((prev) => [...prev, {
      productId: selected.id,
      variantId: variant?.id || null,
      name,
      quantity: Number(line.quantity),
      unitCost: Number(line.unitCost)
    }])
    setLine(emptyLine)
  }

  async function save(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      const saved = await api('/api/purchases', {
        method: 'POST',
        token: session.token,
        body: {
          supplierName,
          invoiceNo,
          purchasedAt: purchasedAt ? new Date(purchasedAt).toISOString() : null,
          lines: lines.map((row) => ({
            productId: row.productId,
            variantId: row.variantId,
            quantity: row.quantity,
            unitCost: row.unitCost
          })),
          paymentKind,
          accountId: paymentKind === 'cash' ? accountId : null
        }
      })
      setMessage(`${saved.invoiceNo} kaydedildi. ${Number(saved.total).toFixed(2)} ₺`)
      setLines([])
      setSupplierName('')
      setInvoiceNo('')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const total = lines.reduce((sum, row) => sum + row.quantity * row.unitCost, 0)

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <h1>Alış faturası</h1>
      <p className="muted">Yeni mal girişi buradan. Satış maliyeti ilk giren ilk çıkar: önce eski parti biter, sonra bu faturanın fiyatı kullanılır.</p>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <form className="panel space-y-3" onSubmit={save}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label>Tedarikçi
            <input list="supplier-names" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Kayıtlı tedarikçi veya yeni ad" />
            <datalist id="supplier-names">
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.name} />)}
            </datalist>
          </label>
          <label>Fatura no<input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Boşsa otomatik" /></label>
          <label>Tarih<input type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} /></label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label>Ödeme
            <select value={paymentKind} onChange={(e) => setPaymentKind(e.target.value)}>
              <option value="debt">Tedarikçiye borç kaydet</option>
              <option value="cash">Kasadan öde</option>
            </select>
          </label>
          {paymentKind === 'cash' && (
            <label>Kasa
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                <option value="">Kasa seç</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name} · bakiye ₺{Number(account.balance || 0).toFixed(2)}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
          <label>Barkod veya ad
            <input value={productQuery} onChange={(e) => searchProduct(e.target.value)} onKeyDown={onBarcodeKey} placeholder="Barkod okut veya ad yaz" autoComplete="off" />
          </label>
          <label className="sm:col-span-2">Ürün
            <select value={line.productId} onChange={(e) => {
              const product = products.find((item) => String(item.id) === e.target.value)
              if (product) pickProduct(product)
              else setLine(emptyLine)
            }}>
              <option value="">Seç</option>
              {filteredProducts.map((p) => <option key={p.id} value={String(p.id)}>{p.name}{p.barcode ? ` · ${p.barcode}` : ''}</option>)}
            </select>
          </label>
          {variants.length > 0 && (
            <label>Beden / renk
              <select value={line.variantId} onChange={(e) => setLine({ ...line, variantId: e.target.value })}>
                <option value="">Seç</option>
                {variants.map((v) => (
                  <option key={v.id} value={String(v.id)}>{[v.sizeName, v.colorName].filter(Boolean).join(' · ')}</option>
                ))}
              </select>
            </label>
          )}
          <label>Miktar<input ref={quantityRef} type="number" step="any" min="0" value={line.quantity} onChange={(e) => setLine({ ...line, quantity: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }} /></label>
          <label>Alış ₺<input type="number" step="0.01" min="0" value={line.unitCost} onChange={(e) => setLine({ ...line, unitCost: e.target.value })} /></label>
          <button type="button" className="primary" onClick={addLine}>Satır ekle</button>
        </div>

        {lines.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Ürün</th><th>Miktar</th><th>Alış</th><th>Tutar</th><th></th></tr></thead>
              <tbody>
                {lines.map((row, index) => (
                  <tr key={`${row.productId}-${index}`}>
                    <td>{row.name}</td>
                    <td>{row.quantity}</td>
                    <td>{row.unitCost.toFixed(2)} ₺</td>
                    <td>{(row.quantity * row.unitCost).toFixed(2)} ₺</td>
                    <td><button type="button" className="danger" onClick={() => setLines(lines.filter((_, i) => i !== index))}>Sil</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-sm font-bold text-emerald-300">Toplam {total.toFixed(2)} ₺</p>
          </div>
        )}
        <button type="submit" className="primary" disabled={lines.length === 0}>Faturayı kaydet</button>
      </form>

      <section className="panel">
        <h2>Son alışlar</h2>
        {invoices.length === 0 ? <p className="muted mt-2">Henüz alış faturası yok.</p> : (
          <div className="table-wrap mt-3">
            <table>
              <thead><tr><th>Tarih</th><th>Fatura</th><th>Tedarikçi</th><th>Adet</th><th>Tutar</th><th>Ödeme</th><th></th></tr></thead>
              <tbody>
                {invoices.map((invoice) => {
                  const qty = (invoice.lines || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0)
                  return (
                    <tr key={invoice.id}>
                      <td>{new Date(invoice.purchasedAt).toLocaleDateString('tr-TR')}</td>
                      <td className="font-mono">{invoice.invoiceNo}</td>
                      <td>{invoice.supplierName || '-'}</td>
                      <td className="font-mono">{qty}</td>
                      <td className="font-mono">{Number(invoice.total).toFixed(2)} ₺</td>
                      <td>{invoice.paymentKind === 'cash' ? 'Kasadan' : invoice.paymentKind === 'debt' ? 'Borç' : '-'}</td>
                      <td><button type="button" className="ghost" onClick={() => setDetail(invoice)}>Detay</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="panel w-full max-w-2xl stack">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2>Fatura {detail.invoiceNo}</h2>
                <p className="muted">{detail.supplierName || 'Tedarikçi yok'} · {new Date(detail.purchasedAt).toLocaleDateString('tr-TR')} · {detail.paymentKind === 'cash' ? 'Kasadan ödendi' : detail.paymentKind === 'debt' ? 'Tedarikçiye borç' : 'Ödeme yok'}</p>
              </div>
              <button type="button" className="ghost" onClick={() => setDetail(null)}>Kapat</button>
            </div>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th>Adet</th>
                    <th>Fiyat</th>
                    <th>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.lines || []).map((row, index) => (
                    <tr key={`${row.productName}-${index}`}>
                      <td>{row.productName}</td>
                      <td className="font-mono">{row.quantity}</td>
                      <td className="font-mono">{Number(row.unitCost).toFixed(2)} ₺</td>
                      <td className="font-mono">{Number(row.lineTotal ?? row.quantity * row.unitCost).toFixed(2)} ₺</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm font-bold text-emerald-300">Toplam {Number(detail.total).toFixed(2)} ₺</p>
          </div>
        </div>
      )}
    </div>
  )
}
