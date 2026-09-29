import { useEffect, useState } from 'react'
import { Cpu, Pencil, Trash2 } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { ensureHuginAgent } from '../huginAgent'

const MODELS = ['HUGIN S1', 'HUGIN T300', 'HUGIN FP-300', 'HUGIN GENEL']
const COM_PORTS = ['COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9']

function blank(index) {
  return {
    id: 0,
    name: `Kasa ${index}`,
    model: 'HUGIN T300',
    connectionType: 'IP',
    deviceHost: '',
    devicePort: 4444,
    comPort: 'COM1',
    baudRate: 115200,
    serialNo: '',
    softwareId: '',
    hardwareId: 'ABCD1234',
    agentBaseUrl: 'http://127.0.0.1:5055',
    bridgeBaseUrl: 'http://127.0.0.1:8989',
    userId: '',
    isEnabled: true,
    isPaired: false,
    lastStatus: ''
  }
}

function isS1(model) {
  return String(model || '').toUpperCase().includes('S1')
}

function readLimit() {
  const value = Number(localStorage.getItem('fiscal-receipt-limit'))
  return value > 0 ? String(value) : '12000'
}

export default function FiscalPairingPage() {
  const { session } = useAuth()
  const [devices, setDevices] = useState([])
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(blank(1))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [agentOnline, setAgentOnline] = useState(null)
  const [installing, setInstalling] = useState(false)
  const [receiptLimit, setReceiptLimit] = useState(readLimit)

  function fill(row) {
    setForm({
      id: row.id,
      name: row.name || '',
      model: row.model || 'HUGIN T300',
      connectionType: row.connectionType || 'IP',
      deviceHost: row.deviceHost || '',
      devicePort: row.devicePort || (isS1(row.model) ? 4443 : 4444),
      comPort: row.comPort || 'COM1',
      baudRate: row.baudRate || 115200,
      serialNo: row.serialNo || '',
      softwareId: row.softwareId || '',
      hardwareId: row.hardwareId || 'ABCD1234',
      agentBaseUrl: row.agentBaseUrl || 'http://127.0.0.1:5055',
      bridgeBaseUrl: row.bridgeBaseUrl || 'http://127.0.0.1:8989',
      userId: row.userId ? String(row.userId) : '',
      isEnabled: row.isEnabled ?? true,
      isPaired: row.isPaired ?? false,
      lastStatus: row.lastStatus || ''
    })
  }

  async function load(selectId) {
    setError('')
    try {
      const data = await api('/api/fiscal/devices', { token: session.token })
      const rows = data.devices || []
      setDevices(rows)
      setUsers(data.users || [])
      if (data.message) setError(data.message)
      if (selectId) {
        const picked = rows.find((row) => row.id === selectId)
        if (picked) fill(picked)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [session.token])

  useEffect(() => {
    if (!isS1(form.model)) return
    const base = (form.agentBaseUrl || 'http://127.0.0.1:5055').replace(/\/$/, '')
    fetch(`${base}/health`, { cache: 'no-store' })
      .then((res) => setAgentOnline(res.ok))
      .catch(() => setAgentOnline(false))
  }, [form.model, form.agentBaseUrl])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function changeModel(model) {
    setForm((prev) => ({
      ...prev,
      model,
      devicePort: isS1(model) ? 4443 : 4444,
      connectionType: 'IP'
    }))
  }

  function body() {
    return {
      name: form.name,
      model: form.model,
      connectionType: form.connectionType,
      deviceHost: form.deviceHost,
      devicePort: Number(form.devicePort) || (isS1(form.model) ? 4443 : 4444),
      comPort: form.comPort,
      baudRate: Number(form.baudRate) || 115200,
      serialNo: form.serialNo || null,
      softwareId: form.softwareId || null,
      hardwareId: form.hardwareId || 'ABCD1234',
      agentBaseUrl: form.agentBaseUrl,
      bridgeBaseUrl: form.bridgeBaseUrl,
      userId: form.userId ? Number(form.userId) : null,
      isEnabled: true
    }
  }

  async function persist() {
    const path = form.id ? `/api/fiscal/devices/${form.id}` : '/api/fiscal/devices'
    return api(path, {
      method: form.id ? 'PUT' : 'POST',
      token: session.token,
      body: body()
    })
  }

  async function save(e) {
    e?.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const data = await persist()
      setMessage('Yazarkasa kaydedildi.')
      await load(data.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    setError('')
    setMessage('')
    try {
      await api(`/api/fiscal/devices/${id}`, { method: 'DELETE', token: session.token })
      if (form.id === id) setForm(blank(devices.length))
      setMessage('Yazarkasa silindi.')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function testPair() {
    setTesting(true)
    setError('')
    setMessage('')
    try {
      const saved = await persist()
      fill(saved)
      const s1 = isS1(saved.model || form.model)
      let result
      if (s1) {
        const agentBase = (saved.agentBaseUrl || form.agentBaseUrl || 'http://127.0.0.1:5055').replace(/\/$/, '')
        const online = await fetch(`${agentBase}/health`, { cache: 'no-store' }).then((res) => res.ok).catch(() => false)
        setAgentOnline(online)
        if (!online) throw new Error('S1 ajanı kapalı. Ajanı kur düğmesine bas.')
        const res = await fetch(`${agentBase}/pair/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceHost: (saved.deviceHost || '').trim(),
            devicePort: Number(saved.devicePort) || 4443,
            serialNo: saved.serialNo || null,
            softwareId: (saved.softwareId || '').trim() || '9217033991',
            hardwareId: (saved.hardwareId || 'ABCD1234').trim()
          })
        })
        result = await res.json()
      } else {
        const bridge = (saved.bridgeBaseUrl || 'http://127.0.0.1:8989').replace(/\/$/, '')
        const res = await fetch(`${bridge}/api/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            portName: saved.comPort || 'COM1',
            baudRate: Number(saved.baudRate) || 115200,
            fiscalId: saved.serialNo || '',
            model: saved.model,
            softwareId: saved.softwareId || '',
            hardwareId: saved.hardwareId || 'ABCD1234',
            connectionType: saved.connectionType || 'IP',
            ip: saved.deviceHost || '',
            tcpPort: Number(saved.devicePort) || 4444
          })
        })
        const data = await res.json()
        result = {
          ok: !!(data.connected && !data.simulation),
          message: data.message || (data.connected ? 'Eşleşti' : 'Eşleşme başarısız'),
          serialNo: saved.serialNo || null,
          hardwareId: saved.hardwareId || 'ABCD1234'
        }
        if (data.simulation) result.message = 'Simülasyon açıldı. Canlı eşleşme için yazarkasayı bağla.'
      }

      await api(`/api/fiscal/devices/${saved.id}/pair-result`, {
        method: 'POST',
        token: session.token,
        body: {
          success: !!result.ok,
          statusMessage: result.message,
          serialNo: result.serialNo || null,
          hardwareId: result.hardwareId || null
        }
      })
      await load(saved.id)
      if (result.ok) setMessage(result.message || 'Yazarkasa eşleşti.')
      else setError(result.message || 'Eşleşme başarısız')
    } catch (err) {
      setError(err.message || 'Eşleşme isteği başarısız. Masaüstü Hugin köprüsü bu kasada açık olsun.')
    } finally {
      setTesting(false)
    }
  }

  async function installAgent() {
    setInstalling(true)
    setError('')
    setMessage('Ajan aranıyor...')
    try {
      const woke = await ensureHuginAgent()
      if (woke.ok) {
        setAgentOnline(true)
        setMessage('Ajan çalışıyor. Eşleşmeyi test edebilirsin.')
        return
      }
      const link = document.createElement('a')
      link.href = '/agent/HizliSatisAgent-Kur.zip'
      link.download = 'HizliSatisAgent-Kur.zip'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setMessage('Kurulum dosyası indi. Zip’i aç, Kur dosyasına bir kez bas.')
    } finally {
      setInstalling(false)
    }
  }

  function changeLimit(value) {
    const digits = value.replace(/[^\d]/g, '')
    setReceiptLimit(digits)
    if (digits) localStorage.setItem('fiscal-receipt-limit', digits)
  }

  const s1 = isS1(form.model)
  const online = form.id > 0 && form.isPaired && form.isEnabled
  const cashierName = (id) => users.find((user) => String(user.id) === String(id))
  const field = 'w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500'

  return (
    <div className="fiscal-screen p-4 md:p-6">
      <div className="bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 !mb-0">ÖKC Yazarkasa &amp; Donanım Entegrasyonu</h1>
              <p className="text-sm text-slate-500 mt-0.5">Hugin fiziksel yazarkasa bağlantısı (T300 / FP-300), otomatik mali fiş basımı ve çevre birimleri.</p>
            </div>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold border ${online ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
            <span className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {online ? 'Yazarkasa Çevrimiçi' : 'Yazarkasa Çevrimdışı'}
          </span>
        </div>

        <form onSubmit={save} className="m-4 rounded-2xl bg-sky-50 border border-sky-100 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <label className="block text-xs font-semibold text-slate-500">
              Cihaz Modeli
              <select value={form.model} onChange={(e) => changeModel(e.target.value)} className={`${field} font-semibold`}>
                {MODELS.map((model) => <option key={model} value={model}>{model}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Bağlantı Türü
              <select value={form.connectionType} onChange={(e) => setField('connectionType', e.target.value)} className={field}>
                <option value="IP">Ethernet (Ağ IP / TCP Port)</option>
                <option value="COM">Seri Port (USB / COM Port)</option>
              </select>
            </label>
            {form.connectionType === 'IP' ? (
              <>
                <label className="block text-xs font-semibold text-slate-500">
                  Yazarkasa IP Adresi
                  <input value={form.deviceHost} onChange={(e) => setField('deviceHost', e.target.value)} placeholder="192.168.1.23" className={field} required />
                </label>
                <label className="block text-xs font-semibold text-slate-500">
                  TCP Port
                  <input type="number" value={form.devicePort} onChange={(e) => setField('devicePort', e.target.value)} className={field} />
                </label>
              </>
            ) : (
              <>
                <label className="block text-xs font-semibold text-slate-500">
                  COM Port
                  <select value={form.comPort} onChange={(e) => setField('comPort', e.target.value)} className={field}>
                    {COM_PORTS.map((port) => <option key={port} value={port}>{port}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-500">
                  Baudrate
                  <select value={form.baudRate} onChange={(e) => setField('baudRate', e.target.value)} className={field}>
                    <option value="115200">115200</option>
                    <option value="57600">57600</option>
                    <option value="38400">38400</option>
                    <option value="9600">9600</option>
                  </select>
                </label>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <label className="block text-xs font-semibold text-slate-500">
              Kasiyer
              <select value={form.userId} onChange={(e) => setField('userId', e.target.value)} className={field}>
                <option value="">Kasiyer seç</option>
                {users.map((user) => (
                  <option key={user.id} value={String(user.id)}>{user.displayName || user.username}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Kasa Adı
              <input value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Kasa 1" className={field} required />
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Cihaz Mali Sicil No
              <input value={form.serialNo} onChange={(e) => setField('serialNo', e.target.value)} placeholder="FU00022547" className={field} />
            </label>
            <label className="block text-xs font-semibold text-slate-500 xl:col-span-1">
              Hugin PC Link Yazılım Kodu (X-SoftwareId)
              <input value={form.softwareId} onChange={(e) => setField('softwareId', e.target.value.toUpperCase())} maxLength={10} placeholder="Hugin PC Link Aktivasyon Kodu (Maks 10 Karakter)" className={field} />
            </label>
          </div>
          <p className="text-[11px] text-amber-600 -mt-2">Hugin S1 cihazındaki PC Link uygulamasında veya Hugin entegrasyon belgesindeki Yazılım Kodunu (Software ID) buraya giriniz.</p>
          {!users.length && !loading && <p className="text-xs text-rose-600">Kasiyer listesi boş. Kullanıcılar ekranından kasiyer ekleyince burada seçilir.</p>}

          <div className="rounded-2xl bg-violet-100 border border-violet-200 px-4 py-3 text-sm text-violet-900">
            <span className="font-black">Ethernet Canlı Eşleme Rehberi:</span> Hugin cihazınızın ekranından Menü → Eşleme (Pairing) → PC Eşleme seçeneğine giriniz. Cihaz ekranda eşleme beklerken aşağıdaki <strong>Bağlantıyı Test Et / Eşle</strong> düğmesine basın ve cihaz ekranındaki onayı (Giriş tuşu) onaylayınız.
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-sky-100 pt-3">
            <div>
              <div className="font-bold text-sm text-slate-800">Perakende Fiş Limiti (Mevzuat Üst Sınırı)</div>
              <p className="text-xs text-slate-500 mt-0.5">Bu tutarın üzerindeki satışlarda sistem faturalı satışa yönlendirir.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input value={receiptLimit} onChange={(e) => changeLimit(e.target.value)} className={`${field} w-28 text-right font-semibold`} />
              <span className="text-sm font-bold text-slate-600">TL</span>
            </div>
          </div>

          {message && <p className="text-sm text-emerald-700">{message}</p>}
          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={testPair} disabled={testing || saving} className="pair">
              {testing ? 'Eşleşiyor...' : 'Bağlantıyı Test Et / Eşle'}
            </button>
            <button type="submit" disabled={saving || testing} className="save">
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button type="button" onClick={() => { setMessage(''); setError(''); setForm(blank(devices.length + 1)) }}>
              Yeni yazarkasa
            </button>
            {s1 && !agentOnline && (
              <button type="button" onClick={installAgent} disabled={installing} className="!bg-amber-500 !border-amber-500 !text-white">
                {installing ? 'Hazırlanıyor...' : 'Ajanı kur'}
              </button>
            )}
          </div>
        </form>

        <div className="px-5 pb-5">
          <h2 className="text-sm font-black text-slate-800 mb-2">Eşleşen yazarkasalar</h2>
          {loading ? <p className="text-sm text-slate-500">Yükleniyor...</p> : devices.length === 0 ? (
            <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center">Henüz yazarkasa yok. Üstteki formu doldurup eşleyince burada listelenir.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs">
                  <tr>
                    <th className="text-left px-3 py-2">Kasa</th>
                    <th className="text-left px-3 py-2">Model</th>
                    <th className="text-left px-3 py-2">Kasiyer</th>
                    <th className="text-left px-3 py-2">Bağlantı</th>
                    <th className="text-left px-3 py-2">Durum</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {devices.map((row) => {
                    const user = cashierName(row.userId)
                    const link = row.connectionType === 'COM' ? row.comPort : `${row.deviceHost || '—'}:${row.devicePort}`
                    const active = form.id === row.id
                    return (
                      <tr key={row.id} className={active ? 'bg-sky-50' : 'bg-white'}>
                        <td className="px-3 py-2 font-bold text-slate-800">{row.name}</td>
                        <td className="px-3 py-2">{row.model}</td>
                        <td className="px-3 py-2">{user ? (user.displayName || user.username) : 'Seçilmedi'}</td>
                        <td className="px-3 py-2 font-mono text-xs">{link}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${row.isPaired ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                            {row.isPaired ? 'Eşleşti' : 'Eşleşmedi'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button type="button" onClick={() => { setMessage(''); setError(''); fill(row) }} className="icon !text-sky-700" title="Düzenle"><Pencil className="w-4 h-4 inline" /></button>
                          <button type="button" onClick={() => remove(row.id)} className="icon !text-rose-600" title="Sil"><Trash2 className="w-4 h-4 inline" /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
