import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { CASHIER_DEFAULTS, PERMISSIONS, allPermissions } from '../permissions'

const GROUPS = [...new Set(PERMISSIONS.map((item) => item.group))]

export default function UsersPage() {
  const { session } = useAuth()
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ username: '', displayName: '', password: '', role: 'Kasiyer', permissions: { ...CASHIER_DEFAULTS } })
  const [editing, setEditing] = useState(null)
  const [passwordFor, setPasswordFor] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  async function load() {
    const list = await api('/api/users', { token: session.token })
    setUsers(list)
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [session.token])

  function setRole(role) {
    setForm((prev) => ({
      ...prev,
      role,
      permissions: role === 'Admin' ? allPermissions(true) : { ...CASHIER_DEFAULTS }
    }))
  }

  async function createUser(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      await api('/api/users', {
        method: 'POST',
        token: session.token,
        body: form
      })
      setForm({ username: '', displayName: '', password: '', role: 'Kasiyer', permissions: { ...CASHIER_DEFAULTS } })
      setMessage('Kullanıcı açıldı.')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function savePermissions() {
    if (!editing) return
    setError('')
    setMessage('')
    try {
      await api(`/api/users/${editing.id}/permissions`, {
        method: 'PUT',
        token: session.token,
        body: { role: editing.role, permissions: editing.permissions }
      })
      setEditing(null)
      setMessage('Yetkiler kaydedildi. Kullanıcı yeniden girince menü güncellenir.')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggle(user) {
    setError('')
    try {
      await api(`/api/users/${user.id}/toggle`, { method: 'POST', token: session.token })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(user) {
    if (!window.confirm(`${user.displayName} silinsin mi?`)) return
    setError('')
    try {
      await api(`/api/users/${user.id}`, { method: 'DELETE', token: session.token })
      if (editing?.id === user.id) setEditing(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function resetPassword(e) {
    e.preventDefault()
    setError('')
    try {
      await api(`/api/users/${passwordFor.id}/reset-password`, {
        method: 'POST',
        token: session.token,
        body: { newPassword }
      })
      setPasswordFor(null)
      setNewPassword('')
      setMessage('Şifre güncellendi.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <h1>Kullanıcılar</h1>
      <p className="muted">Personel aç, kasiyere sayfa ve kasa yetkisi ver. Yönetici her şeye yetkilidir.</p>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <form className="panel stack" onSubmit={createUser}>
        <h2>Yeni kullanıcı</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label>
            Kullanıcı adı
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required placeholder="kasiyer1" />
          </label>
          <label>
            Ad soyad
            <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required placeholder="Ayşe Yılmaz" />
          </label>
          <label>
            Şifre
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={4} placeholder="En az 4 karakter" />
          </label>
          <label>
            Rol
            <select value={form.role} onChange={(e) => setRole(e.target.value)}>
              <option value="Kasiyer">Kasiyer</option>
              <option value="Admin">Yönetici</option>
            </select>
          </label>
        </div>
        {form.role === 'Admin' ? (
          <p className="hint">Yönetici satış, tanımlar, rapor, ayar ve kullanıcı ekranlarının hepsini açar.</p>
        ) : (
          <PermissionGrid value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} />
        )}
        <button className="primary" type="submit">Kullanıcıyı kaydet</button>
      </form>

      <div className="panel space-y-3">
        <h2>Kayıtlı kullanıcılar</h2>
        {users.length === 0 ? <p className="muted">Henüz kullanıcı yok.</p> : users.map((user) => (
          <div key={user.id} className="border border-slate-800 rounded-2xl p-3 bg-slate-950/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-bold text-white">{user.displayName}</div>
                <div className="text-xs text-slate-400 font-mono">{user.username} · {user.role === 'Admin' ? 'Yönetici' : 'Kasiyer'} · {user.isActive ? 'Aktif' : 'Kapalı'}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="row-edit" onClick={() => setEditing({ ...user, permissions: { ...user.permissions } })}>Yetkiler</button>
                <button type="button" className="row-edit" onClick={() => { setPasswordFor(user); setNewPassword('') }}>Şifre</button>
                <button type="button" className="row-edit" onClick={() => toggle(user)}>{user.isActive ? 'Kapat' : 'Aç'}</button>
                <button type="button" className="danger" onClick={() => remove(user)}>Sil</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="panel w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-3">
            <h2>{editing.displayName} yetkileri</h2>
            <label>
              Rol
              <select value={editing.role} onChange={(e) => setEditing({
                ...editing,
                role: e.target.value,
                permissions: e.target.value === 'Admin' ? allPermissions(true) : { ...CASHIER_DEFAULTS, ...editing.permissions }
              })}>
                <option value="Kasiyer">Kasiyer</option>
                <option value="Admin">Yönetici</option>
              </select>
            </label>
            {editing.role === 'Admin' ? (
              <p className="hint">Yöneticide tüm izinler açıktır.</p>
            ) : (
              <PermissionGrid value={editing.permissions} onChange={(permissions) => setEditing({ ...editing, permissions })} />
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)}>Vazgeç</button>
              <button type="button" className="primary" onClick={savePermissions}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {passwordFor && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form className="panel w-full max-w-sm stack" onSubmit={resetPassword}>
            <h2>{passwordFor.displayName} şifresi</h2>
            <label>
              Yeni şifre
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={4} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPasswordFor(null)}>Vazgeç</button>
              <button className="primary" type="submit">Kaydet</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function PermissionGrid({ value, onChange }) {
  return (
    <div className="space-y-3">
      {GROUPS.map((group) => (
        <div key={group}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">{group}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PERMISSIONS.filter((item) => item.group === group).map((item) => (
              <label key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 cursor-pointer">
                <span>
                  <span className="block text-xs font-bold text-white">{item.title}</span>
                  <span className="block text-[11px] text-slate-400">{item.hint}</span>
                </span>
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={value[item.key] === true}
                  onChange={(e) => onChange({ ...value, [item.key]: e.target.checked })}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
