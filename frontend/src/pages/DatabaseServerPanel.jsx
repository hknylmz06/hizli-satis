import { useEffect, useState } from 'react'
import { api } from '../api'

const empty = {
  server: 'localhost\\SQL',
  port: 1433,
  masterDatabase: 'HizliSatisMaster',
  user: '',
  password: ''
}

export default function DatabaseServerPanel({ token }) {
  const [form, setForm] = useState(empty)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try {
      const data = await api('/api/setup/database', { token })
      setStatus(data)
      setForm({
        server: data.server || 'localhost\\SQL',
        port: data.port || 1433,
        masterDatabase: data.masterDatabase || 'HizliSatisMaster',
        user: data.user || '',
        password: ''
      })
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function payload() {
    return {
      server: form.server.trim(),
      port: Number(form.port) || 1433,
      masterDatabase: form.masterDatabase.trim() || 'HizliSatisMaster',
      user: form.user.trim(),
      password: form.password
    }
  }

  async function test() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const data = await api('/api/setup/database/test', {
        method: 'POST',
        token,
        body: payload()
      })
      if (data.ok) setMessage(data.message)
      else setError(data.message || 'Bağlantı kurulamadı')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const data = await api('/api/setup/database', {
        method: 'PUT',
        token,
        body: payload()
      })
      setMessage(data.message || 'Kaydedildi')
      if (data.settings) setStatus(data.settings)
      setForm((prev) => ({ ...prev, password: '' }))
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack panel" onSubmit={save}>
      <div className="status-row">
        <h2 style={{ margin: 0 }}>SQL Server</h2>
        <span className={`pill ${status?.connected ? 'ok' : 'warn'}`}>
          {status == null ? '...' : status.connected ? 'Bağlı' : 'Bağlı değil'}
        </span>
      </div>
      <p className="muted">
        Şimdi bu PC’de örnek: <code>localhost\SQL</code>. Uzak masaüstüne geçince buraya o makinenin IP’sini veya <code>IP\SQL</code> yazıp kaydet.
        Kullanıcı boşsa Windows oturumu kullanılır. SQL kullanıcısı (ör. sa) yazarsan şifre gerekir.
      </p>
      <label>
        Sunucu
        <input
          value={form.server}
          onChange={(e) => setForm({ ...form, server: e.target.value })}
          placeholder="localhost\SQL veya uzak masaüstü IP"
          required
        />
      </label>
      <label>
        Port
        <input
          type="number"
          value={form.port}
          onChange={(e) => setForm({ ...form, port: e.target.value })}
          min="1"
          max="65535"
        />
      </label>
      <label>
        Ana veritabanı
        <input
          value={form.masterDatabase}
          onChange={(e) => setForm({ ...form, masterDatabase: e.target.value })}
          required
        />
      </label>
      <label>
        SQL kullanıcısı (boş = Windows)
        <input
          value={form.user}
          onChange={(e) => setForm({ ...form, user: e.target.value })}
          placeholder="sa"
          autoComplete="off"
        />
      </label>
      <label>
        Şifre {status?.hasPassword ? '(kayıtlı — değiştirmek için yaz)' : ''}
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder={status?.hasPassword ? '••••••••' : ''}
          autoComplete="new-password"
        />
      </label>
      {status?.message && !message && !error && <p className="muted">{status.message}</p>}
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
      <div className="action-row">
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Bekleyin...' : 'Kaydet'}
        </button>
        <button type="button" onClick={test} disabled={busy}>
          Bağlantıyı dene
        </button>
      </div>
    </form>
  )
}
