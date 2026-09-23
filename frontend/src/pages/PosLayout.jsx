import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function PosLayout() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="pos-shell">
      <aside className="sidebar">
        <p className="brand">Hızlı Satış</p>
        <p className="firma">{session.firmaName}</p>
        <p className="muted">Kod: {session.firmaKodu}</p>
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
