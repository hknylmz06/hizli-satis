import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

function money(value) {
  return `₺${Number(value || 0).toFixed(2)}`
}

const TYPE_LABEL = { cash: 'Nakit kasa', bank: 'Banka vadesiz', pos: 'POS cihaz hesabı' }

export default function AccountsPage() {
  const { session } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [moves, setMoves] = useState(null)
  const [form, setForm] = useState({ name: '', type: 'cash', balance: '0', commissionRate: '0' })
  const [transfer, setTransfer] = useState({ fromAccountId: '', toAccountId: '', amount: '', note: '' })

  async function load() {
    setError('')
    const rows = await api('/api/accounts', { token: session.token })
    setAccounts(rows)
    setTransfer((current) => ({
      ...current,
      fromAccountId: current.fromAccountId || rows[0]?.id || '',
      toAccountId: current.toAccountId || rows[1]?.id || rows[0]?.id || ''
    }))
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [session.token])

  async function createAccount(event) {
    event.preventDefault()
    await api('/api/accounts', {
      method: 'POST',
      token: session.token,
      body: {
        name: form.name,
        type: form.type,
        balance: Number(form.balance || 0),
        commissionRate: Number(form.commissionRate || 0)
      }
    })
    setCreateOpen(false)
    setForm({ name: '', type: 'cash', balance: '0', commissionRate: '0' })
    setNotice('Hesap eklendi.')
    await load()
  }

  async function sendTransfer(event) {
    event.preventDefault()
    await api('/api/accounts/transfer', {
      method: 'POST',
      token: session.token,
      body: { ...transfer, amount: Number(transfer.amount) }
    })
    setTransferOpen(false)
    setTransfer((current) => ({ ...current, amount: '', note: '' }))
    setNotice('Virman tamamlandı.')
    await load()
  }

  async function removeAccount(account) {
    if (!window.confirm(`${account.name} kapatılsın mı?`)) return
    const result = await api(`/api/accounts/${account.id}`, { method: 'DELETE', token: session.token })
    setNotice(result.message)
    await load()
  }

  async function openMoves(account) {
    const rows = await api(`/api/accounts/${account.id}/movements`, { token: session.token })
    setMoves({ account, rows })
  }

  const cash = accounts.filter((row) => row.type === 'cash').reduce((sum, row) => sum + Number(row.balance || 0), 0)
  const bank = accounts.filter((row) => row.type === 'bank').reduce((sum, row) => sum + Number(row.balance || 0), 0)
  const pos = accounts.filter((row) => row.type === 'pos').reduce((sum, row) => sum + Number(row.balance || 0), 0)

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="panel flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="mb-1">Kasa ve banka</h1>
          <p className="muted">Nakit kasa, banka vadesiz, POS ve virman.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ghost" onClick={() => setTransferOpen(true)}>Virman / transfer</button>
          <button type="button" className="primary" onClick={() => setCreateOpen(true)}>+ Yeni hesap</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {notice && <p className="success">{notice}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="panel"><span className="block text-xs text-slate-400">Nakit kasa</span><strong className="text-xl text-emerald-300">{money(cash)}</strong></div>
        <div className="panel"><span className="block text-xs text-slate-400">POS alacak</span><strong className="text-xl text-amber-300">{money(pos)}</strong></div>
        <div className="panel"><span className="block text-xs text-slate-400">Banka vadesiz</span><strong className="text-xl text-sky-300">{money(bank)}</strong></div>
        <div className="panel"><span className="block text-xs text-slate-400">Genel likit</span><strong className="text-xl text-emerald-300">{money(cash + bank + pos)}</strong><span className="block text-[11px] text-slate-500">Kasa + banka + POS</span></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {accounts.length === 0 ? <p className="muted">Hesap yok.</p> : accounts.map((account) => (
          <article key={account.id} className="panel space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2>{account.name}</h2>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{TYPE_LABEL[account.type] || account.type}</p>
              </div>
              <div className="flex items-center gap-2">
                {account.type === 'pos' && Number(account.commissionRate) > 0 && (
                  <span className="rounded-md bg-amber-950 px-2 py-0.5 text-[11px] font-bold text-amber-300">%{Number(account.commissionRate)}</span>
                )}
                <button type="button" className="danger" onClick={() => removeAccount(account).catch((err) => setError(err.message))}>Sil</button>
              </div>
            </div>
            <div>
              <span className="block text-[11px] text-slate-500">Güncel bakiye</span>
              <strong className="text-2xl text-white">{money(account.balance)}</strong>
            </div>
            <button type="button" className="ghost w-full" onClick={() => openMoves(account).catch((err) => setError(err.message))}>Hesap hareketlerini aç</button>
          </article>
        ))}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={() => setCreateOpen(false)}>
          <form className="panel w-full max-w-md space-y-3" onClick={(event) => event.stopPropagation()} onSubmit={(event) => createAccount(event).catch((err) => setError(err.message))}>
            <h2>Yeni hesap</h2>
            <label>Ad<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label>Tür
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="cash">Nakit kasa</option>
                <option value="bank">Banka vadesiz</option>
                <option value="pos">POS cihazı</option>
              </select>
            </label>
            <label>Açılış bakiyesi<input type="number" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} /></label>
            {form.type === 'pos' && (
              <label>Komisyon %<input type="number" min="0" step="0.1" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} /></label>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="ghost" onClick={() => setCreateOpen(false)}>Vazgeç</button>
              <button className="primary" type="submit">Kaydet</button>
            </div>
          </form>
        </div>
      )}

      {transferOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={() => setTransferOpen(false)}>
          <form className="panel w-full max-w-md space-y-3" onClick={(event) => event.stopPropagation()} onSubmit={(event) => sendTransfer(event).catch((err) => setError(err.message))}>
            <h2>Virman</h2>
            <label>Çıkış
              <select value={transfer.fromAccountId} onChange={(e) => setTransfer({ ...transfer, fromAccountId: e.target.value })}>
                {accounts.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </label>
            <label>Varış
              <select value={transfer.toAccountId} onChange={(e) => setTransfer({ ...transfer, toAccountId: e.target.value })}>
                {accounts.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </label>
            <label>Tutar<input type="number" min="0.01" step="0.01" value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })} required /></label>
            <label>Not<input value={transfer.note} onChange={(e) => setTransfer({ ...transfer, note: e.target.value })} /></label>
            <div className="flex justify-end gap-2">
              <button type="button" className="ghost" onClick={() => setTransferOpen(false)}>Vazgeç</button>
              <button className="primary" type="submit">Aktar</button>
            </div>
          </form>
        </div>
      )}

      {moves && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={() => setMoves(null)}>
          <div className="panel max-h-[80vh] w-full max-w-2xl space-y-3 overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2>{moves.account.name} hareketleri</h2>
              <button type="button" className="ghost" onClick={() => setMoves(null)}>Kapat</button>
            </div>
            <table>
              <thead><tr><th>Tarih</th><th>İşlem</th><th>Açıklama</th><th>Tutar</th></tr></thead>
              <tbody>
                {moves.rows.length === 0 ? (
                  <tr><td colSpan="4" className="text-slate-500">Hareket yok.</td></tr>
                ) : moves.rows.map((row, index) => (
                  <tr key={`${row.at}-${index}`}>
                    <td className="font-mono text-xs">{new Date(row.at).toLocaleString('tr-TR')}</td>
                    <td>{row.label}</td>
                    <td>{row.note || '-'}</td>
                    <td className={`font-mono ${row.direction === 'out' ? 'text-rose-300' : 'text-emerald-300'}`}>{row.direction === 'out' ? '-' : '+'}{money(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
