import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

export default function OtherSettingsPage({ embedded = false }) {
  const { session } = useAuth()
  const [autoReceipt, setAutoReceipt] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api('/api/settings/extra', { token: session.token })
      .then((data) => setAutoReceipt(data.autoFiscalReceipt !== false))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [session.token])

  async function save(next = autoReceipt) {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const data = await api('/api/settings/extra', {
        method: 'PUT',
        token: session.token,
        body: { autoFiscalReceipt: next }
      })
      setAutoReceipt(data.autoFiscalReceipt !== false)
      setMessage(next ? 'Otomatik mali fiş açık. Satış için yazarkasa eşleşmesi gerekir.' : 'Otomatik mali fiş kapalı. Satış fiş basmadan tamamlanır.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={embedded ? 'fiscal-screen' : 'fiscal-screen p-4 md:p-6'}>
      <div className="max-w-3xl mx-auto bg-white border border-sky-100 rounded-3xl shadow-sm p-5 md:p-6 space-y-4">
        <div>
          <h1>Diğer Ayarlar</h1>
          <p className="text-sm text-slate-500">Satış davranışı burada durur. Yeni seçenekler de bu sayfaya eklenecek.</p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
          <div>
            <div className="font-bold text-sm text-slate-800">POS Satışlarında Otomatik Mali Fiş Basımı</div>
            <p className="text-xs text-amber-600 mt-0.5">Bu ayar açıkken yazarkasa canlı bağlı değilse satış fişi basılmaz. ÖKC olmadan satış yapmak için bu ayarı kapatın.</p>
          </div>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => save(!autoReceipt)}
            className={`toggle shrink-0 ${autoReceipt ? '!bg-violet-600' : '!bg-slate-300'}`}
            aria-pressed={autoReceipt}
          >
            <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${autoReceipt ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <p className="text-xs text-slate-500">Birden fazla POS hesabı tanımlanırsa, yazarkasa onayından sonra işlemin hangi POS hesabına yazılacağı da buradan seçilecek.</p>

        {message && <p className="text-sm text-emerald-700">{message}</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </div>
  )
}
