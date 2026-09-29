import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

const empty = {
  deviceHost: '192.168.1.24',
  devicePort: 4443,
  serialNo: 'FU00022547',
  softwareId: '9217033991',
  hardwareId: 'ABCD1234',
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
        hardwareId: data.hardwareId || 'ABCD1234',
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
    const base = baseUrl.replace(/\/$/, '')
    try {
      const res = await fetch(`${base}/health`, { method: 'GET', cache: 'no-store' })
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
      setError('Yerel ajan çalışmıyor. PC’de publish-agent.ps1 çalıştırın (port 5055).')
      setTesting(false)
      return
    }

    if (!form.deviceHost.trim()) {
      setError('Önce yazarkasa IP adresini yazın.')
      setTesting(false)
      return
    }
    if (!form.softwareId.trim()) {
      setError('Software Id = firma VKN zorunlu.')
      setTesting(false)
      return
    }

    // Masaüstü Hızlı Satış köprüsü ile aynı varsayılan: ABCD1234
    const hardwareId = (form.hardwareId || 'ABCD1234').trim()

    try {
      const res = await fetch(`${agentBase}/pair/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceHost: form.deviceHost.trim(),
          devicePort: Number(form.devicePort) || 4443,
          serialNo: form.serialNo || null,
          softwareId: form.softwareId.trim() || '9217033991',
          hardwareId
        })
      })
      const result = await res.json()
      await api('/api/fiscal/pair-result', {
        method: 'POST',
        token: session.token,
        body: {
          success: !!result.ok,
          statusMessage: result.message || (result.ok ? 'Eşleşti' : 'Başarısız'),
          serialNo: result.serialNo || null,
          hardwareId: result.hardwareId || hardwareId
        }
      })
      if (result.ok || result.hardwareId || result.serialNo) {
        await api('/api/fiscal/settings', {
          method: 'PUT',
          token: session.token,
          body: {
            deviceHost: form.deviceHost,
            devicePort: Number(form.devicePort),
            serialNo: result.serialNo || form.serialNo || null,
            softwareId: form.softwareId || '9217033991',
            hardwareId: result.hardwareId || hardwareId,
            agentBaseUrl: form.agentBaseUrl,
            isEnabled: true
          }
        })
      }
      await load()
      if (result.ok) {
        setMessage(result.message + (result.serialNo ? ` Seri: ${result.serialNo}` : ''))
      } else {
        setError(result.message || 'Eşleşme başarısız')
      }
    } catch (err) {
      setError(err.message || 'Test isteği başarısız')
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <p>Yükleniyor...</p>

  return (
    <div className="p-6">
      <h1>Yazarkasa Eşleştirme</h1>
      <p className="muted">
        Masaüstü Hızlı Satış ile aynı kimlik kullanılır (SoftwareId + HardwareId ABCD1234).
        IP’yi yazıp eşleşmeyi test etmen yeterli.
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
            placeholder="Örn: 192.168.1.24"
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
          Software Id (firma VKN)
          <input
            value={form.softwareId}
            onChange={(e) => setField('softwareId', e.target.value)}
            placeholder="Örn: 9217033991"
            required
          />
        </label>
        <label>
          Seri No (boş bırakılabilir — eşleşmede otomatik gelir)
          <input
            value={form.serialNo}
            onChange={(e) => setField('serialNo', e.target.value)}
            placeholder="FU..."
          />
        </label>
        <p className="muted">
          Hardware Id masaüstü köprüden alındı: <code>ABCD1234</code> (elle girmen gerekmez).
        </p>
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
        <h2>Doğru eşleşme</h2>
        <ol className="help-list">
          <li>Yazarkasa ile bu PC aynı Wi‑Fi’de olsun.</li>
          <li>IP + VKN kaydet → <strong>Eşleşmeyi Test Et</strong>.</li>
          <li>Başarılı olunca satışta fiş basılır.</li>
        </ol>
      </section>
    </div>
  )
}
