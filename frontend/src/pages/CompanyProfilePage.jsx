import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

const empty = {
  companyName: '',
  companyAddress: '',
  companyPhone: '',
  companyTaxOffice: '',
  companyTaxNo: '',
  receiptFooter: ''
}

export default function CompanyProfilePage({ embedded = false }) {
  const { session } = useAuth()
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api('/api/settings/extra', { token: session.token })
      .then((data) => setForm({
        companyName: data.companyName || '',
        companyAddress: data.companyAddress || '',
        companyPhone: data.companyPhone || '',
        companyTaxOffice: data.companyTaxOffice || '',
        companyTaxNo: data.companyTaxNo || '',
        receiptFooter: data.receiptFooter || ''
      }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [session.token])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const data = await api('/api/settings/extra', { method: 'PUT', token: session.token, body: form })
      setForm({
        companyName: data.companyName || '',
        companyAddress: data.companyAddress || '',
        companyPhone: data.companyPhone || '',
        companyTaxOffice: data.companyTaxOffice || '',
        companyTaxNo: data.companyTaxNo || '',
        receiptFooter: data.receiptFooter || ''
      })
      setMessage('Firma tanımı kaydedildi. Bilgi fişinin başında ve sonunda görünür.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const field = 'mt-1 w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900'

  return (
    <div className={embedded ? 'fiscal-screen' : 'fiscal-screen p-4 md:p-6'}>
      <form onSubmit={save} className="max-w-3xl mx-auto bg-white border border-sky-100 rounded-3xl shadow-sm p-5 md:p-6 space-y-4">
        <div>
          <h1>Firma Tanımı</h1>
          <p className="text-sm text-slate-500">Mağaza adı fişin başında basılır. Alttaki yazı fişin sonunda çıkar. Boş bırakılan satır fişe yazılmaz.</p>
        </div>
        <label className="block text-xs font-semibold text-slate-600">
          Mağaza adı
          <input value={form.companyName} disabled={loading || saving} onChange={(e) => setField('companyName', e.target.value)} className={field} placeholder="Örn. Yılmaz Market" />
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          Adres
          <textarea value={form.companyAddress} disabled={loading || saving} onChange={(e) => setField('companyAddress', e.target.value)} rows={2} className={field} placeholder="Mahalle, sokak, ilçe" />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-slate-600">
            Telefon
            <input value={form.companyPhone} disabled={loading || saving} onChange={(e) => setField('companyPhone', e.target.value)} className={field} placeholder="05xx" />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Vergi no
            <input value={form.companyTaxNo} disabled={loading || saving} onChange={(e) => setField('companyTaxNo', e.target.value)} className={field} />
          </label>
        </div>
        <label className="block text-xs font-semibold text-slate-600">
          Vergi dairesi
          <input value={form.companyTaxOffice} disabled={loading || saving} onChange={(e) => setField('companyTaxOffice', e.target.value)} className={field} />
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          Fiş sonu yazısı
          <textarea value={form.receiptFooter} disabled={loading || saving} onChange={(e) => setField('receiptFooter', e.target.value)} rows={3} className={field} placeholder="Teşekkür ederiz. İade için fişinizi saklayın." />
        </label>
        {message && <p className="text-sm text-emerald-700">{message}</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={loading || saving} className="primary">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
      </form>
    </div>
  )
}
