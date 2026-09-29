import { useState } from 'react'
import { Clock, Download, Mail, MessageCircle, Monitor, Phone, Send, ShieldCheck } from 'lucide-react'

const PHONE = '0541 319 63 37'
const PHONE_LINK = '905413196337'
const EMAIL = 'netcombilgisayar06@gmail.com'

const SUBJECTS = ['Teknik Destek & Arıza', 'Kurulum', 'Eğitim', 'Diğer']

const TOOLS = [
  { id: 'ad', mark: 'AD', name: 'AnyDesk Uzaktan Masaüstü', hint: 'Hızlı ve güvenli uzaktan bağlantı aracı', tone: 'bg-rose-100 text-rose-500', href: 'https://anydesk.com/tr/downloads' },
  { id: 'tv', mark: 'TV', name: 'TeamViewer Destek', hint: 'Alternatif uzaktan kontrol yazılımı', tone: 'bg-sky-100 text-sky-600', href: 'https://www.teamviewer.com/tr/download/windows/' }
]

export default function SupportPage() {
  const [form, setForm] = useState({ name: '', phone: '', subject: SUBJECTS[0], message: '' })
  const [error, setError] = useState('')

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function text() {
    return [
      `Ad: ${form.name.trim()}`,
      `Telefon: ${form.phone.trim()}`,
      `Konu: ${form.subject}`,
      '',
      form.message.trim()
    ].join('\n')
  }

  function ready() {
    if (!form.name.trim() || !form.phone.trim() || !form.message.trim()) {
      setError('Ad, telefon ve mesaj gerekli.')
      return false
    }
    setError('')
    return true
  }

  function sendMail(event) {
    event.preventDefault()
    if (!ready()) return
    const href = `mailto:${EMAIL}?subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(text())}`
    window.location.href = href
  }

  function sendWhatsapp(event) {
    event.preventDefault()
    if (!ready()) return
    window.open(`https://wa.me/${PHONE_LINK}?text=${encodeURIComponent(text())}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="support-page space-y-4">
      <header className="rounded-3xl border border-white bg-gradient-to-br from-white to-emerald-50/80 shadow-sm px-5 py-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white">7/24 Müşteri Destek & Hizmet Merkezi</span>
          <h1 className="mt-3">NETCOM Teknik Destek & İletişim</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-500">
            Otomasyon, yazarkasa, barkod sistemleri ve yazılım ihtiyaçlarınız için uzman teknik ekibimiz her an yanınızda.
            Aşağıdaki kanallardan bize ulaşabilir veya uzaktan yardım alabilirsiniz.
          </p>
        </div>
        <div className="shrink-0 self-start sm:self-center rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3">
          <img src="/netcom-logo.png" alt="Netcom" className="h-16 w-auto" />
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <article className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4">
          <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Phone className="w-4 h-4" /></span>
          <h3 className="mt-3">Telefon ile Destek</h3>
          <p className="mt-1 text-xs text-slate-500">Müşteri temsilcimize direkt ulaşın.</p>
          <a className="mt-3 inline-block text-sm font-bold text-emerald-600" href={`tel:+${PHONE_LINK}`}>{PHONE}</a>
        </article>
        <article className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4">
          <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><MessageCircle className="w-4 h-4" /></span>
          <h3 className="mt-3">WhatsApp Destek Hattı</h3>
          <p className="mt-1 text-xs text-slate-500">{PHONE} üzerinden anlık destek.</p>
          <a className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-emerald-600" href={`https://wa.me/${PHONE_LINK}`} target="_blank" rel="noreferrer">
            WhatsApp Sohbeti Başlat <span aria-hidden>→</span>
          </a>
        </article>
        <article className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4">
          <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><Mail className="w-4 h-4" /></span>
          <h3 className="mt-3">E-Posta Desteği</h3>
          <p className="mt-1 text-xs text-slate-500">Kurumsal talep ve sorunlarınız için.</p>
          <a className="mt-3 inline-block text-sm font-bold text-sky-600 break-all" href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </article>
        <article className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4">
          <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-amber-50 text-amber-500"><Clock className="w-4 h-4" /></span>
          <h3 className="mt-3">Mesai Saatleri</h3>
          <p className="mt-1 text-xs text-slate-500">Ofis ve Saha Destek Saatleri</p>
          <p className="mt-3 text-sm font-bold text-amber-500">Hafta İçi & Cumartesi 08:30 – 20:00</p>
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-3 items-start">
        <article className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4 space-y-3">
          <h2 className="inline-flex items-center gap-2"><Monitor className="w-4 h-4 text-slate-500" /> Uzaktan Yardım Programları</h2>
          <p className="text-xs leading-relaxed text-slate-500">Teknisyenimizin bilgisayarınıza bağlanabilmesi için AnyDesk veya TeamViewer programını indirin.</p>
          {TOOLS.map((tool) => (
            <div key={tool.id} className="flex items-center gap-3 rounded-2xl bg-slate-100/80 px-3 py-3">
              <span className={`inline-flex w-10 h-10 shrink-0 items-center justify-center rounded-xl text-xs font-black ${tool.tone}`}>{tool.mark}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-800">{tool.name}</span>
                <span className="block text-[11px] text-slate-500">{tool.hint}</span>
              </span>
              <a className="dl" href={tool.href} target="_blank" rel="noreferrer" aria-label={`${tool.name} indir`}>
                <Download className="w-4 h-4" />
              </a>
            </div>
          ))}
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-3 py-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><ShieldCheck className="w-4 h-4" /> Güvenlik Bilgilendirmesi</p>
            <p className="mt-1 text-[11px] leading-relaxed text-emerald-800/80">Uzaktan bağlantı esnasında ekranda çıkan onay kodunu teknisyenimize iletmeden kimse bilgisayarınıza erişemez.</p>
          </div>
        </article>

        <form className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4 sm:p-5 space-y-3" onSubmit={sendMail}>
          <h2 className="inline-flex items-center gap-2"><Send className="w-4 h-4 text-emerald-600" /> Destek & Arıza Talebi Gönder</h2>
          <p className="text-xs text-slate-500">Sorununuzu veya talebinizi iletin, destek ekibimiz en kısa sürede sizi arasın.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label>
              Ad Soyad / Firma Adı *
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Örn: Market A.Ş. / Ahmet Yılmaz" required />
            </label>
            <label>
              Telefon Numarası *
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="05XX XXX XX XX" required />
            </label>
          </div>
          <label>
            Destek Konusu
            <select value={form.subject} onChange={(e) => set('subject', e.target.value)}>
              {SUBJECTS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Mesaj / Sorun Detayı *
            <textarea value={form.message} onChange={(e) => set('message', e.target.value)} placeholder="Yaşadığınız sorunu veya talebinizi detaylıca açıklayınız..." required />
          </label>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button type="submit" className="send-mail"><Mail className="w-4 h-4" /> E-Posta ile Gönder</button>
            <button type="button" className="send-wa" onClick={sendWhatsapp}><MessageCircle className="w-4 h-4" /> WhatsApp ile Talebi Gönder</button>
          </div>
        </form>
      </section>
    </div>
  )
}
