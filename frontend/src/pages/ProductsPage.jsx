import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

const empty = {
  name: '',
  barcode: '',
  purchasePrice: 0,
  salePrice: 0,
  vatRate: 20,
  stockQuantity: 0,
  criticalStockLevel: 5
}

export default function ProductsPage() {
  const { session } = useAuth()
  const [items, setItems] = useState([])
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')

  async function load() {
    setItems(await api('/api/products', { token: session.token }))
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [])

  async function save(e) {
    e.preventDefault()
    setError('')
    try {
      await api('/api/products', {
        method: 'POST',
        token: session.token,
        body: {
          ...form,
          purchasePrice: Number(form.purchasePrice),
          salePrice: Number(form.salePrice),
          vatRate: Number(form.vatRate),
          stockQuantity: Number(form.stockQuantity),
          criticalStockLevel: Number(form.criticalStockLevel)
        }
      })
      setForm(empty)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h1>Stok Yönetimi</h1>
      <div className="split">
        <form className="stack panel" onSubmit={save}>
          <h2>Yeni Ürün</h2>
          {['name', 'barcode'].map((key) => (
            <label key={key}>
              {key === 'name' ? 'Ürün Adı' : 'Barkod'}
              <input
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                required={key === 'name'}
              />
            </label>
          ))}
          {[
            ['purchasePrice', 'Alış'],
            ['salePrice', 'Satış'],
            ['vatRate', 'KDV %'],
            ['stockQuantity', 'Stok'],
            ['criticalStockLevel', 'Kritik Stok']
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                step="0.01"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">Kaydet</button>
        </form>

        <div className="table-wrap panel">
          <table>
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Barkod</th>
                <th>Satış</th>
                <th>Stok</th>
                <th>KDV</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className={p.stockQuantity <= p.criticalStockLevel ? 'warn' : ''}>
                  <td>{p.name}</td>
                  <td>{p.barcode || '-'}</td>
                  <td>{p.salePrice.toFixed(2)} ₺</td>
                  <td>{p.stockQuantity}</td>
                  <td>%{p.vatRate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
