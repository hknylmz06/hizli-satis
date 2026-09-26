import { useEffect, useState } from 'react'
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle, History, Plus, Search, X } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'

function money(value) {
  return `₺${Number(value || 0).toFixed(2)}`
}

const emptyForm = { name: '', phone: '', email: '', address: '', note: '' }

export default function SuppliersPage() {
  const { session } = useAuth()
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch] = useState('')
  const [onlyMoved, setOnlyMoved] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [debtSupplier, setDebtSupplier] = useState(null)
  const [debtAmount, setDebtAmount] = useState('')
  const [debtNote, setDebtNote] = useState('')
  const [paySupplier, setPaySupplier] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [payAccountId, setPayAccountId] = useState('')
  const [accounts, setAccounts] = useState([])
  const [statement, setStatement] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function load(q = search) {
    const path = q.trim() ? `/api/suppliers?q=${encodeURIComponent(q.trim())}` : '/api/suppliers'
    setSuppliers(await api(path, { token: session.token }))
  }

  useEffect(() => {
    load('').catch((err) => setError(err.message))
    api('/api/accounts', { token: session.token }).then((rows) => {
      const list = Array.isArray(rows) ? rows : []
      setAccounts(list)
      if (list[0]) setPayAccountId(list[0].id)
    }).catch(() => {})
  }, [session.token])

  const visible = suppliers.filter((s) => !onlyMoved || Number(s.totalPurchaseAmount) > 0 || Number(s.invoiceCount) > 0 || Number(s.balance) > 0)
  const totalDebt = suppliers.reduce((sum, s) => sum + Math.max(0, Number(s.balance || 0)), 0)

  async function saveDebt(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(`/api/suppliers/${debtSupplier.id}/debt`, {
        method: 'POST',
        token: session.token,
        body: { amount: Number(debtAmount), note: debtNote }
      })
      setDebtSupplier(null)
      setMessage('Borç eklendi.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function savePayment(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(`/api/suppliers/${paySupplier.id}/payments`, {
        method: 'POST',
        token: session.token,
        body: { amount: Number(payAmount), note: payNote, accountId: payAccountId }
      })
      setPaySupplier(null)
      setMessage('Ödeme kaydedildi.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function openStatement(supplier) {
    setError('')
    try {
      setStatement(await api(`/api/suppliers/${supplier.id}/statement`, { token: session.token }))
    } catch (err) {
      setError(err.message)
    }
  }

  async function createSupplier(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/api/suppliers', { method: 'POST', token: session.token, body: form })
      setOpen(false)
      setForm(emptyForm)
      setMessage('Tedarikçi kaydedildi.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="panel flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="mb-1">Tedarikçiler</h1>
          <p className="muted">Alış faturası, iletişim ve tedarikçiye olan borç.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-amber-950/60 border border-amber-500/30 px-3 py-2 rounded-xl text-right">
            <span className="text-[10px] text-amber-300 block">Toplam borç</span>
            <span className="font-mono font-bold text-amber-300">{money(totalDebt)}</span>
          </div>
          <button type="button" className="primary" onClick={() => setOpen(true)}><Plus className="w-4 h-4 inline" /> Yeni tedarikçi</button>
        </div>
      </div>

      {error && <p className="error flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</p>}
      {message && <p className="success flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {message}</p>}

      <div className="panel flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); load().catch((err) => setError(err.message)) }}>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tedarikçi adı veya telefon" className="pl-9" />
        </form>
        <label className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
          <input type="checkbox" checked={onlyMoved} onChange={(e) => setOnlyMoved(e.target.checked)} />
          Sadece alımı veya borcu olanlar
        </label>
      </div>

      <div className="panel overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Tedarikçi</th>
              <th>Telefon</th>
              <th>Fatura</th>
              <th>Toplam alım</th>
              <th>Borcumuz</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan="6" className="text-slate-500">{onlyMoved ? 'Alımı veya borcu olan tedarikçi yok.' : 'Kayıtlı tedarikçi yok.'}</td></tr>
            ) : visible.map((supplier) => {
              const balance = Number(supplier.balance || 0)
              return (
                <tr key={supplier.id}>
                  <td>
                    <div className="font-bold text-white">{supplier.name}</div>
                    {supplier.address && <div className="text-[11px] text-slate-400">{supplier.address}</div>}
                    {supplier.note && <div className="text-[11px] text-slate-500">{supplier.note}</div>}
                  </td>
                  <td className="font-mono">{supplier.phone || '-'}</td>
                  <td className="font-mono">{supplier.invoiceCount || 0}</td>
                  <td className="font-mono text-emerald-300">{money(supplier.totalPurchaseAmount)}</td>
                  <td>
                    <span className={`pill ${balance > 0 ? 'warn' : ''}`}>{money(balance)}</span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1 justify-end">
                      <button type="button" className="amber" onClick={() => { setDebtSupplier(supplier); setDebtAmount(''); setDebtNote('') }}><ArrowUpRight className="w-3.5 h-3.5 inline" /> Borç</button>
                      {balance > 0 && (
                        <button type="button" className="primary" onClick={() => { setPaySupplier(supplier); setPayAmount(String(balance)); setPayNote(''); if (!payAccountId && accounts[0]) setPayAccountId(accounts[0].id) }}><ArrowDownRight className="w-3.5 h-3.5 inline" /> Ödeme</button>
                      )}
                      <button type="button" className="ghost" onClick={() => openStatement(supplier)}><History className="w-3.5 h-3.5 inline" /> Ekstre</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form className="panel w-full max-w-md stack" onSubmit={createSupplier}>
            <div className="flex items-center justify-between">
              <h2>Yeni tedarikçi</h2>
              <button type="button" className="ghost" onClick={() => setOpen(false)} aria-label="Kapat"><X className="w-4 h-4" /></button>
            </div>
            <label>Firma adı *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label>Telefon<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label>E-posta<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Adres<textarea rows="2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <label>Not<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
            <div className="flex justify-end gap-2">
              <button type="button" className="ghost" onClick={() => setOpen(false)}>İptal</button>
              <button className="primary" disabled={busy}>Kaydet</button>
            </div>
          </form>
        </div>
      )}

      {debtSupplier && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form className="panel w-full max-w-md stack" onSubmit={saveDebt}>
            <div className="flex items-center justify-between">
              <h2>Tedarikçiye borç</h2>
              <button type="button" className="ghost" onClick={() => setDebtSupplier(null)} aria-label="Kapat"><X className="w-4 h-4" /></button>
            </div>
            <p className="muted">{debtSupplier.name} · mevcut borç {money(debtSupplier.balance)}</p>
            <label>Borç tutarı *<input type="number" step="0.01" required value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} /></label>
            <label>Açıklama *<input required value={debtNote} onChange={(e) => setDebtNote(e.target.value)} placeholder="Eski dönem borç, açılış bakiyesi" /></label>
            <div className="flex justify-end gap-2">
              <button type="button" className="ghost" onClick={() => setDebtSupplier(null)}>İptal</button>
              <button className="amber" disabled={busy}>Borç ekle</button>
            </div>
          </form>
        </div>
      )}

      {paySupplier && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form className="panel w-full max-w-md stack" onSubmit={savePayment}>
            <div className="flex items-center justify-between">
              <h2>Tedarikçi ödemesi</h2>
              <button type="button" className="ghost" onClick={() => setPaySupplier(null)} aria-label="Kapat"><X className="w-4 h-4" /></button>
            </div>
            <p className="muted">{paySupplier.name} · mevcut borç {money(paySupplier.balance)}</p>
            <label>Ödenen tutar *<input type="number" step="0.01" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></label>
            <label>Hangi kasadan çıkacak *
              <select required value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)}>
                <option value="">Kasa seç</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name} · bakiye {money(account.balance)}</option>
                ))}
              </select>
            </label>
            <label>Açıklama<input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Nakit ödeme" /></label>
            <div className="flex justify-end gap-2">
              <button type="button" className="ghost" onClick={() => setPaySupplier(null)}>İptal</button>
              <button className="primary" disabled={busy}>Ödemeyi kaydet</button>
            </div>
          </form>
        </div>
      )}

      {statement && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="panel w-full max-w-2xl stack">
            <div className="flex items-center justify-between">
              <h2>{statement.supplier.name} ekstresi</h2>
              <button type="button" className="ghost" onClick={() => setStatement(null)} aria-label="Kapat"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl border border-slate-800 p-2"><div className="text-slate-400">Eklenen borç</div><div className="font-mono font-bold">{money(statement.summary.totalDebt)}</div></div>
              <div className="rounded-xl border border-slate-800 p-2"><div className="text-slate-400">Ödeme</div><div className="font-mono font-bold">{money(statement.summary.totalPayments)}</div></div>
              <div className="rounded-xl border border-slate-800 p-2"><div className="text-slate-400">Güncel borç</div><div className="font-mono font-bold text-amber-300">{money(statement.summary.currentBalance)}</div></div>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table>
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Tür</th>
                    <th>Açıklama</th>
                    <th>Tutar</th>
                    <th>Bakiye</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.transactions.length === 0 ? (
                    <tr><td colSpan="5" className="text-slate-500">Hareket yok.</td></tr>
                  ) : statement.transactions.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-xs">{new Date(row.createdAt).toLocaleString('tr-TR')}</td>
                      <td>{row.type === 'debt' ? 'Borç' : 'Ödeme'}</td>
                      <td>{row.note || '-'}{row.accountName ? ` · ${row.accountName}` : ''}</td>
                      <td className={`font-mono ${row.type === 'payment' ? 'text-emerald-300' : 'text-amber-300'}`}>{row.type === 'payment' ? '-' : '+'}{money(row.amount)}</td>
                      <td className="font-mono">{money(row.runningBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
