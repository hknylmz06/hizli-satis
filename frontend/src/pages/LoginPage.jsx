import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'

export default function LoginPage() {
  const { login, session } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('admin')
  const [firmaKodu, setFirmaKodu] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (session?.role === 'PlatformAdmin') navigate('/admin')
    else if (session?.role === 'TenantUser') navigate('/app')
  }, [session, navigate])

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const path = mode === 'admin' ? '/api/auth/platform-login' : '/api/auth/tenant-login'
      const body = mode === 'admin'
        ? { username, password }
        : { firmaKodu, username, password }
      const data = await api(path, { method: 'POST', body })
      login({
        token: data.token,
        role: data.role,
        displayName: data.displayName,
        firmaKodu: data.firmaKodu,
        firmaName: data.firmaName
      })
      navigate(data.role === 'PlatformAdmin' ? '/admin' : '/app')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-panel">
        <p className="brand">Hızlı Satış</p>
        <h1>Giriş</h1>
        <p className="muted">Firma kodu ile satışa geçin veya platform yönetimine bağlanın.</p>

        <div className="mode-switch">
          <button type="button" className={mode === 'tenant' ? 'active' : ''} onClick={() => setMode('tenant')}>
            Firma
          </button>
          <button type="button" className={mode === 'admin' ? 'active' : ''} onClick={() => setMode('admin')}>
            Platform Admin
          </button>
        </div>

        <form onSubmit={submit} className="stack">
          {mode === 'tenant' && (
            <label>
              Firma Kodu
              <input value={firmaKodu} onChange={(e) => setFirmaKodu(e.target.value.toUpperCase())} required />
            </label>
          )}
          <label>
            Kullanıcı Adı
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label>
            Şifre
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={loading}>{loading ? 'Giriş...' : 'Giriş Yap'}</button>
        </form>

        <p className="hint">
          {mode === 'admin'
            ? 'Platform: admin / Admin123!  (önce “Platform Admin” seçili olmalı)'
            : 'Firma girişi için admin panelden aldığın firma kodu + kullanıcı + şifre gerekir'}
        </p>
      </div>
      <div className="login-visual" aria-hidden="true" />
    </div>
  )
}
