import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

export default function ReportsPage() {
  const { session } = useAuth()
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/api/reports/daily', { token: session.token })
      .then(setReport)
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!report) return <p>Yükleniyor...</p>

  return (
    <div>
      <h1>Günlük Rapor</h1>
      <p className="muted">{new Date(report.date).toLocaleDateString('tr-TR')}</p>

      <div className="kpi-row">
        <div>
          <span>Ciro</span>
          <strong>{report.ciro.toFixed(2)} ₺</strong>
        </div>
        <div>
          <span>Kâr</span>
          <strong>{report.kar.toFixed(2)} ₺</strong>
        </div>
        <div>
          <span>Satış Adedi</span>
          <strong>{report.saleCount}</strong>
        </div>
      </div>

      <div className="split">
        <section className="panel">
          <h2>Ödeme Dağılımı</h2>
          <ul>
            {(report.byPayment || []).map((p) => (
              <li key={p.method}>{p.method}: {p.total.toFixed(2)} ₺ ({p.count})</li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>En Çok Satanlar</h2>
          <ul>
            {(report.topProducts || []).map((p) => (
              <li key={p.productName}>
                {p.productName} — {p.quantity} adet / {p.revenue.toFixed(2)} ₺
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
