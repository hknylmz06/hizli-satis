import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Lock, User, AlertCircle, ArrowRight, ShieldCheck, Building2 } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import DatabaseServerPanel from './DatabaseServerPanel'

export default function LoginPage() {
  const { login, session } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('tenant')
  const [firmaKodu, setFirmaKodu] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSql, setShowSql] = useState(false)

  useEffect(() => {
    const notice = sessionStorage.getItem('hizlisatis_auth_notice')
    if (notice) {
      sessionStorage.removeItem('hizlisatis_auth_notice')
      setError(notice)
    }
  }, [])

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
      const body = mode === 'admin' ? { username, password } : { firmaKodu, username, password }
      const data = await api(path, { method: 'POST', body })
      login({
        token: data.token,
        role: data.role,
        displayName: data.displayName,
        firmaKodu: data.firmaKodu,
        firmaName: data.firmaName,
        tenantRole: data.tenantRole,
        permissions: data.permissions
      })
      navigate(data.role === 'PlatformAdmin' ? '/admin' : '/app')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-auto">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 items-center justify-center shadow-xl ring-4 ring-emerald-500/20">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Hızlı Satış POS</h1>
            <p className="text-xs text-slate-400 mt-1">Barkodlu satış ve yazarkasa</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button type="button" onClick={() => setMode('tenant')} className={`py-2 rounded-xl text-sm font-bold ${mode === 'tenant' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Firma</button>
          <button type="button" onClick={() => setMode('admin')} className={`py-2 rounded-xl text-sm font-bold ${mode === 'admin' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Platform</button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode === 'tenant' && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Firma Kodu</label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input value={firmaKodu} onChange={(e) => setFirmaKodu(e.target.value.toUpperCase())} className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500" required />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Kullanıcı Adı</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500" required />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Şifre</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500" required />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
            <span>{loading ? 'Giriş Yapılıyor...' : 'Sisteme Giriş Yap'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800 text-[11px] text-slate-400 space-y-1 bg-slate-950/40 p-3 rounded-xl">
          <div className="flex items-center gap-1 text-slate-300 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Platform yöneticisi</span>
          </div>
          <div className="font-mono text-emerald-400">admin / Admin123!</div>
        </div>

        <button type="button" onClick={() => setShowSql((v) => !v)} className="mt-4 text-xs text-slate-500 hover:text-slate-300">
          {showSql ? 'SQL ayarını gizle' : 'SQL Server ayarı (yerel)'}
        </button>
        {showSql && (
          <div className="mt-3 legacy-page">
            <DatabaseServerPanel />
          </div>
        )}
      </div>
    </div>
  )
}
