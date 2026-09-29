import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  ShoppingCart, FileText, TrendingUp, FolderTree, DollarSign, Landmark,
  Settings, LogOut, LayoutDashboard, Users, UserCog, Truck, Headphones, Menu, X, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useAuth } from '../auth'
import { allows } from '../permissions'
import { ThemeToggle } from '../theme'

const sections = [
  {
    title: 'MENÜ',
    items: [
      { to: '/app', end: true, label: 'Gösterge Paneli', icon: LayoutDashboard },
      { to: '/app/pos', label: 'Hızlı Satış (POS)', icon: ShoppingCart, hotkey: 'F2', perm: 'can_access_pos' },
      { to: '/app/customers', label: 'Müşteriler (Cari)', icon: Users, perm: 'can_access_definitions' },
      { to: '/app/suppliers', label: 'Tedarikçiler', icon: Truck, perm: 'can_access_definitions' },
      { to: '/app/products', label: 'Tanımlamalar', icon: FolderTree, perm: 'can_access_definitions' }
    ]
  },
  {
    title: 'RAPORLAMA & FİNANS',
    items: [
      { to: '/app/invoices', label: 'Faturalar', icon: FileText, perm: 'can_access_invoices' },
      { to: '/app/reports', label: 'Raporlar & Analiz', icon: TrendingUp, perm: 'can_access_reports' },
      { to: '/app/expenses', label: 'Gelir & Gider', icon: DollarSign, perm: 'can_access_definitions' },
      { to: '/app/accounts', label: 'Kasa & Bankalar', icon: Landmark, perm: 'can_access_definitions' }
    ]
  },
  {
    title: 'YÖNETİM',
    items: [
      { to: '/app/users', label: 'Kullanıcılar', icon: UserCog, perm: 'can_manage_users' },
      { to: '/app/fiscal', label: 'Sistem Ayarları', icon: Settings, perm: 'can_access_settings' },
      { to: '/app/support', label: 'Destek & İletişim', icon: Headphones }
    ]
  }
]

export default function Sidebar() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const [time, setTime] = useState(new Date().toLocaleTimeString('tr-TR'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString('tr-TR')), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'F2' && allows(session, 'can_access_pos')) {
        e.preventDefault()
        navigate('/app/pos')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, session])

  return (
    <>
      <div className="lg:hidden bg-slate-950 border-b border-slate-800 p-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-sm text-white">HIZLI SATIŞ POS</span>
        </div>
        <button type="button" onClick={() => setMobileOpen((v) => !v)} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {mobileOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed lg:static top-0 left-0 bottom-0 z-50 ${collapsed ? 'w-[4.75rem]' : 'w-64'} bg-slate-950 border-r border-slate-800 text-slate-200 flex flex-col transition-all ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`border-b border-slate-800 flex items-center ${collapsed ? 'flex-col gap-2 px-2 py-3' : 'justify-between gap-2 p-4'}`}>
          <div className={`flex items-center min-w-0 ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 shrink-0 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 flex items-center justify-center ring-2 ring-indigo-400/30">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="font-black text-sm text-white tracking-wide truncate">HIZLI SATIŞ</h1>
                <p className="text-[10px] font-semibold tracking-widest text-indigo-400 uppercase truncate">Barkod sistemi</p>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setCollapsed((v) => !v)} title={collapsed ? 'Menüyü aç' : 'Menüyü kapat'} className="hidden lg:flex p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {sections.map((section) => {
            const items = section.items.filter((item) => !item.perm || allows(session, item.perm))
            if (!items.length) return null
            return (
            <div key={section.title}>
              {!collapsed && <p className="px-2 mb-1 text-[10px] font-bold tracking-widest text-slate-500">{section.title}</p>}
              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMobileOpen(false)}
                      title={item.label}
                      className={({ isActive }) =>
                        `flex items-center rounded-xl text-sm font-semibold transition ${
                          collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2'
                        } ${
                          isActive
                            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow'
                            : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                        }`
                      }
                    >
                      <Icon className={`${collapsed ? 'w-5 h-5' : 'w-4 h-4'} shrink-0`} />
                      {!collapsed && (
                        <>
                          <span className="truncate flex-1">{item.label}</span>
                          {item.hotkey && <span className="text-[10px] font-mono opacity-70">{item.hotkey}</span>}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
            )
          })}
        </nav>
        <div className="p-3 border-t border-slate-800 space-y-2">
          {!collapsed && (
            <div className="px-2 text-[11px] text-slate-400">
              <div className="font-bold text-slate-200 truncate">{session.firmaName || session.displayName}</div>
              <div className="font-mono">{time}</div>
            </div>
          )}
          <ThemeToggle
            labeled={!collapsed}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-slate-900 border border-slate-800 text-slate-200"
          />
          <button
            type="button"
            onClick={() => { logout(); navigate('/') }}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            <LogOut className={`${collapsed ? 'w-5 h-5' : 'w-4 h-4'}`} />
            {!collapsed && <span>Çıkış</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
