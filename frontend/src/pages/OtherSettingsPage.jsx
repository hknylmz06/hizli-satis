import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

const PAPER = [
  ['80', '80mm Termal', 'Standart geniş fiş'],
  ['58', '58mm Termal', 'Küçük dar fiş'],
  ['a4', 'A4 Sayfa', 'Tam sayfa']
]
export default function OtherSettingsPage({ embedded = false }) {
  const { session } = useAuth()
  const [autoReceipt, setAutoReceipt] = useState(true)
  const [askPosAccount, setAskPosAccount] = useState(false)
  const [showInfoReceipt, setShowInfoReceipt] = useState(false)
  const [autoPrintInfo, setAutoPrintInfo] = useState(false)
  const [printerName, setPrinterName] = useState('')
  const [paper, setPaper] = useState('80')
  const [installed, setInstalled] = useState([])
  const [printerNote, setPrinterNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api('/api/settings/extra', { token: session.token })
      .then((data) => {
        setAutoReceipt(data.autoFiscalReceipt !== false)
        setAskPosAccount(data.askPosAccount === true)
        setShowInfoReceipt(data.showInfoReceipt === true)
        setAutoPrintInfo(data.autoPrintInfoReceipt === true)
        setPrinterName(data.infoPrinterName || '')
        setPaper(data.infoPaper === '58' || data.infoPaper === 'a4' ? data.infoPaper : '80')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    fetch('http://127.0.0.1:5055/printers')
      .then(async (res) => {
        if (!res.ok) throw new Error('liste yok')
        const data = await res.json()
        const names = Array.isArray(data.printers) ? data.printers.filter(Boolean) : []
        setInstalled(names)
        setPrinterNote(names.length ? '' : 'Bu bilgisayarda yüklü yazıcı görünmedi.')
      })
      .catch(() => {
        setInstalled([])
        setPrinterNote('Yazıcı listesi gelmedi. Kasadaki yazıcı servisini güncelleyip açık tut.')
      })
  }, [session.token])

  async function save(patch) {
    const next = {
      autoFiscalReceipt: autoReceipt,
      askPosAccount,
      showInfoReceipt,
      autoPrintInfoReceipt: autoPrintInfo,
      infoPrinterName: printerName,
      infoPaper: paper,
      ...patch
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const data = await api('/api/settings/extra', {
        method: 'PUT',
        token: session.token,
        body: next
      })
      setAutoReceipt(data.autoFiscalReceipt !== false)
      setAskPosAccount(data.askPosAccount === true)
      setShowInfoReceipt(data.showInfoReceipt === true)
      setAutoPrintInfo(data.autoPrintInfoReceipt === true)
      setPrinterName(data.infoPrinterName || '')
      setPaper(data.infoPaper === '58' || data.infoPaper === 'a4' ? data.infoPaper : '80')
      setMessage('Ayar kaydedildi.')
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
          <p className="text-sm text-slate-500">Satış sonrası bilgi fişi ve yazıcı burada durur. Baskı tarayıcı penceresi açmadan kasadaki yazıcıya gider.</p>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 space-y-4">
          <div>
            <div className="font-bold text-sm text-slate-800">Fiş yazıcısı ve rulo genişliği</div>
            <p className="text-xs text-slate-500 mt-0.5">80mm, 58mm veya A4. Yazıcı adı bu bilgisayardaki Windows yazıcı adıdır.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PAPER.map(([id, title, hint]) => (
              <button
                key={id}
                type="button"
                disabled={loading || saving}
                onClick={() => { setPaper(id); save({ infoPaper: id }) }}
                className={`text-left px-3 py-3 rounded-2xl border ${paper === id ? 'paper-on' : 'ghost'}`}
              >
                <div className="font-black text-sm">{title}</div>
                <div className={`text-[11px] ${paper === id ? 'text-blue-100' : 'text-slate-500'}`}>{hint}</div>
              </button>
            ))}
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            Kullanılacak fiş yazıcısı adı
            <input
              value={printerName}
              disabled={loading || saving}
              onChange={(e) => setPrinterName(e.target.value)}
              onBlur={() => save({ infoPrinterName: printerName })}
              placeholder="Varsayılan yazıcı"
              className="mt-1 w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {['Varsayılan', ...installed].map((name) => {
              const selected = name === 'Varsayılan' ? printerName === '' : printerName === name
              return (
                <button
                  key={name}
                  type="button"
                  disabled={loading || saving}
                  onClick={() => {
                    const next = name === 'Varsayılan' ? '' : name
                    setPrinterName(next)
                    save({ infoPrinterName: next })
                  }}
                  className={selected ? 'paper-on' : 'ghost'}
                >{name}</button>
              )
            })}
          </div>
          {printerNote && <p className="text-xs text-amber-600">{printerNote}</p>}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
          <div>
            <div className="font-bold text-sm text-slate-800">Satış sonrası bilgi fişi ekranı açılsın</div>
            <p className="text-xs text-amber-600 mt-0.5">Açıkken satış bitince bilgi fişi ekrana gelir. Yazdır dersen fiş, pencere açmadan seçili yazıcıdan çıkar.</p>
          </div>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => save({ showInfoReceipt: !showInfoReceipt })}
            className={`toggle shrink-0 ${showInfoReceipt ? '!bg-violet-600' : '!bg-slate-300'}`}
            aria-pressed={showInfoReceipt}
          >
            <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${showInfoReceipt ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
          <div>
            <div className="font-bold text-sm text-slate-800">Otomatik yazdırılsın</div>
            <p className="text-xs text-amber-600 mt-0.5">Açıkken satış kaydolunca fiş kendiliğinden basılır. Yazdırma penceresi açılmaz.</p>
          </div>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => save({ autoPrintInfoReceipt: !autoPrintInfo })}
            className={`toggle shrink-0 ${autoPrintInfo ? '!bg-violet-600' : '!bg-slate-300'}`}
            aria-pressed={autoPrintInfo}
          >
            <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${autoPrintInfo ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
          <div>
            <div className="font-bold text-sm text-slate-800">POS Satışlarında Otomatik Mali Fiş Basımı</div>
            <p className="text-xs text-amber-600 mt-0.5">Bu ayar açıkken yazarkasa canlı bağlı değilse satış fişi basılmaz. ÖKC olmadan satış yapmak için bu ayarı kapatın.</p>
          </div>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => save({ autoFiscalReceipt: !autoReceipt })}
            className={`toggle shrink-0 ${autoReceipt ? '!bg-violet-600' : '!bg-slate-300'}`}
            aria-pressed={autoReceipt}
          >
            <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${autoReceipt ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
          <div>
            <div className="font-bold text-sm text-slate-800">Ödeme Sonrası POS Hesabı Seçimi</div>
            <p className="text-xs text-amber-600 mt-0.5">Açıkken kartlı ödemede, yazarkasa onayından sonra tutarın hangi POS hesabına yazılacağı sorulur. Kapalıyken ana POS hesabına yazılır.</p>
          </div>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => save({ askPosAccount: !askPosAccount })}
            className={`toggle shrink-0 ${askPosAccount ? '!bg-violet-600' : '!bg-slate-300'}`}
            aria-pressed={askPosAccount}
          >
            <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${askPosAccount ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        {message && <p className="text-sm text-emerald-700">{message}</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </div>
  )
}
