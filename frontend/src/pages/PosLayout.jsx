import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { ensureHuginAgent } from '../huginAgent'

export default function PosLayout() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const [agentNote, setAgentNote] = useState('')

  useEffect(() => {
    let cancelled = false
    ensureHuginAgent().then((r) => {
      if (cancelled) return
      if (r.ok) setAgentNote(r.started ? 'Yazarkasa ajanı gizli başlatıldı' : 'Yazarkasa ajanı hazır')
      else setAgentNote(r.message || 'Ajan kapalı')
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="pos-shell">
      <aside className="sidebar">
        <p className="brand">Hızlı Satış</p>
        <p className="firma">{session.firmaName}</p>
        <p className="muted">Kod: {session.firmaKodu}</p>
        {agentNote && <p className="muted" style={{ fontSize: '0.8rem' }}>{agentNote}</p>}
        <nav>
          <NavLink end to="/app">Hızlı Satış</NavLink>
          <NavLink to="/app/products">Stok</NavLink>
          <NavLink to="/app/customers">Cari</NavLink>
          <NavLink to="/app/reports">Rapor</NavLink>
          <NavLink to="/app/fiscal">Yazarkasa</NavLink>
        </nav>
        <button className="ghost" onClick={() => { logout(); navigate('/') }}>Çıkış</button>
      </aside>
      <main className="pos-main">
        <Outlet />
      </main>
    </div>
  )
}
