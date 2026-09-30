import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

function money(value) {
  return `₺${Number(value || 0).toFixed(2)}`
}

function todayInput() {
  const date = new Date()
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function daysAgoInput(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function isoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDay(value) {
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function monthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function resolveKar(preset, customFrom, customTo) {
  const now = new Date()
  const today = isoDate(now)
  let kpiFrom = today
  let kpiTo = today
  if (preset === 'week') {
    const start = new Date(now)
    const weekday = start.getDay()
    start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1))
    kpiFrom = isoDate(start)
    kpiTo = today
  } else if (preset === 'month') {
    kpiFrom = isoDate(monthStart(now))
    kpiTo = today
  } else if (preset === 'year') {
    kpiFrom = `${now.getFullYear()}-01-01`
    kpiTo = today
  } else if (preset === 'custom') {
    kpiFrom = customFrom || today
    kpiTo = customTo || today
    if (kpiTo < kpiFrom) {
      const swap = kpiFrom
      kpiFrom = kpiTo
      kpiTo = swap
    }
  }
  if (preset === 'year') {
    return { kpiFrom, kpiTo, fetchFrom: `${now.getFullYear()}-01-01`, fetchTo: `${now.getFullYear()}-12-31`, mode: 'month' }
  }
  const fetchFrom = isoDate(monthStart(parseDay(kpiFrom)))
  const fetchTo = isoDate(monthEnd(parseDay(kpiTo)))
  const span = (parseDay(fetchTo) - parseDay(fetchFrom)) / 86400000
  return { kpiFrom, kpiTo, fetchFrom, fetchTo, mode: span > 62 ? 'month' : 'day' }
}

function karRows(pack) {
  const days = pack.data?.kar?.days || []
  if (pack.mode === 'month') {
    const rows = []
    const end = parseDay(pack.fetchTo)
    for (let cursor = monthStart(parseDay(pack.fetchFrom)); cursor <= end; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
      const key = isoDate(cursor).slice(0, 7)
      const monthDays = days.filter((day) => String(day.date).slice(0, 7) === key)
      const revenue = monthDays.reduce((sum, day) => sum + Number(day.revenue || 0), 0)
      const cost = monthDays.reduce((sum, day) => sum + Number(day.cost || 0), 0)
      rows.push({
        key,
        label: cursor.toLocaleDateString('tr-TR', { month: 'short' }).replace('.', ''),
        title: cursor.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
        count: monthDays.reduce((sum, day) => sum + Number(day.count || 0), 0),
        revenue,
        cost,
        profit: revenue - cost,
        inRange: key >= pack.kpiFrom.slice(0, 7) && key <= pack.kpiTo.slice(0, 7)
      })
    }
    return rows
  }
  const byDay = new Map(days.map((day) => [String(day.date).slice(0, 10), day]))
  const rows = []
  const end = parseDay(pack.fetchTo)
  for (let cursor = parseDay(pack.fetchFrom); cursor <= end; cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)) {
    const key = isoDate(cursor)
    const day = byDay.get(key)
    rows.push({
      key,
      label: String(cursor.getDate()),
      title: cursor.toLocaleDateString('tr-TR'),
      count: Number(day?.count || 0),
      revenue: Number(day?.revenue || 0),
      cost: Number(day?.cost || 0),
      profit: Number(day?.profit || 0),
      inRange: key >= pack.kpiFrom && key <= pack.kpiTo
    })
  }
  return rows
}

function activeRange(from, to) {
  const today = todayInput()
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const year = `${now.getFullYear()}-01-01`
  if (from === today && to === today) return 'today'
  if (from === daysAgoInput(1) && to === daysAgoInput(1)) return 'yesterday'
  if (from === daysAgoInput(6) && to === today) return 'week'
  if (from === month && to === today) return 'month'
  if (from === year && to === today) return 'year'
  return ''
}

function DateBar({ from, to, onFrom, onTo, onApply }) {
  const active = activeRange(from, to)
  const presets = [
    ['today', 'Bugün', () => { const day = todayInput(); return [day, day] }],
    ['yesterday', 'Dün', () => { const day = daysAgoInput(1); return [day, day] }],
    ['week', 'Son 7 gün', () => [daysAgoInput(6), todayInput()]],
    ['month', 'Bu ay', () => {
      const now = new Date()
      return [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, todayInput()]
    }],
    ['year', 'Bu yıl', () => [`${new Date().getFullYear()}-01-01`, todayInput()]]
  ]
  return (
    <form className="panel flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); onApply() }}>
      {presets.map(([id, label, range]) => (
        <button
          key={id}
          type="button"
          className={active === id ? `range-on ${id}` : 'ghost'}
          onClick={() => {
            const [start, end] = range()
            onFrom(start)
            onTo(end)
            onApply(start, end)
          }}
        >{label}</button>
      ))}
      <label className="w-40">Başlangıç<input type="date" value={from} onChange={(e) => onFrom(e.target.value)} /></label>
      <label className="w-40">Bitiş<input type="date" value={to} onChange={(e) => onTo(e.target.value)} /></label>
      <button className="primary" type="submit">Getir</button>
    </form>
  )
}

function HourHeatmap({ hours }) {
  const max = Math.max(1, ...hours.map((row) => Number(row.count) || 0))
  const bands = [hours.slice(0, 12), hours.slice(12, 24)]
  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      {bands.map((band) => (
        <div key={band[0]?.hour ?? 'band'} className="grid h-24 grid-cols-12 items-end gap-1.5">
          {band.map((row) => {
            const count = Number(row.count) || 0
            const height = count === 0 ? 8 : Math.max(14, Math.round((count / max) * 100))
            const peak = count > 0 && count === max
            const label = `${String(row.hour).padStart(2, '0')}h`
            return (
              <div key={row.hour} className="group relative flex h-full flex-col items-center justify-end">
                <div className="pointer-events-none absolute bottom-full z-20 mb-1 hidden whitespace-nowrap rounded-lg border border-indigo-500/40 bg-slate-900 px-2 py-1 text-[10px] text-white shadow-xl group-hover:flex group-hover:flex-col group-hover:items-center">
                  <span className="font-bold text-indigo-200">{label}</span>
                  <span>{count} fiş · {money(row.total)}</span>
                </div>
                <div
                  className={`w-full rounded-t-md ${peak ? 'bg-gradient-to-t from-amber-600 to-amber-300 shadow-lg shadow-amber-500/20' : count > 0 ? 'bg-gradient-to-t from-indigo-600 to-indigo-300' : 'bg-slate-800/40'}`}
                  style={{ height: `${height}%` }}
                />
                <span className="mt-1 font-mono text-[9px] font-semibold text-slate-400">{label}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function ProfitColumns({ rows }) {
  const peak = Math.max(0, ...rows.map((row) => Number(row.profit) || 0))
  const max = Math.max(1, ...rows.map((row) => Math.abs(Number(row.profit) || 0)))
  return (
    <div className="flex items-end gap-1 h-52 overflow-x-auto bg-slate-950/60 px-3 pt-8 pb-2 rounded-xl border border-slate-800">
      {rows.map((row) => {
        const profit = Number(row.profit) || 0
        const height = profit === 0 ? 8 : Math.max(12, Math.round((Math.abs(profit) / max) * 100))
        const isPeak = profit > 0 && profit === peak
        const tone = !row.inRange
          ? 'bg-slate-800/70'
          : isPeak
            ? 'bg-gradient-to-t from-amber-600 to-amber-300 shadow-lg shadow-amber-500/30'
            : profit < 0
              ? 'bg-gradient-to-t from-rose-700 to-rose-400'
              : profit > 0
                ? 'bg-gradient-to-t from-indigo-600 to-indigo-300'
                : 'bg-slate-800/40'
        return (
          <div key={row.key} className="relative flex h-full min-w-[22px] flex-1 flex-col items-center justify-end group">
            <div className="pointer-events-none absolute bottom-full z-20 mb-1 hidden group-hover:flex flex-col items-center whitespace-nowrap rounded-lg border border-indigo-500/40 bg-slate-900 px-2 py-1 text-[10px] text-white shadow-xl">
              <span className="font-bold text-indigo-200">{row.title}</span>
              <span>{row.count} fiş · {money(row.revenue)}</span>
              <span className={profit < 0 ? 'text-rose-300' : 'text-emerald-300'}>Kâr {money(profit)}</span>
            </div>
            <div className={`w-full rounded-t-md transition-all ${tone}`} style={{ height: `${height}%` }} />
            <span className={`mt-1 font-mono text-[9px] font-semibold ${row.inRange ? 'text-slate-300' : 'text-slate-600'}`}>{row.label}</span>
          </div>
        )
      })}
    </div>
  )
}

const TABS = [
  { id: 'kasa', title: 'Kasa' },
  { id: 'kar', title: 'Kâr' },
  { id: 'stok', title: 'Stok' },
  { id: 'urun', title: 'Ürün satış' },
  { id: 'kategori', title: 'Kategori' },
  { id: 'saat', title: 'Yoğunluk' }
]

function Bars({ rows, label, value, tone = 'bg-emerald-500' }) {
  const max = Math.max(1, ...rows.map((row) => Number(value(row)) || 0))
  if (rows.length === 0) return <p className="muted">Bu aralıkta kayıt yok.</p>
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const amount = Number(value(row)) || 0
        const width = Math.max(2, Math.round((amount / max) * 100))
        return (
          <div key={label(row)}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-200">{label(row)}</span>
              <span className="font-mono text-slate-300">{money(amount)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className={`h-full ${tone}`} style={{ width: `${width}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ReportsPage() {
  const { session } = useAuth()
  const [from, setFrom] = useState(() => daysAgoInput(6))
  const [to, setTo] = useState(todayInput)
  const [tab, setTab] = useState('kasa')
  const [cashier, setCashier] = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [stockQuery, setStockQuery] = useState('')
  const [stockPack, setStockPack] = useState(null)
  const [stockError, setStockError] = useState('')
  const [productCashier, setProductCashier] = useState('')
  const [productCategory, setProductCategory] = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [karPreset, setKarPreset] = useState('month')
  const [karFrom, setKarFrom] = useState(() => resolveKar('month').kpiFrom)
  const [karTo, setKarTo] = useState(() => resolveKar('month').kpiTo)
  const [karPack, setKarPack] = useState(null)
  const [karError, setKarError] = useState('')

  async function load(start = from, end = to) {
    setError('')
    const data = await api(`/api/reports/overview?from=${start}&to=${end}`, { token: session.token })
    setReport(data)
  }

  async function loadKar(preset = karPreset, start = karFrom, end = karTo) {
    const window = resolveKar(preset, start, end)
    setKarPreset(preset)
    setKarFrom(window.kpiFrom)
    setKarTo(window.kpiTo)
    setKarError('')
    const data = await api(`/api/reports/overview?from=${window.fetchFrom}&to=${window.fetchTo}`, { token: session.token })
    setKarPack({ ...window, data })
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [session.token])

  async function loadStock(filter = stockFilter, query = stockQuery) {
    setStockError('')
    const params = new URLSearchParams({ filter, q: query.trim(), take: '200' })
    const data = await api(`/api/reports/stock?${params}`, { token: session.token })
    setStockPack(data)
  }

  useEffect(() => {
    if (tab !== 'kar') return
    loadKar(karPreset, karFrom, karTo).catch((err) => setKarError(err.message))
  }, [tab, session.token])

  useEffect(() => {
    if (tab !== 'stok') return
    loadStock(stockFilter, stockQuery).catch((err) => setStockError(err.message))
  }, [tab, stockFilter, session.token])

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="panel">
        <h1 className="mb-1">Raporlar</h1>
        <p className="muted">Kasa, kâr, stok ve satış dağılımı.</p>
      </div>

      {error && <p className="error">{error}</p>}
      {!report && !error && <p className="muted">Yükleniyor...</p>}

      {report && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {TABS.map((item) => (
                <button key={item.id} type="button" className={`chip ${tab === item.id ? 'on bg-emerald-600' : ''}`} onClick={() => setTab(item.id)}>
                  {item.title}
                </button>
              ))}
            </div>
          </div>

          {tab === 'kasa' && (() => {
            const people = (report.kasa.cashiers || []).filter((row) => !cashier || row.username === cashier)
            const sum = (key) => people.reduce((total, row) => total + Number(row[key] || 0), 0)
            const revenue = sum('revenue')
            const cost = sum('cost')
            const profit = sum('profit')
            const discount = sum('discount')
            const margin = revenue === 0 ? 0 : (profit / revenue) * 100
            const roleName = (role) => role === 'Admin' || role === 'Yönetici' || role === 'Yonetici' ? 'Yönetici' : role === 'Kasiyer' ? 'Kasiyer' : (role || '-')
            return (
              <div className="space-y-4">
                <DateBar from={from} to={to} onFrom={setFrom} onTo={setTo} onApply={(start, end) => load(start, end).catch((err) => setError(err.message))} />
                <div className="panel flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2>Kasa raporu</h2>
                    <p className="muted">Kasiyer bazlı tahsilat, fiş ve kâr.</p>
                  </div>
                  <label className="w-full sm:w-56">Kasiyer
                    <select value={cashier} onChange={(e) => setCashier(e.target.value)}>
                      <option value="">Tüm kasiyerler</option>
                      {(report.kasa.cashiers || []).map((row) => <option key={row.username} value={row.username}>{row.name}</option>)}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="panel"><span className="block text-xs text-slate-400">Toplam satış cirosu</span><strong className="text-lg text-emerald-300">{money(revenue)}</strong><span className="block text-[11px] text-slate-500">Brüt satış hasılatı</span></div>
                  <div className="panel"><span className="block text-xs text-slate-400">Toplam maliyet</span><strong className="text-lg">{money(cost)}</strong><span className="block text-[11px] text-slate-500">Stok alış maliyeti</span></div>
                  <div className="panel"><span className="block text-xs text-slate-400">Üretilen net kâr</span><strong className="text-lg text-emerald-300">{money(profit)}</strong><span className="block text-[11px] text-slate-500">Kâr marjı %{margin.toFixed(0)}</span></div>
                  <div className="panel"><span className="block text-xs text-slate-400">Uygulanan iskonto</span><strong className="text-lg text-amber-300">{money(discount)}</strong><span className="block text-[11px] text-slate-500">Toplam indirim</span></div>
                  <div className="panel"><span className="block text-xs text-slate-400">Toplam fiş</span><strong className="text-lg">{sum('count')}</strong><span className="block text-[11px] text-slate-500">Tamamlanan satış</span></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="panel"><span className="block text-xs text-slate-400">Dönem mağaza gideri</span><strong className="text-lg">{money(0)}</strong><span className="block text-[11px] text-slate-500">Gider kaydı henüz yok</span></div>
                  <div className="panel"><span className="block text-xs text-slate-400">POS komisyon</span><strong className="text-lg">{money(0)}</strong><span className="block text-[11px] text-slate-500">Kart komisyonu yok</span></div>
                  <div className="panel"><span className="block text-xs text-slate-400">Net faaliyet kârı</span><strong className="text-lg text-emerald-300">{money(profit)}</strong><span className="block text-[11px] text-slate-500">Kâr, gider düşülmeden</span></div>
                </div>
                <section className="panel overflow-x-auto">
                  <h2 className="mb-1">Kasiyer ve personel kasa dökümü</h2>
                  <p className="muted mb-3">Personelin yaptığı tahsilat türleri, fiş sayıları ve ürettikleri kâr.</p>
                  <table>
                    <thead>
                      <tr>
                        <th>Kasiyer</th>
                        <th>Yetki</th>
                        <th>Fiş</th>
                        <th>Nakit</th>
                        <th>Kredi kartı</th>
                        <th>Veresiye</th>
                        <th>Parçalı</th>
                        <th>Toplam ciro</th>
                        <th>Net kâr</th>
                      </tr>
                    </thead>
                    <tbody>
                      {people.length === 0 ? (
                        <tr><td colSpan="9" className="text-slate-500">Seçilen tarih ve filtrede kasa verisi yok.</td></tr>
                      ) : (
                        <>
                          {people.map((row) => (
                            <tr key={row.username}>
                              <td className="font-bold text-white">{row.name}</td>
                              <td>{roleName(row.role)}</td>
                              <td className="font-mono">{row.count}</td>
                              <td className="font-mono">{money(row.cash)}</td>
                              <td className="font-mono">{money(row.card)}</td>
                              <td className="font-mono">{money(row.credit)}</td>
                              <td className="font-mono">{money(row.partial)}</td>
                              <td className="font-mono">{money(row.revenue)}</td>
                              <td className="font-mono text-emerald-300">{money(row.profit)}</td>
                            </tr>
                          ))}
                          <tr>
                            <td className="font-black text-white">Toplam</td>
                            <td></td>
                            <td className="font-mono font-bold">{sum('count')}</td>
                            <td className="font-mono font-bold">{money(sum('cash'))}</td>
                            <td className="font-mono font-bold">{money(sum('card'))}</td>
                            <td className="font-mono font-bold">{money(sum('credit'))}</td>
                            <td className="font-mono font-bold">{money(sum('partial'))}</td>
                            <td className="font-mono font-bold">{money(revenue)}</td>
                            <td className="font-mono font-bold text-emerald-300">{money(profit)}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </section>
              </div>
            )
          })()}

          {tab === 'kar' && (
            <div className="space-y-4">
              <div className="panel flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    ['today', 'Bugün', 'today'],
                    ['week', 'Bu hafta', 'week'],
                    ['month', 'Bu ay', 'month'],
                    ['year', 'Bu yıl', 'year'],
                    ['custom', 'Özel tarih', 'yesterday']
                  ].map(([id, label, tone]) => (
                    <button key={id} type="button" className={karPreset === id ? `range-on ${tone}` : 'ghost'} onClick={() => loadKar(id, karFrom, karTo).catch((err) => setKarError(err.message))}>{label}</button>
                  ))}
                </div>
                <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); loadKar('custom', karFrom, karTo).catch((err) => setKarError(err.message)) }}>
                  <label className="w-40">Başlangıç<input type="date" value={karFrom} onChange={(e) => { setKarPreset('custom'); setKarFrom(e.target.value) }} /></label>
                  <label className="w-40">Bitiş<input type="date" value={karTo} onChange={(e) => { setKarPreset('custom'); setKarTo(e.target.value) }} /></label>
                  <button className="primary" type="submit">Getir</button>
                </form>
              </div>
              {karError && <p className="error">{karError}</p>}
              {!karPack && !karError && <p className="muted">Kâr raporu yükleniyor...</p>}
              {karPack && (() => {
                const rows = karRows(karPack)
                const picked = rows.filter((row) => row.inRange)
                const revenue = picked.reduce((sum, row) => sum + row.revenue, 0)
                const cost = picked.reduce((sum, row) => sum + row.cost, 0)
                const profit = picked.reduce((sum, row) => sum + row.profit, 0)
                const count = picked.reduce((sum, row) => sum + row.count, 0)
                const margin = revenue === 0 ? 0 : (profit / revenue) * 100
                const periodTitle = karPack.mode === 'month'
                  ? `${parseDay(karPack.fetchFrom).getFullYear()} ayları`
                  : parseDay(karPack.fetchFrom).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
                return (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                      <div className="panel"><span className="block text-xs text-slate-400">Ciro</span><strong className="text-lg text-white">{money(revenue)}</strong><span className="block text-[11px] text-slate-500">{count} fiş</span></div>
                      <div className="panel"><span className="block text-xs text-slate-400">Maliyet</span><strong className="text-lg text-amber-300">{money(cost)}</strong></div>
                      <div className="panel"><span className="block text-xs text-slate-400">Net kâr</span><strong className="text-lg text-emerald-300">{money(profit)}</strong><span className="block text-[11px] text-slate-500">Marj %{margin.toFixed(0)}</span></div>
                      <div className="panel"><span className="block text-xs text-slate-400">Filtre</span><strong className="text-sm text-white">{parseDay(karPack.kpiFrom).toLocaleDateString('tr-TR')} – {parseDay(karPack.kpiTo).toLocaleDateString('tr-TR')}</strong></div>
                      <div className="panel"><span className="block text-xs text-slate-400">Grafik dönemi</span><strong className="text-sm capitalize text-indigo-200">{periodTitle}</strong><span className="block text-[11px] text-slate-500">Seçilen tarihin ayı</span></div>
                    </div>
                    <section className="panel space-y-3">
                      <div>
                        <h2>Kâr grafiği</h2>
                        <p className="muted">Turuncu sütun dönemin en yüksek kârı. Mavi sütunlar diğer günler. Soluk sütunlar filtrenin dışında, ayın geri kalanı.</p>
                      </div>
                      {rows.length === 0 ? <p className="muted">Bu ayda kayıt yok.</p> : <ProfitColumns rows={rows} />}
                    </section>
                    <section className="panel overflow-x-auto">
                      <h2 className="mb-3">{periodTitle}</h2>
                      <table>
                        <thead><tr><th>{karPack.mode === 'month' ? 'Ay' : 'Gün'}</th><th>Fiş</th><th>Ciro</th><th>Maliyet</th><th>Kâr</th></tr></thead>
                        <tbody>
                          {rows.length === 0 ? (
                            <tr><td colSpan="5" className="text-slate-500">Bu dönemde kâr verisi yok.</td></tr>
                          ) : rows.map((row) => (
                            <tr key={row.key} className={row.inRange ? '' : 'opacity-45'}>
                              <td>{row.title}</td>
                              <td className="font-mono">{row.count}</td>
                              <td className="font-mono">{money(row.revenue)}</td>
                              <td className="font-mono">{money(row.cost)}</td>
                              <td className={`font-mono ${row.profit < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{money(row.profit)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  </>
                )
              })()}
            </div>
          )}

          {tab === 'stok' && (() => {
            const items = stockPack?.items || []
            const shown = Number(stockPack?.shown || items.length)
            const matchCount = Number(stockPack?.matchCount || 0)
            return (
              <div className="space-y-4">
                <div className="panel flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <span className="block text-xs text-slate-400">Toplam stok değeri</span>
                    <strong className="text-2xl text-amber-300">{money(stockPack?.matchValue ?? report.stok.stockValue)}</strong>
                    <span className="block text-[11px] text-slate-500">{matchCount} ürün{shown < matchCount ? ` · listede ilk ${shown}` : ''}</span>
                  </div>
                  <div className="flex flex-wrap items-end gap-1.5">
                    {[
                      ['all', 'Tümü'],
                      ['in', 'Stoktakiler'],
                      ['out', 'Stok kalmayan'],
                      ['critical', 'Kritik stok']
                    ].map(([id, label]) => (
                      <button key={id} type="button" className={stockFilter === id ? 'primary' : 'ghost'} onClick={() => setStockFilter(id)}>{label}</button>
                    ))}
                    <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); loadStock(stockFilter, stockQuery).catch((err) => setStockError(err.message)) }}>
                      <input value={stockQuery} onChange={(e) => setStockQuery(e.target.value)} placeholder="Ürün veya barkod" className="w-44" />
                      <button className="primary" type="submit">Ara</button>
                    </form>
                  </div>
                </div>
                {stockError && <p className="error">{stockError}</p>}
                {!stockPack && !stockError && <p className="muted">Stok yükleniyor...</p>}
                <section className="panel overflow-x-auto">
                  <table>
                    <thead><tr><th>Ürün</th><th>Kategori</th><th>Durum</th><th>Stok</th><th>Kritik</th><th>Alış</th><th>Satış</th><th>Değer</th></tr></thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr><td colSpan="8" className="text-slate-500">Bu filtrede ürün yok.</td></tr>
                      ) : items.map((row) => (
                        <tr key={`${row.name}-${row.barcode || ''}`}>
                          <td>
                            <div className="font-bold text-white">{row.name}</div>
                            {row.barcode && <div className="text-[11px] font-mono text-slate-400">{row.barcode}</div>}
                          </td>
                          <td>{row.category}</td>
                          <td className={Number(row.stock) <= 0 ? 'text-rose-300' : row.low ? 'text-amber-300' : 'text-emerald-300'}>
                            {Number(row.stock) <= 0 ? 'Stok yok' : row.low ? 'Kritik' : 'Stokta'}
                          </td>
                          <td className={`font-mono ${row.low ? 'text-amber-300' : ''}`}>{row.stock}</td>
                          <td className="font-mono">{row.critical}</td>
                          <td className="font-mono">{money(row.purchasePrice)}</td>
                          <td className="font-mono">{money(row.salePrice)}</td>
                          <td className="font-mono">{money(row.stockValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </div>
            )
          })()}

          {tab === 'urun' && (() => {
            const needle = productQuery.trim().toLocaleLowerCase('tr')
            const rows = (report.products || []).map((row) => {
              const parts = (row.cashiers || []).filter((part) => !productCashier || part.username === productCashier)
              if (productCashier && parts.length === 0) return null
              const quantity = productCashier ? parts.reduce((sum, part) => sum + Number(part.quantity || 0), 0) : Number(row.quantity || 0)
              const revenue = productCashier ? parts.reduce((sum, part) => sum + Number(part.revenue || 0), 0) : Number(row.revenue || 0)
              const cost = productCashier ? parts.reduce((sum, part) => sum + Number(part.cost || 0), 0) : Number(row.cost || 0)
              const profit = revenue - cost
              return {
                ...row,
                quantity,
                revenue,
                cost,
                profit,
                margin: revenue === 0 ? 0 : Math.round((profit / revenue) * 100)
              }
            }).filter((row) => row && (!productCategory || row.category === productCategory) && (!needle || `${row.name} ${row.barcode || ''}`.toLocaleLowerCase('tr').includes(needle)))
            const categories = [...new Set((report.products || []).map((row) => row.category).filter(Boolean))]
            return (
              <div className="space-y-4">
                <DateBar from={from} to={to} onFrom={setFrom} onTo={setTo} onApply={(start, end) => load(start, end).catch((err) => setError(err.message))} />
                <div className="panel flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                  <div>
                    <h2>Ürün bazlı satış</h2>
                    <p className="muted">Satılan adet, maliyet ve net kâr. {rows.length} ürün.</p>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="w-40">Kasiyer
                      <select value={productCashier} onChange={(e) => setProductCashier(e.target.value)}>
                        <option value="">Tüm kasiyerler</option>
                        {(report.kasa.cashiers || []).map((row) => <option key={row.username} value={row.username}>{row.name}</option>)}
                      </select>
                    </label>
                    <label className="w-40">Kategori
                      <select value={productCategory} onChange={(e) => setProductCategory(e.target.value)}>
                        <option value="">Tüm kategoriler</option>
                        {categories.map((name) => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </label>
                    <label className="w-52">Ara
                      <input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Ürün veya barkod" />
                    </label>
                  </div>
                </div>
                <section className="panel overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Ürün adı ve barkod</th>
                        <th>Kategori</th>
                        <th>Satılan miktar</th>
                        <th>Satış hasılatı</th>
                        <th>Maliyet</th>
                        <th>Net kâr</th>
                        <th>Kâr marjı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr><td colSpan="8" className="text-slate-500">Seçilen tarih ve filtrede ürün satışı yok.</td></tr>
                      ) : rows.map((row, index) => (
                        <tr key={`${row.name}-${row.barcode || index}`}>
                          <td className="font-mono text-slate-500">{index + 1}</td>
                          <td>
                            <div className="font-bold text-white">{row.name}</div>
                            {row.barcode && <div className="text-[11px] font-mono text-slate-400">{row.barcode}</div>}
                          </td>
                          <td>{row.category || 'Genel'}</td>
                          <td className="font-mono">{row.quantity} {row.unit || 'Adet'}</td>
                          <td className="font-mono">{money(row.revenue)}</td>
                          <td className="font-mono text-amber-300">{money(row.cost)}</td>
                          <td className={`font-mono ${row.profit < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{money(row.profit)}</td>
                          <td><span className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${row.margin < 0 ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300'}`}>%{row.margin}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </div>
            )
          })()}

          {tab === 'kategori' && (
            <div className="space-y-4">
              <DateBar from={from} to={to} onFrom={setFrom} onTo={setTo} onApply={(start, end) => load(start, end).catch((err) => setError(err.message))} />
              <section className="panel space-y-3">
                <h2>En çok satan 10 kategori</h2>
                <Bars rows={(report.categories || []).slice(0, 10)} label={(row) => `${row.name} · ${row.quantity}`} value={(row) => row.revenue} tone="bg-violet-400" />
              </section>
              <section className="panel overflow-x-auto">
                <table>
                  <thead><tr><th>Kategori</th><th>Adet</th><th>Ciro</th><th>Maliyet</th><th>Kâr</th></tr></thead>
                  <tbody>
                    {(report.categories || []).length === 0 ? (
                      <tr><td colSpan="5" className="text-slate-500">Bu aralıkta satış yok.</td></tr>
                    ) : report.categories.map((row) => (
                      <tr key={row.name}>
                        <td>{row.name}</td>
                        <td className="font-mono">{row.quantity}</td>
                        <td className="font-mono">{money(row.revenue)}</td>
                        <td className="font-mono">{money(row.cost)}</td>
                        <td className="font-mono text-emerald-300">{money(row.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          )}

          {tab === 'saat' && (() => {
            const hours = report.hours || []
            const days = (report.kar?.days || []).filter((day) => Number(day.count) > 0)
            const categories = report.categories || []
            const categoryTotal = categories.reduce((sum, row) => sum + Number(row.revenue || 0), 0) || 1
            return (
              <div className="space-y-4">
                <DateBar from={from} to={to} onFrom={setFrom} onTo={setTo} onApply={(start, end) => load(start, end).catch((err) => setError(err.message))} />
                <section className="panel space-y-3">
                  <h2>Kasa saatlik yoğunluk haritası (00:00 – 23:00)</h2>
                  <p className="muted">Gün içinde hangi saatlerde yoğunluk olduğunu ve ne kadar ciro çıktığını gösterir. Turuncu sütun en yoğun saat.</p>
                  <HourHeatmap hours={hours} />
                </section>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <section className="panel overflow-x-auto">
                    <h2 className="mb-3">Günlük ciro ve net kâr</h2>
                    <table>
                      <thead><tr><th>Tarih</th><th>Fiş</th><th>Günlük ciro</th><th>Net kâr</th></tr></thead>
                      <tbody>
                        {days.length === 0 ? (
                          <tr><td colSpan="4" className="text-slate-500">Bu aralıkta satış yok.</td></tr>
                        ) : days.map((day) => (
                          <tr key={day.date}>
                            <td className="font-mono">{parseDay(day.date).toLocaleDateString('tr-TR')}</td>
                            <td className="font-mono">{day.count} fiş</td>
                            <td className="font-mono">{money(day.revenue)}</td>
                            <td className="font-mono text-emerald-300">{money(day.profit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                  <section className="panel space-y-3">
                    <h2>Kategori satış payı</h2>
                    {categories.length === 0 ? <p className="muted">Bu aralıkta kategori satışı yok.</p> : categories.map((row) => {
                      const share = Math.round((Number(row.revenue || 0) / categoryTotal) * 100)
                      return (
                        <div key={row.name}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="text-slate-200">{row.name}</span>
                            <span className="font-mono text-slate-300">{money(row.revenue)} · %{share}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                            <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-400" style={{ width: `${Math.max(share, 2)}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </section>
                </div>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
