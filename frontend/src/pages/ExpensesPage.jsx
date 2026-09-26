import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

function money(value) {
  return `₺${Number(value || 0).toFixed(2)}`
}

function isoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function rangeFor(preset) {
  const now = new Date()
  const today = isoDate(now)
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'week') {
    const start = new Date(now)
    const weekday = start.getDay()
    start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1))
    return { from: isoDate(start), to: today }
  }
  if (preset === 'year') return { from: `${now.getFullYear()}-01-01`, to: today }
  return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: today }
}

export default function ExpensesPage() {
  const { session } = useAuth()
  const initial = rangeFor('month')
  const [preset, setPreset] = useState('month')
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [type, setType] = useState('')
  const [accountId, setAccountId] = useState('')
  const [q, setQ] = useState('')
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [entryOpen, setEntryOpen] = useState(null)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [form, setForm] = useState({ accountId: '', categoryId: '', amount: '', note: '' })
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'expense' })

  async function load(start = from, end = to, nextType = type, nextAccount = accountId, nextQ = q) {
    setError('')
    const params = new URLSearchParams({ from: start, to: end })
    if (nextType) params.set('type', nextType)
    if (nextAccount) params.set('accountId', nextAccount)
    if (nextQ.trim()) params.set('q', nextQ.trim())
    const [ledger, accountRows, categoryRows] = await Promise.all([
      api(`/api/expenses?${params}`, { token: session.token }),
      api('/api/accounts', { token: session.token }),
      api('/api/expenses/categories', { token: session.token })
    ])
    setData(ledger)
    setAccounts(accountRows)
    setCategories(categoryRows)
    setForm((current) => ({ ...current, accountId: current.accountId || accountRows[0]?.id || '' }))
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [session.token])

  function applyPreset(next) {
    const window = rangeFor(next)
    setPreset(next)
    setFrom(window.from)
    setTo(window.to)
    load(window.from, window.to).catch((err) => setError(err.message))
  }

  async function saveEntry(event) {
    event.preventDefault()
    setError('')
    await api('/api/expenses', {
      method: 'POST',
      token: session.token,
      body: {
        accountId: form.accountId,
        categoryId: form.categoryId || null,
        type: entryOpen,
        amount: Number(form.amount),
        note: form.note
      }
    })
    setNotice(entryOpen === 'income' ? 'Gelir kaydedildi.' : 'Gider kaydedildi.')
    setEntryOpen(null)
    setForm((current) => ({ ...current, amount: '', note: '', categoryId: '' }))
    await load()
  }

  async function saveCategory(event) {
    event.preventDefault()
    await api('/api/expenses/categories', {
      method: 'POST',
      token: session.token,
      body: categoryForm
    })
    setCategoryForm({ name: '', type: 'expense' })
    setNotice('Kategori eklendi.')
    await load()
  }

  const summary = data?.summary || { income: 0, expense: 0, commission: 0, net: 0 }
  const visibleCategories = categories.filter((row) => !entryOpen || row.type === entryOpen)

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="panel flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="mb-1">Gelir ve gider</h1>
          <p className="muted">Satış tahsilatı, kira, fatura ve diğer kasa hareketleri.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ghost" onClick={() => setCategoryOpen(true)}>Kategoriler</button>
          <button type="button" className="primary" onClick={() => { setForm((current) => ({ ...current, categoryId: '' })); setEntryOpen('income') }}>+ Gelir ekle</button>
          <button type="button" className="danger" onClick={() => { setForm((current) => ({ ...current, categoryId: '' })); setEntryOpen('expense') }}>+ Gider ekle</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {notice && <p className="success">{notice}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="panel"><span className="block text-xs text-slate-400">Dönem gelirleri</span><strong className="text-xl text-emerald-300">{money(summary.income)}</strong><span className="block text-[11px] text-slate-500">Satış ve diğer gelirler</span></div>
        <div className="panel"><span className="block text-xs text-slate-400">Mağaza giderleri</span><strong className="text-xl text-rose-300">{money(summary.expense)}</strong><span className="block text-[11px] text-slate-500">Fatura, kira, harcama</span></div>
        <div className="panel"><span className="block text-xs text-slate-400">POS komisyonu</span><strong className="text-xl">{money(summary.commission)}</strong><span className="block text-[11px] text-slate-500">Kart komisyonu</span></div>
        <div className="panel"><span className="block text-xs text-slate-400">Net nakit</span><strong className="text-xl text-emerald-300">{money(summary.net)}</strong><span className="block text-[11px] text-slate-500">Gelir − gider</span></div>
      </div>

      <form className="panel flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); setPreset('custom'); load().catch((err) => setError(err.message)) }}>
        {[
          ['today', 'Bugün'],
          ['week', 'Bu hafta'],
          ['month', 'Bu ay'],
          ['year', 'Bu yıl']
        ].map(([id, label]) => (
          <button key={id} type="button" className={preset === id ? 'primary' : 'ghost'} onClick={() => applyPreset(id)}>{label}</button>
        ))}
        <label className="w-40">Başlangıç<input type="date" value={from} onChange={(e) => { setPreset('custom'); setFrom(e.target.value) }} /></label>
        <label className="w-40">Bitiş<input type="date" value={to} onChange={(e) => { setPreset('custom'); setTo(e.target.value) }} /></label>
        <label className="w-44">İşlem
          <select value={type} onChange={(e) => { setType(e.target.value); load(from, to, e.target.value).catch((err) => setError(err.message)) }}>
            <option value="">Tümü</option>
            <option value="sale">Satış</option>
            <option value="income">Gelir</option>
            <option value="expense">Gider</option>
          </select>
        </label>
        <label className="w-48">Hesap
          <select value={accountId} onChange={(e) => { setAccountId(e.target.value); load(from, to, type, e.target.value).catch((err) => setError(err.message)) }}>
            <option value="">Tüm kasa ve bankalar</option>
            {accounts.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </label>
        <label className="w-52">Ara
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Açıklama veya kategori" />
        </label>
        <button className="primary" type="submit">Getir</button>
      </form>

      <section className="panel overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>İşlem</th>
              <th>Kasa / banka</th>
              <th>Kategori / açıklama</th>
              <th>Brüt</th>
              <th>Komisyon</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).length === 0 ? (
              <tr><td colSpan="7" className="text-slate-500">Bu dönemde hareket yok.</td></tr>
            ) : data.items.map((row, index) => (
              <tr key={`${row.at}-${index}`}>
                <td className="font-mono text-xs">{new Date(row.at).toLocaleString('tr-TR')}</td>
                <td><span className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${row.kind === 'expense' || row.kind === 'payout' ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300'}`}>{row.kindLabel}</span></td>
                <td>{row.accountName}</td>
                <td>{row.category}</td>
                <td className={`font-mono ${row.kind === 'expense' || row.kind === 'payout' ? 'text-rose-300' : 'text-emerald-300'}`}>{row.kind === 'expense' || row.kind === 'payout' ? '-' : '+'}{money(row.gross)}</td>
                <td className="font-mono">{Number(row.commission) ? money(row.commission) : '-'}</td>
                <td className="font-mono">{money(row.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {entryOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={() => setEntryOpen(null)}>
          <form className="panel w-full max-w-md space-y-3" onClick={(event) => event.stopPropagation()} onSubmit={(event) => saveEntry(event).catch((err) => setError(err.message))}>
            <h2>{entryOpen === 'income' ? 'Gelir ekle' : 'Gider ekle'}</h2>
            <label>Hesap
              <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} required>
                {accounts.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </label>
            <label>Kategori
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Seçilmedi</option>
                {visibleCategories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </label>
            <label>Tutar<input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></label>
            <label>Açıklama<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Kira, fatura, personel..." /></label>
            <div className="flex justify-end gap-2">
              <button type="button" className="ghost" onClick={() => setEntryOpen(null)}>Vazgeç</button>
              <button className="primary" type="submit">Kaydet</button>
            </div>
          </form>
        </div>
      )}

      {categoryOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={() => setCategoryOpen(false)}>
          <div className="panel w-full max-w-md space-y-3" onClick={(event) => event.stopPropagation()}>
            <h2>Kategoriler</h2>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {categories.map((row) => (
                <li key={row.id} className="flex justify-between"><span>{row.name}</span><span className="text-slate-400">{row.type === 'income' ? 'Gelir' : 'Gider'}</span></li>
              ))}
            </ul>
            <form className="space-y-2" onSubmit={(event) => saveCategory(event).catch((err) => setError(err.message))}>
              <label>Yeni kategori<input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required /></label>
              <label>Tür
                <select value={categoryForm.type} onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value })}>
                  <option value="expense">Gider</option>
                  <option value="income">Gelir</option>
                </select>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className="ghost" onClick={() => setCategoryOpen(false)}>Kapat</button>
                <button className="primary" type="submit">Ekle</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
