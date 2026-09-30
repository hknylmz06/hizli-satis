import { useState } from 'react'
import { Cpu, SlidersHorizontal, Store } from 'lucide-react'
import FiscalPairingPage from './FiscalPairingPage'
import OtherSettingsPage from './OtherSettingsPage'
import CompanyProfilePage from './CompanyProfilePage'

const NAV = [
  { id: 'fiscal', title: 'Yazarkasa', hint: 'ÖKC eşleşme ve cihaz', icon: Cpu },
  { id: 'company', title: 'Firma Tanımı', hint: 'Fiş başı ve fiş sonu', icon: Store },
  { id: 'extra', title: 'Diğer Ayarlar', hint: 'Satış davranışı', icon: SlidersHorizontal }
]

export default function SettingsPage() {
  const [tab, setTab] = useState('fiscal')

  return (
    <div className="p-4 lg:p-6">
      <h1>Sistem Ayarları</h1>
      <p className="muted mb-4">Soldan ayarı seç. Sağdaki alan değişir.</p>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">
        <nav className="panel def-side lg:sticky lg:top-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1 mb-2">Ayar kartları</div>
          {NAV.map((item) => {
            const Icon = item.icon
            const on = tab === item.id
            return (
              <button key={item.id} type="button" className={`nav ${on ? 'on' : ''}`} onClick={() => setTab(item.id)}>
                <Icon className="w-4 h-4 shrink-0" />
                <span>
                  <span className="block font-bold">{item.title}</span>
                  <span className="sub">{item.hint}</span>
                </span>
              </button>
            )
          })}
        </nav>
        <section>
          {tab === 'fiscal' ? <FiscalPairingPage embedded /> : tab === 'company' ? <CompanyProfilePage embedded /> : <OtherSettingsPage embedded />}
        </section>
      </div>
    </div>
  )
}
