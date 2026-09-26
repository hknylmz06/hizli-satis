import { useEffect, useState } from 'react'
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle, History, Plus, Search, X } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'

function money(value) {
  return `₺${Number(value || 0).toFixed(2)}`
}

const emptyForm = { name: '', phone: '', email: '', address: '', note: '', creditLimit: '' }

export default function CustomersPage() {
  const { session } = useAuth()
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [onlyDebt, setOnlyDebt] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [paymentCustomer, setPaymentCustomer] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [accounts, setAccounts] = useState([])
  const [debtCustomer, setDebtCustomer] = useState(null)
  const [debtAmount, setDebtAmount] = useState('')
  const [debtNote, setDebtNote] = useState('')
  const [statement, setStatement] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function load(q = search) {
    const path = q.trim() ? `/api/customers?q=${encodeURIComponent(q.trim())}` : '/api/customers'
    setCustomers(await api(path, { token: session.token }))
  }

  useEffect(() => {
    load('').catch((err) => setError(err.message))
    api('/api/accounts', { token: session.token }).then((rows) => {
      const list = Array.isArray(rows) ? rows : []
      setAccounts(list)
      if (list[0]) setPaymentAccountId(list[0].id)
    }).catch(() => {})
  }, [session.token])

  const visible = customers.filter((c) => !onlyDebt || Math.abs(Number(c.balance) || 0) > 0.001)
  const totalDebt = customers.reduce((sum, c) => sum + (Number(c.balance) > 0 ? Number(c.balance) : 0), 0)

  async function createCustomer(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/api/customers', {
        method: 'POST',
        token: session.token,
        body: { ...form, creditLimit: Number(form.creditLimit || 0) }
      })
      setShowAdd(false)
      setForm(emptyForm)
      setMessage('Müşteri eklendi.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function savePayment(e) {
    e.preventDefault()
    const amount = Number(paymentAmount)
    if (!(amount > 0)) return
    setBusy(true)
    setError('')
    try {
      await api(`/api/customers/${paymentCustomer.id}/payments`, {
        method: 'POST',
        token: session.token,
        body: { amount, note: paymentNote, accountId: paymentAccountId }
      })
      setPaymentCustomer(null)
      setMessage('Ödeme alındı, seçilen kasaya işlendi.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveDebt(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(`/api/customers/${debtCustomer.id}/debt`, {
        method: 'POST',
        token: session.token,
        body: { amount: Number(debtAmount), note: debtNote }
      })
      setDebtCustomer(null)
      setMessage('Borç eklendi.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function openStatement(customer) {
    setError('')
    try {
      const data = await api(`/api/customers/${customer.id}/statement`, { token: session.token })
      setStatement(data)
    } catch (err) {
      setError(err.message)
    }
  }

  async function remind(customer) {
    setError('')
    try {
      const data = await api(`/api/customers/${customer.id}/reminder`, { method: 'POST', token: session.token })
      window.open(data.whatsappUrl, '_blank')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="panel flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="mb-1">Müşteriler ve veresiye</h1>
          <p className="muted">Borç bakiyesi, kredi limiti, tahsilat ve hesap ekstresi.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-amber-950/60 border border-amber-500/30 px-3 py-2 rounded-xl text-right">
            <span className="text-[10px] text-amber-300 block">Toplam veresiye</span>
            <span className="font-mono font-bold text-amber-300">{money(totalDebt)}</span>
          </div>
          <button type="button" className="primary" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 inline" /> Yeni müşteri</button>
        </div>
      </div>

      {error && <p className="error flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</p>}
      {message && <p className="success flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {message}</p>}

      <div className="panel flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); load().catch((err) => setError(err.message)) }}>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Müşteri adı veya telefon" className="pl-9" />
        </form>
        <label className="flex items-center gap-2 text-xs font-semibold text-amber-200">
          <input type="checkbox" checked={onlyDebt} onChange={(e) => setOnlyDebt(e.target.checked)} />
          Sadece borcu olanlar
        </label>
      </div>

      <div className="panel overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Müşteri</th>
              <th>Telefon</th>
              <th>Kredi limiti</th>
              <th>Veresiye borç</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan="5" className="text-slate-500">{onlyDebt ? 'Borcu olan müşteri yok.' : 'Kayıtlı müşteri yok.'}</td></tr>
            ) : visible.map((customer) => {
              const balance = Number(customer.balance || 0)
              const limit = Number(customer.creditLimit || 0)
              const over = limit > 0 && balance > limit
              return (
                <tr key={customer.id}>
                  <td>
                    <div className="font-bold text-white">{customer.name}</div>
                    {customer.address && <div className="text-[11px] text-slate-400">{customer.address}</div>}
                  </td>
                  <td className="font-mono">{customer.phone || '-'}</td>
                  <td className="font-mono">{limit > 0 ? money(limit) : 'Limitsiz'}</td>
                  <td>
                    <span className={`pill ${over ? 'warn' : balance > 0 ? 'warn' : ''}`}>
                      {money(balance)}{over ? ' · limit aşıldı' : ''}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1 justify-end">
                      <button type="button" className="amber" onClick={() => { setDebtCustomer(customer); setDebtAmount(''); setDebtNote('') }}><ArrowUpRight className="w-3.5 h-3.5 inline" /> Borç</button>
                      {balance > 0 && (
                        <>
                          <button type="button" className="ghost" onClick={() => remind(customer)}>Hatırlat</button>
                          <button type="button" className="primary" onClick={() => { setPaymentCustomer(customer); setPaymentAmount(String(balance)); setPaymentNote('') }}><ArrowDownRight className="w-3.5 h-3.5 inline" /> Ödeme Al</button>
                        </>
                      )}
                      <button type="button" className="ghost" onClick={() => openStatement(customer)}><History className="w-3.5 h-3.5 inline" /> Ekstre</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <Modal title="Yeni müşteri" onClose={() => setShowAdd(false)}>
          <form className="stack" onSubmit={createCustomer}>
            <label>Ad / firma *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label>Telefon<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05XX XXX XX XX" /></label>
            <label>E-posta<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Veresiye limiti (0 = limitsiz)<input type="number" step="0.01" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} /></label>
            <label>Adres<textarea rows="2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <label>Not<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
            <div className="flex justify-end gap-2">
              <button type="button" className="ghost" onClick={() => setShowAdd(false)}>İptal</button>
              <button className="primary" disabled={busy}>Kaydet</button>
            </div>
          </form>
        </Modal>
      )}

      {paymentCustomer && (
        <Modal title="Veresiye ödeme al" onClose={() => setPaymentCustomer(null)}>
          <form className="stack" onSubmit={savePayment}>
            <p className="muted">{paymentCustomer.name} · mevcut borç {money(paymentCustomer.balance)}</p>
            <label>Alınan tutar *<input type="number" step="0.01" required value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></label>
            <label>Hangi kasaya girecek *
              <select required value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
                <option value="">Kasa seç</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name} · bakiye {money(account.balance)}</option>
                ))}
              </select>
            </label>
            <label>Açıklama<input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Nakit tahsilat" /></label>
            <div className="flex justify-end gap-2">
              <button type="button" className="ghost" onClick={() => setPaymentCustomer(null)}>İptal</button>
              <button className="primary" disabled={busy}>Ödemeyi kaydet</button>
            </div>
          </form>
        </Modal>
      )}

      {debtCustomer && (
        <Modal title="Manuel borç" onClose={() => setDebtCustomer(null)}>
          <form className="stack" onSubmit={saveDebt}>
            <p className="muted">{debtCustomer.name} · mevcut borç {money(debtCustomer.balance)}</p>
            <label>Borç tutarı *<input type="number" step="0.01" required value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} /></label>
            <label>Açıklama *<input required value={debtNote} onChange={(e) => setDebtNote(e.target.value)} placeholder="Eski dönem borç devri" /></label>
            <div className="flex justify-end gap-2">
              <button type="button" className="ghost" onClick={() => setDebtCustomer(null)}>İptal</button>
              <button className="amber" disabled={busy}>Borç ekle</button>
            </div>
          </form>
        </Modal>
      )}

      {statement && (
        <Modal title={`${statement.customer.name} ekstresi`} onClose={() => setStatement(null)} wide>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Stat label="Veresiye satış" value={money(statement.summary.totalSales)} />
            <Stat label="Tahsilat" value={money(statement.summary.totalPayments)} />
            <Stat label="Güncel borç" value={money(statement.summary.currentBalance)} />
            <Stat label="Limit" value={Number(statement.summary.creditLimit) > 0 ? money(statement.summary.creditLimit) : 'Limitsiz'} />
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
                    <td>{row.type === 'sale' ? 'Veresiye satış' : row.type === 'debt' ? 'Manuel borç' : 'Ödeme alındı'}</td>
                    <td>{row.note || '-'}{row.accountName ? ` · ${row.accountName}` : ''}</td>
                    <td className={`font-mono ${row.type === 'payment' ? 'text-emerald-300' : 'text-amber-300'}`}>{row.type === 'payment' ? '-' : '+'}{money(row.amount)}</td>
                    <td className="font-mono">{money(row.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
      <span className="block text-[10px] text-slate-400">{label}</span>
      <span className="font-mono font-bold text-white">{value}</span>
    </div>
  )
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className={`panel w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto space-y-3`}>
        <div className="flex items-center justify-between">
          <h2>{title}</h2>
          <button type="button" className="ghost" onClick={onClose} aria-label="Kapat"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
