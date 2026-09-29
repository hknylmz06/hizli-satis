import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { ensureHuginAgent } from '../huginAgent'

const MODELS = [
  { id: 'HUGIN S1', label: 'HUGIN S1 (S1 ÖKC / Yazar Kasa)' },
  { id: 'HUGIN T300', label: 'HUGIN T300' },
  { id: 'HUGIN FP-300', label: 'HUGIN FP-300' },
  { id: 'HUGIN GENEL', label: 'HUGIN ÖKC (Genel)' }
]

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

  function fill(row) {
    setForm({
      id: row.id,
      name: row.name || '',
      model: row.model || 'HUGIN S1',
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
      userId: row.userId || '',
      isEnabled: row.isEnabled ?? true,
      isPaired: row.isPaired ?? false,
      lastStatus: row.lastStatus || ''
    })
  }

  async function load(selectId) {
    setLoading(true)
    setError('')
    try {
      const data = await api('/api/fiscal/devices', { token: session.token })
      const rows = data.devices || []
      setDevices(rows)
      setUsers(data.users || [])
      const picked = rows.find((row) => row.id === selectId) || rows[0]
      if (picked) fill(picked)
      else setForm(blank(1))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

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
      isEnabled: form.isEnabled
    }
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const path = form.id ? `/api/fiscal/devices/${form.id}` : '/api/fiscal/devices'
      const data = await api(path, {
        method: form.id ? 'PUT' : 'POST',
        token: session.token,
        body: body()
      })
      setMessage('Yazarkasa kaydedildi.')
      await load(data.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!form.id) return
    setError('')
    setMessage('')
    try {
      await api(`/api/fiscal/devices/${form.id}`, { method: 'DELETE', token: session.token })
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
      let saved = form
      if (!form.id) {
        saved = await api('/api/fiscal/devices', { method: 'POST', token: session.token, body: body() })
        fill(saved)
      }
      const s1 = isS1(saved.model || form.model)
      let result
      if (s1) {
        const agentBase = (form.agentBaseUrl || 'http://127.0.0.1:5055').replace(/\/$/, '')
        const online = await fetch(`${agentBase}/health`, { cache: 'no-store' }).then((res) => res.ok).catch(() => false)
        setAgentOnline(online)
        if (!online) throw new Error('S1 ajanı kapalı. Ajanı kur düğmesine bas.')
        const res = await fetch(`${agentBase}/pair/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceHost: form.deviceHost.trim(),
            devicePort: Number(form.devicePort) || 4443,
            serialNo: form.serialNo || null,
            softwareId: (form.softwareId || '').trim() || '9217033991',
            hardwareId: (form.hardwareId || 'ABCD1234').trim()
          })
        })
        result = await res.json()
      } else {
        const bridge = (form.bridgeBaseUrl || 'http://127.0.0.1:8989').replace(/\/$/, '')
        const res = await fetch(`${bridge}/api/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            portName: form.comPort || 'COM1',
            baudRate: Number(form.baudRate) || 115200,
            fiscalId: form.serialNo || '',
            model: form.model,
            softwareId: form.softwareId || '',
            hardwareId: form.hardwareId || 'ABCD1234',
            connectionType: form.connectionType || 'IP',
            ip: form.deviceHost || '',
            tcpPort: Number(form.devicePort) || 4444
          })
        })
        const data = await res.json()
        result = {
          ok: !!(data.connected && !data.simulation),
          message: data.message || (data.connected ? 'Eşleşti' : 'Eşleşme başarısız'),
          serialNo: form.serialNo || null,
          hardwareId: form.hardwareId || 'ABCD1234'
        }
        if (data.simulation) result.message = 'Simülasyon açıldı. Canlı eşleşme için yazarkasayı bağla.'
      }

      const id = saved.id || form.id
      await api(`/api/fiscal/devices/${id}/pair-result`, {
        method: 'POST',
        token: session.token,
        body: {
          success: !!result.ok,
          statusMessage: result.message,
          serialNo: result.serialNo || null,
          hardwareId: result.hardwareId || null
        }
      })
      await load(id)
      if (result.ok) setMessage(result.message)
      else setError(result.message || 'Eşleşme başarısız')
    } catch (err) {
      setError(err.message || 'Eşleşme isteği başarısız')
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

  if (loading) return <p>Yükleniyor...</p>

  const s1 = isS1(form.model)
  const cashierName = (id) => users.find((user) => user.id === id)

  return (
    <div className="p-6">
      <h1>Yazarkasa Eşleştirme</h1>
      <p className="muted">
        Masaüstündeki gibi S1, T300 ve FP-300. Aynı firmaya birden fazla yazarkasa ekle, her kasayı bir kasiyere bağla.
      </p>

      <div className="status-row">
        <button type="button" className="primary" onClick={() => { setMessage(''); setError(''); setForm(blank(devices.length + 1)) }}>
          Yazarkasa ekle
        </button>
        {s1 && !agentOnline && (
          <button type="button" className="primary" onClick={installAgent} disabled={installing}>
            {installing ? 'Hazırlanıyor...' : 'Ajanı kur'}
          </button>
        )}
      </div>

      <div className="panel" style={{ marginTop: '1rem' }}>
        {devices.length === 0 && <p className="muted">Henüz yazarkasa yok.</p>}
        {devices.map((row) => {
          const user = cashierName(row.userId)
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => fill(row)}
              className="ghost"
              style={{ marginRight: '0.5rem', marginBottom: '0.5rem', borderColor: form.id === row.id ? '#10b981' : undefined }}
            >
              {row.name} · {row.model} · {user ? user.displayName : 'Kasiyer seçilmedi'} · {row.isPaired ? 'Eşleşti' : 'Eşleşmedi'}
            </button>
          )
        })}
      </div>

      <form className="stack panel fiscal-form" onSubmit={save} style={{ marginTop: '1rem' }}>
        <label>
          Kasa adı
          <input value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Kasa 1" required />
        </label>
        <label>
          Kasiyer
          <select value={form.userId} onChange={(e) => setField('userId', e.target.value)}>
            <option value="">Seçilmedi</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.displayName || user.username}</option>
            ))}
          </select>
        </label>
        <label>
          Cihaz modeli
          <select value={form.model} onChange={(e) => changeModel(e.target.value)}>
            {MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
          </select>
        </label>
        <label>
          Bağlantı türü
          <select value={form.connectionType} onChange={(e) => setField('connectionType', e.target.value)}>
            <option value="IP">Ethernet (Ağ IP / TCP Port)</option>
            <option value="COM">Seri Port (USB / COM Port)</option>
          </select>
        </label>
        {form.connectionType === 'IP' ? (
          <>
            <label>
              Yazarkasa IP adresi
              <input value={form.deviceHost} onChange={(e) => setField('deviceHost', e.target.value)} placeholder="Örn: 192.168.1.150" required />
            </label>
            <label>
              TCP port
              <input type="number" value={form.devicePort} onChange={(e) => setField('devicePort', e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <label>
              COM port
              <select value={form.comPort} onChange={(e) => setField('comPort', e.target.value)}>
                {['COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9'].map((port) => (
                  <option key={port} value={port}>{port}</option>
                ))}
              </select>
            </label>
            <label>
              Baudrate
              <select value={form.baudRate} onChange={(e) => setField('baudRate', e.target.value)}>
                <option value="115200">115200 (Standart)</option>
                <option value="57600">57600</option>
                <option value="38400">38400</option>
                <option value="9600">9600</option>
              </select>
            </label>
          </>
        )}
        <label>
          Cihaz mali sicil no
          <input value={form.serialNo} onChange={(e) => setField('serialNo', e.target.value)} placeholder="Örn: FU00022547" />
        </label>
        <label>
          Hugin PC Link yazılım kodu
          <input value={form.softwareId} onChange={(e) => setField('softwareId', e.target.value.toUpperCase())} maxLength={20} placeholder="Yazılım kodu" />
        </label>
        <p className="muted">Hardware Id masaüstü ile aynı: ABCD1234</p>
        {s1 ? (
          <label>
            Yerel ajan adresi
            <input value={form.agentBaseUrl} onChange={(e) => setField('agentBaseUrl', e.target.value)} />
          </label>
        ) : (
          <label>
            Masaüstü köprü adresi
            <input value={form.bridgeBaseUrl} onChange={(e) => setField('bridgeBaseUrl', e.target.value)} />
          </label>
        )}
        <label className="checkbox">
          <input type="checkbox" checked={form.isEnabled} onChange={(e) => setField('isEnabled', e.target.checked)} />
          Satışta bu yazarkasayı kullan
        </label>
        {form.lastStatus && <p className="muted">Son durum: {form.lastStatus}</p>}
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        <div className="action-row">
          <button className="primary" type="submit" disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
          <button type="button" onClick={testPair} disabled={testing}>{testing ? 'Eşleşiyor...' : 'Cihazla eşleştir ve bağlan'}</button>
          {form.id > 0 && <button type="button" onClick={remove}>Sil</button>}
        </div>
      </form>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2>Nasıl bağlanır</h2>
        <ol className="help-list">
          <li>T300 ve FP-300 için bu kasada masaüstü Hugin köprüsü açık olsun. Port 4444, bağlantı Ethernet.</li>
          <li>Yazarkasada Menü, Eşleme, PC Eşleme açıkken <strong>Cihazla eşleştir ve bağlan</strong> de.</li>
          <li>S1 modeli 4443 portundan ajan ile eşleşir. Ajan kapalıysa <strong>Ajanı kur</strong>.</li>
          <li>Kasiyer 1’e bir yazarkasa, kasiyer 2’ye diğerini seç. Giriş yapan kasiyer kendi cihazına fiş basar.</li>
        </ol>
      </section>
    </div>
  )
}
