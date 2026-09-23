import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'

export default function AdminPage() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const [tenants, setTenants] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', contactEmail: '', contactPhone: '', provisionNow: true })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const data = await api('/api/admin/tenants', { token: session.token })
    setTenants(data)
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [])

  async function createTenant(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      const created = await api('/api/admin/tenants', {
        method: 'POST',
        token: session.token,
        body: form
      })
      setMessage(`Kurulum tamam: ${created.firmaKodu} / ${created.initialUsername} / ${created.initialPasswordPlain}`)
      setForm({ name: '', contactEmail: '', contactPhone: '', provisionNow: true })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function openTenant(id) {
    const data = await api(`/api/admin/tenants/${id}`, { token: session.token })
    setSelected(data)
  }

  async function reprovision(id) {
    const data = await api(`/api/admin/tenants/${id}/provision`, {
      method: 'POST',
      token: session.token
    })
    setMessage(`Yeniden kuruldu: ${data.firmaKodu}`)
    await load()
    await openTenant(id)
  }

  return (
    <div className="admin-shell">
      <header className="topbar">
        <div>
          <p className="brand">Hızlı Satış</p>
          <strong>Platform Yönetimi</strong>
        </div>
        <div className="topbar-actions">
          <span>{session.displayName}</span>
          <button onClick={() => { logout(); navigate('/') }}>Çıkış</button>
        </div>
      </header>

      <div className="admin-grid">
        <section>
          <h2>Yeni Firma</h2>
          <form className="stack" onSubmit={createTenant}>
            <label>
              Firma Adı
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              E-posta
              <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} required />
            </label>
            <label>
              Telefon (SMS)
              <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={form.provisionNow} onChange={(e) => setForm({ ...form, provisionNow: e.target.checked })} />
              Hemen veritabanı kur
            </label>
            <button className="primary" type="submit">Kaydet & Kur</button>
          </form>
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
        </section>

        <section>
          <h2>Firmalar</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Kod</th>
                  <th>Durum</th>
                  <th>DB</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td><code>{t.firmaKodu}</code></td>
                    <td><span className={`status ${t.status?.toLowerCase()}`}>{t.status}</span></td>
                    <td><code>{t.databaseName}</code></td>
                    <td>
                      <button type="button" onClick={() => openTenant(t.id)}>Detay</button>
                      {t.status !== 'Ready' && (
                        <button type="button" onClick={() => reprovision(t.id)}>Yeniden Kur</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {selected && (
          <section className="span-2">
            <h2>{selected.name} — kurulum detayı</h2>
            <div className="detail-grid">
              <p><strong>Firma Kodu:</strong> {selected.firmaKodu}</p>
              <p><strong>Kullanıcı:</strong> {selected.initialUsername}</p>
              <p><strong>Şifre:</strong> {selected.initialPasswordPlain}</p>
              <p><strong>DB:</strong> {selected.databaseName}</p>
            </div>
            <h3>Bildirim logları</h3>
            <ul className="logs">
              {(selected.notifications || []).map((n, i) => (
                <li key={i}>
                  <strong>{n.channel}</strong> → {n.recipient}
                  <pre>{n.body}</pre>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
