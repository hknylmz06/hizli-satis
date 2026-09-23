import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

const empty = {
  deviceHost: '',
  devicePort: 4443,
  serialNo: '',
  softwareId: '',
  hardwareId: '',
  agentBaseUrl: 'http://127.0.0.1:5055',
  isEnabled: true,
  isPaired: false,
  lastStatus: '',
  lastPairedAt: null,
  deviceBaseUrl: null
}

export default function FiscalPairingPage() {
  const { session } = useAuth()
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [agentOnline, setAgentOnline] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await api('/api/fiscal/settings', { token: session.token })
      setForm({
        deviceHost: data.deviceHost || '',
        devicePort: data.devicePort || 4443,
        serialNo: data.serialNo || '',
        softwareId: data.softwareId || '',
        hardwareId: data.hardwareId || '',
        agentBaseUrl: data.agentBaseUrl || 'http://127.0.0.1:5055',
        isEnabled: data.isEnabled ?? true,
        isPaired: data.isPaired ?? false,
        lastStatus: data.lastStatus || '',
        lastPairedAt: data.lastPairedAt,
        deviceBaseUrl: data.deviceBaseUrl
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function pingAgent(baseUrl) {
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, { method: 'GET' })
      setAgentOnline(res.ok)
      return res.ok
    } catch {
      setAgentOnline(false)
      return false
    }
  }

  useEffect(() => {
    load().then(() => {})
  }, [])

  useEffect(() => {
    if (form.agentBaseUrl) pingAgent(form.agentBaseUrl)
  }, [form.agentBaseUrl])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const data = await api('/api/fiscal/settings', {
        method: 'PUT',
        token: session.token,
        body: {
          deviceHost: form.deviceHost,
          devicePort: Number(form.devicePort),
          serialNo: form.serialNo || null,
          softwareId: form.softwareId || null,
          hardwareId: form.hardwareId || null,
          agentBaseUrl: form.agentBaseUrl,
          isEnabled: form.isEnabled
        }
      })
      setForm((prev) => ({
        ...prev,
        ...data,
        serialNo: data.serialNo || '',
        softwareId: data.softwareId || '',
        hardwareId: data.hardwareId || ''
      }))
      setMessage('Ayarlar kaydedildi.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function testPair() {
    setTesting(true)
    setError('')
    setMessage('')
    const agentBase = (form.agentBaseUrl || 'http://127.0.0.1:5055').replace(/\/$/, '')

    const online = await pingAgent(agentBase)
    if (!online) {
      setError('Yerel ajan çalışmıyor. PC’de Hugin Agent’ı başlatın (port 5055).')
      setTesting(false)
      return
    }

    if (!form.deviceHost.trim()) {
      setError('Önce yazarkasa IP adresini yazın.')
      setTesting(false)
      return
    }

    try {
      const res = await fetch(`${agentBase}/pair/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceHost: form.deviceHost.trim(),
          devicePort: Number(form.devicePort) || 4443,
          serialNo: form.serialNo || null,
          softwareId: form.softwareId || null,
          hardwareId: form.hardwareId || null
        })
      })
      const result = await res.json()
      await api('/api/fiscal/pair-result', {
        method: 'POST',
        token: session.token,
        body: {
          success: !!result.ok,
          statusMessage: result.message || (result.ok ? 'Eşleşti' : 'Başarısız')
        }
      })
      await load()
      if (result.ok) setMessage(result.message)
      else setError(result.message || 'Eşleşme başarısız')
    } catch (err) {
      setError(err.message || 'Test isteği başarısız')
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <p>Yükleniyor...</p>

  return (
    <div>
      <h1>Yazarkasa Eşleştirme</h1>
      <p className="muted">
        Hugin S1 WiFi IP bilgisini girin. Test için bu PC’de yerel ajanın çalışması gerekir.
      </p>

      <div className="status-row">
        <span className={`pill ${form.isPaired ? 'ok' : 'warn'}`}>
          {form.isPaired ? 'Eşleşti' : 'Eşleşmedi'}
        </span>
        <span className={`pill ${agentOnline ? 'ok' : 'warn'}`}>
          Ajan: {agentOnline === null ? '...' : agentOnline ? 'Çevrimiçi' : 'Kapalı'}
        </span>
        {form.deviceBaseUrl && <span className="pill">Cihaz: {form.deviceBaseUrl}</span>}
      </div>

      <form className="stack panel fiscal-form" onSubmit={save}>
        <label>
          Yazarkasa IP / Host
          <input
            value={form.deviceHost}
            onChange={(e) => setField('deviceHost', e.target.value)}
            placeholder="Örn: 192.168.1.45"
            required
          />
        </label>
        <label>
          Port
          <input
            type="number"
            value={form.devicePort}
            onChange={(e) => setField('devicePort', e.target.value)}
            min="1"
            max="65535"
          />
        </label>
        <label>
          Seri No (opsiyonel)
          <input value={form.serialNo} onChange={(e) => setField('serialNo', e.target.value)} />
        </label>
        <label>
          Software Id (opsiyonel)
          <input value={form.softwareId} onChange={(e) => setField('softwareId', e.target.value)} />
        </label>
        <label>
          Hardware Id (opsiyonel)
          <input value={form.hardwareId} onChange={(e) => setField('hardwareId', e.target.value)} />
        </label>
        <label>
          Yerel Ajan Adresi
          <input
            value={form.agentBaseUrl}
            onChange={(e) => setField('agentBaseUrl', e.target.value)}
            placeholder="http://127.0.0.1:5055"
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.isEnabled}
            onChange={(e) => setField('isEnabled', e.target.checked)}
          />
          Satışta yazarkasayı kullan
        </label>

        {form.lastStatus && <p className="muted">Son durum: {form.lastStatus}</p>}
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}

        <div className="action-row">
          <button className="primary" type="submit" disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          <button type="button" onClick={testPair} disabled={testing}>
            {testing ? 'Test ediliyor...' : 'Eşleşmeyi Test Et'}
          </button>
        </div>
      </form>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2>Nasıl kullanılır?</h2>
        <ol className="help-list">
          <li>Yazarkasa ile PC aynı WiFi’de olsun.</li>
          <li>Bu PC’de ajanı çalıştır: <code>dotnet run --project hugin-agent</code></li>
          <li>Yukarıya yazarkasa IP’sini yaz → Kaydet → Eşleşmeyi Test Et.</li>
        </ol>
      </section>
    </div>
  )
}
