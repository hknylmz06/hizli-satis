import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { ensureHuginAgent } from '../huginAgent'
import { api } from '../api'
import { useAuth } from '../auth'

export default function PosLayout() {
  const location = useLocation()
  const { session, login } = useAuth()
  const isPos = location.pathname.startsWith('/app/pos')
  const [, setAgentNote] = useState('')

  useEffect(() => {
    if (!session?.token || session.role !== 'TenantUser') return
    let cancel = false
    api('/api/auth/me', { token: session.token }).then((me) => {
      if (cancel) return
      const prev = JSON.parse(localStorage.getItem('hizlisatis_auth') || '{}')
      login({
        ...prev,
        displayName: me.displayName || prev.displayName,
        tenantRole: me.tenantRole,
        permissions: me.permissions
      })
    }).catch(() => {})
    return () => { cancel = true }
  }, [session?.token])

  useEffect(() => {
    ensureHuginAgent().then((r) => {
      setAgentNote(r.ok ? '' : (r.message || ''))
    })
  }, [])

  if (isPos) {
    return (
      <div className="h-screen bg-slate-950 text-slate-100">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-950 legacy-page">
        <Outlet />
      </main>
    </div>
  )
}
