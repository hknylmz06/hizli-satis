import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

export default function QuickSalePage() {
  const { session } = useAuth()
  const [barcode, setBarcode] = useState('')
  const [cart, setCart] = useState([])
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Nakit')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [fiscal, setFiscal] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    api('/api/customers', { token: session.token }).then(setCustomers).catch(() => {})
    api('/api/fiscal/settings', { token: session.token })
      .then(setFiscal)
      .catch(() => setFiscal(null))
    inputRef.current?.focus()
  }, [])

  async function addByBarcode(e) {
    e.preventDefault()
    if (!barcode.trim()) return
    setError('')
    try {
      const product = await api(`/api/products/by-barcode/${encodeURIComponent(barcode.trim())}`, {
        token: session.token
      })
      setCart((prev) => {
        const existing = prev.find((x) => x.productId === product.id)
        if (existing) {
          return prev.map((x) =>
            x.productId === product.id ? { ...x, quantity: x.quantity + 1 } : x
          )
        }
        return [...prev, {
          productId: product.id,
          name: product.name,
          unitPrice: product.salePrice,
          vatRate: product.vatRate ?? 20,
          quantity: 1
        }]
      })
      setBarcode('')
      inputRef.current?.focus()
    } catch (err) {
      setError(err.message)
    }
  }

  function setQty(productId, quantity) {
    const q = Number(quantity)
    if (q <= 0) {
      setCart((prev) => prev.filter((x) => x.productId !== productId))
      return
    }
    setCart((prev) => prev.map((x) => (x.productId === productId ? { ...x, quantity: q } : x)))
  }

  const total = cart.reduce((sum, x) => sum + x.unitPrice * x.quantity, 0)

  async function printFiscalReceipt(saleResult, cartSnapshot, payMethod) {
    if (!fiscal?.isEnabled || !fiscal?.isPaired || !fiscal?.deviceHost) {
      return { skipped: true }
    }

    const agentBase = (fiscal.agentBaseUrl || 'http://127.0.0.1:5055').replace(/\/$/, '')
    try {
      const health = await fetch(`${agentBase}/health`)
      if (!health.ok) throw new Error('Yerel ajan kapalı')
    } catch {
      return { ok: false, message: 'Satış kaydedildi ama ajan kapalı — fiş basılmadı. Ajanı açıp tekrar deneyin.' }
    }

    const res = await fetch(`${agentBase}/sale/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceHost: fiscal.deviceHost,
        devicePort: fiscal.devicePort || 4443,
        serialNo: fiscal.serialNo || null,
        softwareId: fiscal.softwareId || null,
        hardwareId: fiscal.hardwareId || null,
        paymentMethod: payMethod,
        grandTotal: saleResult.grandTotal,
        referenceCode: saleResult.receiptNo,
        items: cartSnapshot.map((x) => ({
          name: x.name,
          quantity: x.quantity,
          unitPrice: x.unitPrice,
          vatRate: x.vatRate ?? 20
        }))
      })
    })
    const data = await res.json()
    return data
  }

  async function checkout() {
    setError('')
    setMessage('')
    setBusy(true)
    const cartSnapshot = [...cart]
    const payMethod = paymentMethod
    try {
      const result = await api('/api/sales', {
        method: 'POST',
        token: session.token,
        body: {
          items: cartSnapshot.map((x) => ({ productId: x.productId, quantity: x.quantity })),
          paymentMethod: payMethod,
          customerId: payMethod === 'Veresiye' ? customerId || null : null
        }
      })

      setCart([])
      setBarcode('')

      let msg = `Satış tamam: ${result.receiptNo} — ${result.grandTotal.toFixed(2)} ₺`
      const fiscalResult = await printFiscalReceipt(result, cartSnapshot, payMethod)
      if (fiscalResult?.skipped) {
        // yazarkasa kapalı / eşleşmemiş
      } else if (fiscalResult?.ok) {
        msg += fiscalResult.receiptNo
          ? ` | Yazarkasa fiş: ${fiscalResult.receiptNo}`
          : ' | Yazarkasa fiş basıldı'
      } else if (fiscalResult?.message) {
        setError(fiscalResult.message)
        if (fiscalResult.raw) console.warn('Hugin raw:', fiscalResult.raw)
      }

      setMessage(msg)
      inputRef.current?.focus()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sale-layout">
      <section>
        <h1>Hızlı Satış</h1>
        {fiscal?.isPaired ? (
          <p className="success">Yazarkasa eşli — satışta fiş basılır</p>
        ) : (
          <p className="hint">Yazarkasa eşli değil. Fiş için Yazarkasa menüsünden eşleştirin.</p>
        )}
        <form className="barcode-row" onSubmit={addByBarcode}>
          <input
            ref={inputRef}
            placeholder="Barkod okutun veya yazın"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
          />
          <button className="primary" type="submit">Ekle</button>
        </form>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Fiyat</th>
                <th>Adet</th>
                <th>Tutar</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr key={item.productId}>
                  <td>{item.name}</td>
                  <td>{item.unitPrice.toFixed(2)} ₺</td>
                  <td>
                    <input
                      className="qty"
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => setQty(item.productId, e.target.value)}
                    />
                  </td>
                  <td>{(item.unitPrice * item.quantity).toFixed(2)} ₺</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="checkout">
        <p className="total-label">Toplam</p>
        <p className="total-value">{total.toFixed(2)} ₺</p>

        <div className="pay-methods">
          {['Nakit', 'KrediKarti', 'Veresiye'].map((m) => (
            <button
              key={m}
              type="button"
              className={paymentMethod === m ? 'active' : ''}
              onClick={() => setPaymentMethod(m)}
            >
              {m === 'KrediKarti' ? 'Kart' : m}
            </button>
          ))}
        </div>

        {paymentMethod === 'Veresiye' && (
          <label>
            Cari
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="">Seçin</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.balance.toFixed(2)} ₺)</option>
              ))}
            </select>
          </label>
        )}

        <button className="primary wide" disabled={!cart.length || busy} onClick={checkout}>
          {busy ? 'İşleniyor...' : 'Satışı Tamamla'}
        </button>
        <p className="hint">Demo barkodlar: 8690000000011, 8690000000028</p>
      </aside>
    </div>
  )
}
