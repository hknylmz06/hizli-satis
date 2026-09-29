import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, FileText, TrendingUp, FolderTree, DollarSign, Landmark,
  Settings, ArrowUpRight, Users, Truck, Headphones
} from 'lucide-react'

const groups = [
  {
    title: 'Temel İşlemler',
    items: [
      { to: '/app/pos', title: 'Hızlı Satış', subtitle: 'Barkodlu POS Ekranı (F2)', icon: ShoppingCart, gradient: 'from-blue-600 via-indigo-600 to-blue-700' },
      { to: '/app/products', title: 'Tanımlamalar', subtitle: 'Stok, kategori, departman, varyant', icon: FolderTree, gradient: 'from-cyan-500 via-teal-500 to-sky-600' },
      { to: '/app/customers', title: 'Müşteriler (Cari)', subtitle: 'Veresiye & Müşteri Takibi', icon: Users, gradient: 'from-emerald-600 via-green-600 to-teal-700' },
      { to: '/app/suppliers', title: 'Tedarikçiler', subtitle: 'Toptancı & Mal Tedariği', icon: Truck, gradient: 'from-amber-500 via-orange-600 to-amber-700' }
    ]
  },
  {
    title: 'Raporlama ve Finans',
    items: [
      { to: '/app/invoices', title: 'Faturalar', subtitle: 'Satış & Alış Geçmişi', icon: FileText, gradient: 'from-purple-600 via-violet-600 to-indigo-700' },
      { to: '/app/reports', title: 'Raporlar & Analiz', subtitle: 'Kâr/Zarar & Ciro Raporu', icon: TrendingUp, gradient: 'from-sky-500 via-blue-600 to-cyan-600' },
      { to: '/app/expenses', title: 'Gelir & Gider', subtitle: 'Kasa Giriş / Çıkış Takibi', icon: DollarSign, gradient: 'from-rose-600 via-red-600 to-pink-700' },
      { to: '/app/accounts', title: 'Kasa & Bankalar', subtitle: 'Banka Hesapları & Kasa Bakiye', icon: Landmark, gradient: 'from-yellow-500 via-amber-500 to-emerald-600' }
    ]
  },
  {
    title: 'Yönetim',
    items: [
      { to: '/app/fiscal', title: 'Sistem Ayarları', subtitle: 'Firma, ÖKC & Yazıcı Ayarları', icon: Settings, gradient: 'from-fuchsia-600 via-pink-600 to-purple-700' },
      { to: '/app/support', title: 'Destek & İletişim', subtitle: 'Müşteri Hizmetleri & Teknik Yardım', icon: Headphones, gradient: 'from-teal-600 via-emerald-600 to-cyan-700' }
    ]
  }
]

export default function DashboardPage() {
  const navigate = useNavigate()
  return (
    <div className="p-6 max-w-[1650px] mx-auto space-y-6">
      <h1 className="text-sm font-semibold text-slate-400">Gösterge Paneli</h1>
      {groups.map((group) => (
        <section key={group.title} className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-300 tracking-wider">{group.title}</h2>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {group.items.map((op) => {
              const Icon = op.icon
              return (
                <button
                  key={op.to}
                  type="button"
                  onClick={() => navigate(op.to)}
                  className={`group relative overflow-hidden rounded-3xl p-6 text-left bg-gradient-to-br ${op.gradient} shadow-xl ring-1 ring-white/10 h-44 flex flex-col justify-between hover:-translate-y-1 transition`}
                >
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white">
                      <Icon className="w-6 h-6" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">{op.title}</h3>
                    <p className="text-xs text-white/80">{op.subtitle}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
