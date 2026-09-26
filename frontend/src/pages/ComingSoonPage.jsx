export default function ComingSoonPage({ title, text }) {
  return (
    <div className="p-6">
      <div className="max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-8">
        <h1 className="text-xl font-black text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">{text || 'Bu ekran masaüstü programdakiyle aynı menüde. Satış, stok, cari ve rapor şu an çalışıyor; bu modül sıradaki adım.'}</p>
      </div>
    </div>
  )
}
