import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

export default function CustomersPage() {
  const { session } = useAuth()
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ name: '', phone: '', note: '' })
  const [payAmount, setPayAmount] = useState({})
  const [error, setError] = useState('')

  async function load() {
    setItems(await api('/api/customers', { token: session.token }))
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [])

  async function create(e) {
    e.preventDefault()
    await api('/api/customers', { method: 'POST', token: session.token, body: form })
    setForm({ name: '', phone: '', note: '' })
    await load()
  }

  async function pay(id) {
    const amount = Number(payAmount[id] || 0)
    if (amount <= 0) return
    try {
      await api(`/api/customers/${id}/payments`, {
        method: 'POST',
        token: session.token,
        body: { amount, note: 'Tahsilat' }
      })
      setPayAmount({ ...payAmount, [id]: '' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h1>Cari / Veresiye</h1>
      {error && <p className="error">{error}</p>}
      <div className="split">
        <form className="stack panel" onSubmit={create}>
          <h2>Yeni Cari</h2>
          <label>
            Ad
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Telefon
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>
            Not
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
          <button className="primary" type="submit">Ekle</button>
        </form>

        <div className="table-wrap panel">
          <table>
            <thead>
              <tr>
                <th>Cari</th>
                <th>Telefon</th>
                <th>Bakiye</th>
                <th>Ödeme Al</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.phone || '-'}</td>
                  <td>{c.balance.toFixed(2)} ₺</td>
                  <td className="inline-pay">
                    <input
                      type="number"
                      step="0.01"
                      value={payAmount[c.id] || ''}
                      onChange={(e) => setPayAmount({ ...payAmount, [c.id]: e.target.value })}
                    />
                    <button type="button" onClick={() => pay(c.id)}>Al</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
