import { useState } from 'react'
import { readBarcodeLabelSettings, saveBarcodeLabelSettings } from '../barcodeLabel'

const A4 = [
  { id: '25', cols: 5, rows: 5, title: 'A4 · 25 etiket', hint: '5 sütun, 5 satır' },
  { id: '30', cols: 5, rows: 6, title: 'A4 · 30 etiket', hint: '5 sütun, 6 satır' }
]

const LABELS = [
  { width: 40, height: 30, title: '40 × 30 mm' },
  { width: 50, height: 30, title: '50 × 30 mm' },
  { width: 60, height: 40, title: '60 × 40 mm' },
  { width: 80, height: 40, title: '80 × 40 mm' }
]

export default function BarcodeLabelSettingsPage({ embedded = false }) {
  const [form, setForm] = useState(readBarcodeLabelSettings)
  const [message, setMessage] = useState('')

  function patch(next) {
    const saved = saveBarcodeLabelSettings(next)
    setForm(saved)
    setMessage('Barkod etiketi ayarı kaydedildi. Stok kartından yazdırınca bu ölçü kullanılır.')
  }

  const field = 'mt-1 w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900'

  return (
    <div className={embedded ? 'fiscal-screen' : 'fiscal-screen p-4 md:p-6'}>
      <div className="max-w-3xl mx-auto bg-white border border-sky-100 rounded-3xl shadow-sm p-5 md:p-6 space-y-4">
        <div>
          <h1>Barkod Etiketi</h1>
          <p className="text-sm text-slate-500">Stoktan seçtiğin her üründen bir etiket basılır. Raf etiketindeki satırlar buradan açılır: birim, yerli üretim, fiyat, KDV dahil birim fiyat, fiyat değişiklik tarihi, menşei ve firma adı. Tam yazı 80 × 40 mm etikete sığar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={form.mode === 'a4' ? 'paper-on' : ''} onClick={() => patch({ mode: 'a4' })}>A4 sayfa</button>
          <button type="button" className={form.mode === 'label' ? 'paper-on' : ''} onClick={() => patch({ mode: 'label' })}>Etiket boyutu</button>
        </div>
        {form.mode === 'a4' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {A4.map((item) => {
                const on = form.cols === item.cols && form.rows === item.rows
                return (
                  <button key={item.id} type="button" className={on ? 'paper-on' : ''} onClick={() => patch({ mode: 'a4', cols: item.cols, rows: item.rows })}>
                    {item.title}
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-600">
                Sütun
                <input type="number" min="1" max="8" value={form.cols} onChange={(e) => patch({ cols: Number(e.target.value) })} className={field} />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Satır
                <input type="number" min="1" max="12" value={form.rows} onChange={(e) => patch({ rows: Number(e.target.value) })} className={field} />
              </label>
            </div>
            <p className="text-sm text-slate-600">Bir A4 sayfaya en fazla <strong>{form.cols * form.rows}</strong> farklı ürün sığar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {LABELS.map((item) => {
                const on = form.labelWidth === item.width && form.labelHeight === item.height
                return (
                  <button key={item.title} type="button" className={on ? 'paper-on' : ''} onClick={() => patch({ mode: 'label', labelWidth: item.width, labelHeight: item.height })}>
                    {item.title}
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-600">
                Genişlik (mm)
                <input type="number" min="20" max="120" value={form.labelWidth} onChange={(e) => patch({ labelWidth: Number(e.target.value) })} className={field} />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Yükseklik (mm)
                <input type="number" min="12" max="160" value={form.labelHeight} onChange={(e) => patch({ labelHeight: Number(e.target.value) })} className={field} />
              </label>
            </div>
            <p className="text-sm text-slate-600">Her barkod ayrı sayfa olarak <strong>{form.labelWidth} × {form.labelHeight} mm</strong> çıkar.</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={form.showName ? 'paper-on' : ''} onClick={() => patch({ showName: !form.showName })}>Ürün adı {form.showName ? 'açık' : 'kapalı'}</button>
          <button type="button" className={form.showUnit ? 'paper-on' : ''} onClick={() => patch({ showUnit: !form.showUnit })}>Birim miktarı {form.showUnit ? 'açık' : 'kapalı'}</button>
          <button type="button" className={form.showDomestic ? 'paper-on' : ''} onClick={() => patch({ showDomestic: !form.showDomestic })}>Yerli üretim {form.showDomestic ? 'açık' : 'kapalı'}</button>
          <button type="button" className={form.showPrice ? 'paper-on' : ''} onClick={() => patch({ showPrice: !form.showPrice })}>Fiyat {form.showPrice ? 'açık' : 'kapalı'}</button>
          <button type="button" className={form.showUnitPrice ? 'paper-on' : ''} onClick={() => patch({ showUnitPrice: !form.showUnitPrice })}>KDV dahil birim fiyat {form.showUnitPrice ? 'açık' : 'kapalı'}</button>
          <button type="button" className={form.showPriceDate ? 'paper-on' : ''} onClick={() => patch({ showPriceDate: !form.showPriceDate })}>Fiyat değişiklik tarihi {form.showPriceDate ? 'açık' : 'kapalı'}</button>
          <button type="button" className={form.showOrigin ? 'paper-on' : ''} onClick={() => patch({ showOrigin: !form.showOrigin })}>Menşei {form.showOrigin ? 'açık' : 'kapalı'}</button>
          <button type="button" className={form.showCompany ? 'paper-on' : ''} onClick={() => patch({ showCompany: !form.showCompany })}>Firma adı {form.showCompany ? 'açık' : 'kapalı'}</button>
        </div>
        {message && <p className="text-sm text-emerald-700">{message}</p>}
      </div>
    </div>
  )
}
