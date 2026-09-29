import { Fragment, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { CASHIER_DEFAULTS, PERMISSIONS, allPermissions } from '../permissions'

const GROUPS = [...new Set(PERMISSIONS.map((item) => item.group))]

const emptyForm = () => ({ username: '', displayName: '', password: '', role: 'Kasiyer', permissions: { ...CASHIER_DEFAULTS } })

export default function UsersPage() {
  const { session } = useAuth()
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [openId, setOpenId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [passwordFor, setPasswordFor] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  async function load() {
    const list = await api('/api/users', { token: session.token })
    setUsers(list)
    return list
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [session.token])

  function roleName(role) {
    return role === 'Admin' ? 'Yönetici' : 'Kasiyer'
  }

  function openCount(user) {
    if (user.role === 'Admin') return PERMISSIONS.length
    return PERMISSIONS.filter((item) => user.permissions?.[item.key] === true).length
  }

  function toggleRow(user) {
    if (openId === user.id) {
      setOpenId(null)
      setDraft(null)
      return
    }
    setOpenId(user.id)
    setDraft({ ...user, permissions: { ...(user.permissions || {}) } })
    setError('')
    setMessage('')
  }

  async function persist(next) {
    setDraft(next)
    setSaving(true)
    setError('')
    try {
      const saved = await api(`/api/users/${next.id}/permissions`, {
        method: 'PUT',
        token: session.token,
        body: { role: next.role, permissions: next.permissions }
      })
      const fresh = { ...saved, permissions: { ...(saved.permissions || {}) } }
      setUsers((list) => list.map((user) => (user.id === fresh.id ? fresh : user)))
      setDraft(fresh)
      setMessage('Özellik kaydedildi. Kullanıcı yeniden girince menü güncellenir.')
    } catch (err) {
      setError(err.message)
      const list = await load().catch(() => null)
      const current = list?.find((user) => user.id === next.id)
      if (current) setDraft({ ...current, permissions: { ...(current.permissions || {}) } })
    } finally {
      setSaving(false)
    }
  }

  function setRole(role) {
    if (!draft || saving) return
    const permissions = role === 'Admin' ? allPermissions(true) : { ...CASHIER_DEFAULTS }
    persist({ ...draft, role, permissions })
  }

  function setFeature(key, on) {
    if (!draft || draft.role === 'Admin' || saving) return
    persist({ ...draft, permissions: { ...draft.permissions, [key]: on } })
  }

  async function createUser(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      await api('/api/users', { method: 'POST', token: session.token, body: form })
      setForm(emptyForm())
      setCreating(false)
      setMessage('Kullanıcı açıldı.')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggleActive(user) {
    setError('')
    try {
      const saved = await api(`/api/users/${user.id}/toggle`, { method: 'POST', token: session.token })
      setUsers((list) => list.map((row) => (row.id === saved.id ? { ...row, ...saved, permissions: saved.permissions || row.permissions } : row)))
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(user) {
    if (!window.confirm(`${user.displayName} silinsin mi?`)) return
    setError('')
    try {
      await api(`/api/users/${user.id}`, { method: 'DELETE', token: session.token })
      if (openId === user.id) {
        setOpenId(null)
        setDraft(null)
      }
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
      <div className="panel flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="mb-1">Kullanıcılar</h1>
          <p className="muted">Listeyi aç, özelliğin yanındaki tiki işaretle. Yönetici her özelliğe açıktır.</p>
        </div>
        <button type="button" className="primary" onClick={() => { setForm(emptyForm()); setCreating(true); setError('') }}>Yeni kullanıcı</button>
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <section className="panel overflow-x-auto">
        {users.length === 0 ? <p className="muted">Henüz kullanıcı yok.</p> : (
          <table>
            <thead>
              <tr>
                <th>Ad</th>
                <th>Kullanıcı</th>
                <th>Rol</th>
                <th>Özellik</th>
                <th>Durum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const open = openId === user.id
                return (
                  <Fragment key={user.id}>
                    <tr className={open ? 'bg-slate-950/80' : ''}>
                      <td>
                        <button type="button" className="ghost !bg-transparent !border-0 !px-0 font-bold text-white inline-flex items-center gap-1" onClick={() => toggleRow(user)}>
                          {open ? <ChevronDown className="w-4 h-4 text-emerald-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                          {user.displayName}
                        </button>
                      </td>
                      <td className="font-mono text-slate-300">{user.username}</td>
                      <td>{roleName(user.role)}</td>
                      <td className="text-slate-300">{openCount(user)} / {PERMISSIONS.length}</td>
                      <td>
                        <span className={`pill ${user.isActive ? 'ok' : ''}`}>{user.isActive ? 'Aktif' : 'Kapalı'}</span>
                      </td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-1">
                          <button type="button" className="row-edit" onClick={() => { setPasswordFor(user); setNewPassword('') }}>Şifre</button>
                          <button type="button" className="row-edit" onClick={() => toggleActive(user)}>{user.isActive ? 'Kapat' : 'Aç'}</button>
                          <button type="button" className="danger" onClick={() => remove(user)}>Sil</button>
                        </div>
                      </td>
                    </tr>
                    {open && draft?.id === user.id && (
                      <tr>
                        <td colSpan={6} className="!py-3 bg-slate-950/40">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                            <div className="text-xs text-slate-400">Özelliğin yanındaki tik o hakkı açar veya kapatır.</div>
                            <label className="w-full sm:w-48">
                              Rol
                              <select value={draft.role} disabled={saving} onChange={(e) => setRole(e.target.value)}>
                                <option value="Kasiyer">Kasiyer</option>
                                <option value="Admin">Yönetici</option>
                              </select>
                            </label>
                          </div>
                          <PermissionList
                            value={draft.role === 'Admin' ? allPermissions(true) : draft.permissions}
                            disabled={draft.role === 'Admin' || saving}
                            onToggle={setFeature}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {creating && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form className="panel w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-3" onSubmit={createUser}>
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
                <select value={form.role} onChange={(e) => {
                  const role = e.target.value
                  setForm({ ...form, role, permissions: role === 'Admin' ? allPermissions(true) : { ...CASHIER_DEFAULTS } })
                }}>
                  <option value="Kasiyer">Kasiyer</option>
                  <option value="Admin">Yönetici</option>
                </select>
              </label>
            </div>
            {form.role === 'Admin' ? (
              <p className="hint">Yönetici bütün özelliklere açıktır.</p>
            ) : (
              <PermissionList
                value={form.permissions}
                onToggle={(key, on) => setForm({ ...form, permissions: { ...form.permissions, [key]: on } })}
              />
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="ghost" onClick={() => setCreating(false)}>Vazgeç</button>
              <button className="primary" type="submit">Kaydet</button>
            </div>
          </form>
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
              <button type="button" className="ghost" onClick={() => setPasswordFor(null)}>Vazgeç</button>
              <button className="primary" type="submit">Kaydet</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function PermissionList({ value, disabled, onToggle }) {
  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden">
      {GROUPS.map((group) => (
        <div key={group}>
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-950">{group}</div>
          {PERMISSIONS.filter((item) => item.group === group).map((item) => (
            <label key={item.key} className={`flex items-center gap-3 px-3 py-2.5 border-t border-slate-800 ${disabled ? 'opacity-70' : 'cursor-pointer hover:bg-slate-800/50'}`}>
              <input
                type="checkbox"
                className="w-4 h-4 accent-emerald-500 shrink-0"
                checked={value?.[item.key] === true}
                disabled={disabled}
                onChange={(e) => onToggle(item.key, e.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{item.title}</span>
                <span className="block text-[11px] text-slate-400">{item.hint}</span>
              </span>
            </label>
          ))}
        </div>
      ))}
    </div>
  )
}
