import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Cpu, Barcode, Search, ShoppingCart, Package, Trash2, X, Minus, Plus,
  Banknote, CreditCard, Sparkles, Star, Wallet, Layers, FileText, RotateCcw,
  AlertCircle, CheckCircle, Users, Scale
} from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { allows } from '../permissions'

const emptySlots = () => [{ items: [] }, { items: [] }, { items: [] }]

const IMAGE_PRESETS = [
  { test: /ekmek/i, url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=60' },
  { test: /su|water/i, url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=400&q=60' },
  { test: /s[uü]t/i, url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=60' },
  { test: /çay|kahve|cay/i, url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=400&q=60' }
]

const DEPARTMENTS = [
  { id: 'fallback-1', slot: 1, name: 'GIDA %1', vat: 1, color: '#f59e0b' },
  { id: 'fallback-2', slot: 2, name: 'GIDA %10', vat: 10, color: '#10b981' },
  { id: 'fallback-3', slot: 3, name: 'GENEL %20', vat: 20, color: '#6366f1' }
]

function money(value) {
  return `₺${Number(value || 0).toFixed(2)}`
}

function presetImage(name) {
  return IMAGE_PRESETS.find((item) => item.test.test(name || ''))?.url || ''
}

function isWeighedUnit(unit) {
  const value = String(unit || '').trim().toLowerCase()
  return value === 'kg' || value === 'kilogram' || value === 'gram' || value === 'gr'
}

function formatQty(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return String(Number(number.toFixed(3)))
}

const WEIGHT_PRESETS = [
  { label: '50g', gram: 50, kg: 0.05 },
  { label: '100g', gram: 100, kg: 0.1 },
  { label: '250g', gram: 250, kg: 0.25 },
  { label: '500g', gram: 500, kg: 0.5 },
  { label: '750g', gram: 750, kg: 0.75 },
  { label: '1 Kg', gram: 1000, kg: 1 },
  { label: '1.5 Kg', gram: 1500, kg: 1.5 },
  { label: '2 Kg', gram: 2000, kg: 2 },
  { label: '3 Kg', gram: 3000, kg: 3 },
  { label: '5 Kg', gram: 5000, kg: 5 }
]

export default function QuickSalePage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [slots, setSlots] = useState(emptySlots)
  const [active, setActive] = useState(0)
  const [products, setProducts] = useState([])
  const [departments, setDepartments] = useState(DEPARTMENTS)
  const [barcode, setBarcode] = useState('')
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Nakit')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [fiscal, setFiscal] = useState(null)
  const [middleTab, setMiddleTab] = useState('quick')
  const [images, setImages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos-images') || '{}') } catch { return {} }
  })
  const [discountType, setDiscountType] = useState('TL')
  const [discount, setDiscount] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [splitOpen, setSplitOpen] = useState(false)
  const [splitCash, setSplitCash] = useState('')
  const [splitCard, setSplitCard] = useState('')
  const [deptAmount, setDeptAmount] = useState('')
  const [askCustomer, setAskCustomer] = useState(false)
  const [shortcuts, setShortcuts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos-shortcuts') || '[]') } catch { return [] }
  })
  const [categories, setCategories] = useState([])
  const [categoryTabs, setCategoryTabs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos-category-tabs') || '[]') } catch { return [] }
  })
  const [categoryPins, setCategoryPins] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos-category-pins') || '{}') } catch { return {} }
  })
  const [board, setBoard] = useState('quick')
  const [categoryPicker, setCategoryPicker] = useState(false)
  const [shortcutOpen, setShortcutOpen] = useState(false)
  const [variantAsk, setVariantAsk] = useState(null)
  const [missingBarcode, setMissingBarcode] = useState('')
  const [weightAsk, setWeightAsk] = useState(null)
  const [shortcutMode, setShortcutMode] = useState('select')
  const [shortcutSearch, setShortcutSearch] = useState('')
  const [shortcutForm, setShortcutForm] = useState({ name: '', barcode: '', salePrice: '', vatRate: '20', stockQuantity: '100', imageUrl: '' })
  const [shortcutError, setShortcutError] = useState('')
  const inputRef = useRef(null)
  const searchRef = useRef(null)

  const canDiscount = allows(session, 'can_discount')
  const canClear = allows(session, 'can_clear_cart')
  const canCredit = allows(session, 'can_credit_sale')
  const cart = slots[active].items

  function setCart(updater) {
    setSlots((prev) => prev.map((slot, i) => (i === active ? { items: typeof updater === 'function' ? updater(slot.items) : updater } : slot)))
  }

  useEffect(() => {
    api('/api/products', { token: session.token }).then(setProducts).catch(() => {})
    api('/api/categories', { token: session.token }).then((list) => {
      const rows = Array.isArray(list) ? list : []
      setCategories(rows)
      setCategoryTabs((prev) => {
        const next = prev.filter((id) => rows.some((row) => String(row.id).toLowerCase() === String(id).toLowerCase()))
        localStorage.setItem('pos-category-tabs', JSON.stringify(next))
        return next
      })
    }).catch(() => {})
    api('/api/definitions/departments', { token: session.token }).then((list) => {
      if (Array.isArray(list) && list.length) {
        setDepartments(list.map((item, index) => ({
          id: item.id,
          slot: index + 1,
          name: item.name,
          vat: item.vatRate,
          color: item.color
        })))
      }
    }).catch(() => {})
    api('/api/customers', { token: session.token }).then(setCustomers).catch(() => {})
    api('/api/fiscal/settings', { token: session.token }).then(setFiscal).catch(() => setFiscal(null))
    inputRef.current?.focus()
  }, [session.token])

  function lineGross(item) {
    return Number(item.unitPrice) * Number(item.quantity)
  }

  function lineDiscount(item) {
    if (!canDiscount) return 0
    const raw = Number(item.discount || 0)
    if (raw <= 0) return 0
    const gross = lineGross(item)
    return Math.min(gross, item.discountType === 'PERCENT' ? gross * raw / 100 : raw)
  }

  function lineTotal(item) {
    return Math.max(0, lineGross(item) - lineDiscount(item))
  }

  const subtotal = cart.reduce((sum, item) => sum + lineTotal(item), 0)
  const qtySum = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const cartDiscount = useMemo(() => {
    if (!canDiscount) return 0
    const raw = Number(discount || 0)
    if (raw <= 0) return 0
    return Math.min(subtotal, discountType === 'PERCENT' ? subtotal * raw / 100 : raw)
  }, [discount, discountType, subtotal, canDiscount])
  const total = Math.max(0, subtotal - cartDiscount)
  const paid = Number(paidAmount || 0)
  const change = Math.max(0, paid - total)

  function sameId(a, b) {
    return String(a).toLowerCase() === String(b).toLowerCase()
  }

  function isPinned(productId) {
    return shortcuts.some((id) => sameId(id, productId))
  }

  const boardPins = board === 'quick' ? shortcuts : (categoryPins[board] || [])
  const activeCategory = categories.find((item) => sameId(item.id, board))

  const visible = products.filter((product) => {
    const onBoard = boardPins.some((id) => sameId(id, product.id))
    const q = query.trim().toLowerCase()
    if (!onBoard) return false
    if (!q) return true
    return product.name.toLowerCase().includes(q) || (product.barcode || '').includes(q)
  })

  function rememberShortcuts(next) {
    setShortcuts(next)
    localStorage.setItem('pos-shortcuts', JSON.stringify(next))
  }

  function pinShortcut(productId) {
    if (isPinned(productId)) return
    rememberShortcuts([...shortcuts, productId])
  }

  function unpinShortcut(productId) {
    rememberShortcuts(shortcuts.filter((id) => !sameId(id, productId)))
    setMessage('Kısayol kaldırıldı.')
    setError('')
  }

  function rememberCategoryTabs(next) {
    setCategoryTabs(next)
    localStorage.setItem('pos-category-tabs', JSON.stringify(next))
  }

  function rememberCategoryPins(next) {
    setCategoryPins(next)
    localStorage.setItem('pos-category-pins', JSON.stringify(next))
  }

  function isOnBoard(productId) {
    return boardPins.some((id) => sameId(id, productId))
  }

  function pinToBoard(productId) {
    if (board === 'quick') {
      pinShortcut(productId)
      return
    }
    const current = categoryPins[board] || []
    if (current.some((id) => sameId(id, productId))) return
    rememberCategoryPins({ ...categoryPins, [board]: [...current, productId] })
  }

  function unpinFromBoard(productId) {
    if (board === 'quick') {
      unpinShortcut(productId)
      return
    }
    const current = categoryPins[board] || []
    rememberCategoryPins({ ...categoryPins, [board]: current.filter((id) => !sameId(id, productId)) })
    setMessage('Kısayol kaldırıldı.')
    setError('')
  }

  function toggleCategoryTab(category) {
    const exists = categoryTabs.some((id) => sameId(id, category.id))
    if (exists) {
      rememberCategoryTabs(categoryTabs.filter((id) => !sameId(id, category.id)))
      if (sameId(board, category.id)) setBoard('quick')
      return
    }
    rememberCategoryTabs([...categoryTabs, category.id])
    setBoard(category.id)
    setCategoryPicker(false)
  }

  function openShortcutModal() {
    setShortcutError('')
    setShortcutSearch('')
    setShortcutMode('select')
    setShortcutForm({ name: '', barcode: '', salePrice: '', vatRate: '20', stockQuantity: '100', imageUrl: '' })
    setShortcutOpen(true)
  }

  async function createShortcut(e) {
    e.preventDefault()
    setShortcutError('')
    if (!shortcutForm.name.trim() || Number(shortcutForm.salePrice) <= 0) {
      setShortcutError('Ürün adı ve satış fiyatı gerekli.')
      return
    }
    try {
      const created = await api('/api/products', {
        method: 'POST',
        token: session.token,
        body: {
          name: shortcutForm.name.trim(),
          barcode: shortcutForm.barcode.trim() || null,
          purchasePrice: 0,
          salePrice: Number(shortcutForm.salePrice),
          vatRate: Number(shortcutForm.vatRate || 20),
          stockQuantity: Number(shortcutForm.stockQuantity || 0),
          criticalStockLevel: 5,
          categoryId: board === 'quick' ? null : board
        }
      })
      if (shortcutForm.imageUrl) saveImage(created.id, shortcutForm.imageUrl)
      pinToBoard(created.id)
      setProducts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'tr')))
      setShortcutOpen(false)
      setMessage(`${created.name} kısayol tuşuna eklendi.`)
    } catch (err) {
      setShortcutError(err.message)
    }
  }

  function productImage(product) {
    return images[product.id] || presetImage(product.name)
  }

  function saveImage(productId, url) {
    const next = { ...images, [productId]: url }
    setImages(next)
    localStorage.setItem('pos-images', JSON.stringify(next))
  }

  function chooseProduct(product) {
    const variants = product.variants || []
    if (variants.length > 0) {
      setVariantAsk(product)
      setError('')
      return
    }
    if (isWeighedUnit(product.unit)) {
      openWeight(product, null)
      return
    }
    addLine(product, null, 1)
  }

  function pickVariant(product, variant) {
    setVariantAsk(null)
    if (isWeighedUnit(product.unit)) {
      openWeight(product, variant)
      return
    }
    addLine(product, variant, 1)
  }

  function openWeight(product, variant) {
    const gram = String(product.unit || '').trim().toLowerCase() === 'gram'
    setWeightAsk({ product, variant, mode: gram ? 'gram' : 'kg', value: '' })
    setError('')
  }

  function weightQuantity(ask) {
    const raw = Number(String(ask?.value || '').replace(',', '.'))
    if (!(raw > 0)) return 0
    const gramUnit = String(ask.product?.unit || '').trim().toLowerCase() === 'gram'
    if (gramUnit) return ask.mode === 'kg' ? raw * 1000 : raw
    return ask.mode === 'gram' ? raw / 1000 : raw
  }

  function confirmWeight() {
    if (!weightAsk) return
    const quantity = Number(weightQuantity(weightAsk).toFixed(3))
    if (!(quantity > 0)) return
    addLine(weightAsk.product, weightAsk.variant, quantity)
    setWeightAsk(null)
  }

  function addLine(product, variant, quantity = 1) {
    setError('')
    const qty = Number(Number(quantity).toFixed(3))
    const lineKey = variant ? `${product.id}:${variant.id}` : String(product.id)
    const label = [variant?.sizeName, variant?.colorName].filter(Boolean).join(' ')
    const unit = product.unit || 'Adet'
    setCart((prev) => {
      const existing = prev.find((x) => x.lineKey === lineKey)
      if (existing) {
        return prev.map((x) => (x.lineKey === lineKey ? { ...x, quantity: Number((Number(x.quantity) + qty).toFixed(3)) } : x))
      }
      return [...prev, {
        lineKey,
        productId: product.id,
        variantId: variant?.id || null,
        name: label ? `${product.name} · ${label}` : product.name,
        unitPrice: product.salePrice,
        vatRate: product.vatRate ?? 20,
        quantity: qty,
        unit,
        discount: 0,
        discountType: 'TL',
        stock: variant ? variant.stockQuantity : product.stockQuantity
      }]
    })
    setVariantAsk(null)
    inputRef.current?.focus()
  }

  function stepQty(item, direction) {
    const weighed = isWeighedUnit(item.unit)
    const delta = weighed && Number(item.quantity) <= 1 ? direction * 0.1 : direction
    setQty(item.lineKey, Number((Number(item.quantity) + delta).toFixed(3)))
  }

  async function addByBarcode(e) {
    e.preventDefault()
    if (!barcode.trim()) return
    setError('')
    try {
      const product = await api(`/api/products/by-barcode/${encodeURIComponent(barcode.trim())}`, { token: session.token })
      chooseProduct(product)
      setBarcode('')
    } catch (err) {
      if ((err.message || '').toLowerCase().includes('bulunamadı')) {
        setMissingBarcode(barcode.trim())
        setBarcode('')
        return
      }
      setError(err.message)
    }
  }

  function setQty(lineKey, quantity) {
    const q = Number(quantity)
    if (q <= 0) {
      if (!canClear) {
        setError('Sepetten ürün silme yetkin yok.')
        return
      }
      setCart((prev) => prev.filter((x) => x.lineKey !== lineKey))
      return
    }
    else setCart((prev) => prev.map((x) => (x.lineKey === lineKey ? { ...x, quantity: q } : x)))
  }

  function setItemDiscount(lineKey, value, type) {
    setCart((prev) => prev.map((x) => (x.lineKey === lineKey ? { ...x, discount: value, discountType: type || x.discountType } : x)))
  }

  function addQuickMoney(amount) {
    setPaidAmount(String(Math.round((paid + amount) * 100) / 100))
  }

  function pressDeptKey(key) {
    if (key === 'C') {
      setDeptAmount('')
      return
    }
    if (key === '⌫') {
      setDeptAmount((prev) => prev.slice(0, -1))
      return
    }
    if (key === '.') {
      setDeptAmount((prev) => (prev.includes('.') ? prev : `${prev || '0'}.`))
      return
    }
    setDeptAmount((prev) => (prev === '0' ? (key === '00' ? '0' : key) : `${prev}${key}`.replace(/^0+(?=\d)/, '')))
  }

  function addDepartment(dept) {
    const amount = Math.round(Number(deptAmount) * 100) / 100
    if (!(amount > 0)) {
      setError('Önce tutar gir, sonra departmana bas.')
      return
    }
    setError('')
    setCart((prev) => [...prev, {
      lineKey: `dept:${dept.id}:${Date.now()}`,
      productId: null,
      isDepartment: true,
      name: dept.name,
      unitPrice: amount,
      vatRate: dept.vat ?? 20,
      quantity: 1,
      unit: 'Adet',
      discount: 0,
      discountType: 'TL'
    }])
    setDeptAmount('')
  }

  async function printFiscalReceipt(saleResult, cartSnapshot, payMethod, payable) {
    if (!fiscal?.isEnabled || !fiscal?.isPaired || !fiscal?.deviceHost) return { skipped: true }
    const agentBase = (fiscal.agentBaseUrl || 'http://127.0.0.1:5055').replace(/\/$/, '')
    try {
      const health = await fetch(`${agentBase}/health`, { cache: 'no-store' })
      if (!health.ok) throw new Error('kapalı')
    } catch {
      return { ok: false, message: 'Satış kaydedildi ama ajan kapalı — fiş basılmadı.' }
    }
    const gross = cartSnapshot.reduce((sum, item) => sum + lineTotal(item), 0) || 1
    try {
      const res = await fetch(`${agentBase}/sale/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceHost: fiscal.deviceHost,
          devicePort: fiscal.devicePort || 4443,
          serialNo: fiscal.serialNo || null,
          softwareId: fiscal.softwareId || null,
          hardwareId: fiscal.hardwareId || null,
          paymentMethod: payMethod,
          grandTotal: payable,
          referenceCode: saleResult.receiptNo,
          items: cartSnapshot.map((item) => {
            const share = lineTotal(item) / gross
            return {
              name: item.name,
              quantity: 1,
              unitPrice: Math.round(payable * share * 100) / 100,
              vatRate: item.vatRate ?? 20
            }
          })
        })
      })
      const data = await res.json().catch(() => null)
      return data || { ok: false, message: 'Yazarkasa yanıt vermedi.' }
    } catch (err) {
      return { ok: false, message: err.message || 'Fiş gönderilemedi.' }
    }
  }

  function isFiscalCancel(text) {
    const value = (text || '').toLocaleLowerCase('tr-TR')
    return value.includes('vazgeç') || value.includes('vazgec')
  }

  async function checkout(method) {
    const payMethod = method || paymentMethod
    setPaymentMethod(payMethod)
    if (!cart.length || busy) return
    if (payMethod === 'Veresiye' && !canCredit) {
      setError('Veresiye satış yetkin yok.')
      return
    }
    if (payMethod === 'Veresiye' && !customerId) {
      setAskCustomer(true)
      setError('Veresiye için cari seçin.')
      return
    }
    setError('')
    setMessage('')
    setBusy(true)
    const cartSnapshot = cart.map((item) => ({ ...item }))
    const payable = total
    const discountAmount = canDiscount ? cart.reduce((sum, item) => sum + lineDiscount(item), 0) + cartDiscount : 0
    try {
      const result = await api('/api/sales', {
        method: 'POST',
        token: session.token,
        body: {
          items: cartSnapshot.map((item) => (item.isDepartment
            ? { productId: null, quantity: item.quantity, unitPrice: item.unitPrice, name: item.name, vatRate: item.vatRate }
            : { productId: item.productId, variantId: item.variantId || null, quantity: item.quantity })),
          paymentMethod: payMethod,
          customerId: payMethod === 'Veresiye' ? customerId || null : null,
          discountAmount
        }
      })
      setCart([])
      setBarcode('')
      setPaidAmount('')
      setDiscount('')
      const fiscalResult = await printFiscalReceipt(result, cartSnapshot, payMethod, payable)
      if (isFiscalCancel(fiscalResult?.message)) {
        try {
          await api(`/api/sales/${result.id}/void`, { method: 'POST', token: session.token })
          setCart(cartSnapshot)
          setMessage('')
          setError('Yazarkasada vazgeçildi. Satış iptal edildi, sepet duruyor.')
        } catch (voidErr) {
          setMessage('')
          setError(`Yazarkasada vazgeçildi ama satış kaydı duruyor: ${voidErr.message}`)
        }
      } else {
        let msg = `Satış tamam: ${result.receiptNo} — ${Number(result.grandTotal).toFixed(2)} ₺`
        if (fiscalResult?.ok) msg += fiscalResult.receiptNo ? ` | Yazarkasa fiş: ${fiscalResult.receiptNo}` : ' | Fiş basıldı'
        else if (fiscalResult?.message) setError(fiscalResult.message)
        setMessage(msg)
      }
      const fresh = await api('/api/products', { token: session.token })
      setProducts(fresh)
      inputRef.current?.focus()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (!['F4', 'F8', 'F9', 'F10', 'F12'].includes(e.key)) return
      }
      if (e.key === 'F4') { e.preventDefault(); checkout('Nakit') }
      if (e.key === 'F8') { e.preventDefault(); checkout('KrediKarti') }
      if (e.key === 'F9') { e.preventDefault(); if (canCredit) checkout('Veresiye'); else setError('Veresiye satış yetkin yok.') }
      if (e.key === 'F10') { e.preventDefault(); openSplit() }
      if (e.key === 'F12') { e.preventDefault(); setError('Fatura kesimi sıradaki adım. Satışı nakit, kart veya veresiye ile tamamlayın.') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function openSplit() {
    if (!cart.length) return
    setSplitCash(total.toFixed(2))
    setSplitCard('0')
    setSplitOpen(true)
  }

  function confirmSplit() {
    const cash = Number(splitCash || 0)
    const card = Number(splitCard || 0)
    if (Math.abs(cash + card - total) > 0.05) {
      setError('Parçalı ödeme nakit + kart olarak sepet tutarına eşit olmalı.')
      return
    }
    setSplitOpen(false)
    checkout(card > cash ? 'KrediKarti' : 'Nakit')
  }

  const priceLook = fiscal && !fiscal.isPaired

  return (
    <div className="h-screen p-3 flex gap-3 overflow-hidden bg-[#070b16] text-slate-100">
      <div className="w-[380px] xl:w-[420px] shrink-0 flex flex-col bg-slate-900/90 rounded-3xl border border-slate-800 p-3 shadow-2xl min-h-0">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => navigate('/app')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-200 border border-slate-700 rounded-2xl text-xs font-bold">
              <LayoutDashboard className="w-4 h-4 text-blue-400" /> Menü
            </button>
            <span className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl text-xs font-bold border ${fiscal?.isPaired ? 'bg-emerald-950 text-emerald-300 border-emerald-500/70' : 'bg-rose-950 text-rose-300 border-rose-500/70'}`}>
              <Cpu className="w-4 h-4" /> ÖKC
              <span className={`w-2 h-2 rounded-full ${fiscal?.isPaired ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            </span>
            <button type="button" onClick={() => setError('İade alma sıradaki adım.')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-2xl text-xs font-bold border bg-amber-950/80 text-amber-300 border-amber-500/50">
              <RotateCcw className="w-3.5 h-3.5" /> İade Al
            </button>
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-400">POS SATIŞ</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800 mb-2">
          {slots.map((slot, idx) => {
            const count = slot.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
            const on = idx === active
            return (
              <button key={idx} type="button" onClick={() => setActive(idx)} className={`flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-bold ${on ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : count ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40' : 'text-slate-400'}`}>
                <ShoppingCart className="w-3.5 h-3.5" /> Sepet {idx + 1}
                {count > 0 && <span className="text-[10px] px-1 rounded-full bg-black/30">{count}</span>}
              </button>
            )
          })}
        </div>

        <form onSubmit={addByBarcode} className="relative mb-2">
          <Barcode className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
          <input ref={inputRef} value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Barkod Okutun..." className="w-full pl-9 pr-3 py-2 bg-slate-950 border-2 border-emerald-500/40 rounded-2xl text-white font-mono text-xs outline-none" />
        </form>
        <div className="relative mb-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ürün Ara..." className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-2xl text-white text-xs outline-none" />
        </div>

        {priceLook && (
          <div className="mb-2 p-2 bg-amber-950 border border-amber-500/60 rounded-2xl text-amber-200 text-[11px] font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> FİYAT GÖR MODU (Satış Kilitli)
          </div>
        )}
        {error && (
          <div className="mb-2 p-2 bg-red-950 border border-red-500/50 rounded-2xl text-red-100 text-[11px] flex justify-between gap-2">
            <span className="flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{error}</span>
            <button type="button" onClick={() => setError('')}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {message && (
          <div className="mb-2 p-2 bg-emerald-950 border border-emerald-500/50 rounded-2xl text-emerald-100 text-[11px] flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />{message}
          </div>
        )}

        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-white text-sm">Satış Sepeti</span>
            <span className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full text-[11px] font-black">{cart.length} Kalem</span>
            <span className="border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full text-[11px] font-mono">{formatQty(qtySum)} Adet</span>
          </div>
          {cart.length > 0 && (
            <button type="button" onClick={() => { if (canClear) setCart([]); else setError('Sepeti temizleme yetkin yok.') }} className="text-xs text-red-400 flex items-center gap-1 px-2 py-1 border border-red-500/20 rounded-xl">
              <Trash2 className="w-3.5 h-3.5" /> Temizle
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-2 min-h-0">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs text-center p-6 gap-2">
              <Package className="w-8 h-8" />
              <p>Sepet boş. Barkod okutun veya ürün seçin.</p>
            </div>
          ) : cart.map((item) => (
            <div key={item.lineKey} className="bg-slate-800/80 rounded-2xl p-2.5 border border-slate-700">
              <div className="flex justify-between gap-2">
                <div>
                  <div className="font-bold text-white text-xs">{item.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {item.isDepartment ? `Departman · KDV %${item.vatRate} · ${money(item.unitPrice)}` : `${money(item.unitPrice)} / ${item.unit || 'Adet'}`}
                  </div>
                </div>
                <button type="button" onClick={() => setQty(item.lineKey, 0)} className="text-slate-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/60 gap-1.5">
                <div className="flex items-center gap-1 min-w-0">
                  <button type="button" onClick={() => stepQty(item, -1)} className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-700 shrink-0"><Minus className="w-3 h-3 mx-auto" /></button>
                  <input value={formatQty(item.quantity)} onChange={(e) => setQty(item.lineKey, e.target.value)} className={`${isWeighedUnit(item.unit) ? 'w-12' : 'w-8'} text-center bg-transparent font-mono text-sm outline-none`} />
                  <button type="button" onClick={() => stepQty(item, 1)} className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-700 shrink-0"><Plus className="w-3 h-3 mx-auto" /></button>
                  <div className="flex bg-slate-950 rounded-lg border border-slate-700 p-0.5 shrink-0">
                    <button type="button" onClick={() => setItemDiscount(item.lineKey, item.discount || 0, 'TL')} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.discountType !== 'PERCENT' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>₺</button>
                    <button type="button" onClick={() => setItemDiscount(item.lineKey, item.discount || 0, 'PERCENT')} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.discountType === 'PERCENT' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>%</button>
                  </div>
                  <input
                    value={item.discount || ''}
                    disabled={!canDiscount}
                    onChange={(e) => setItemDiscount(item.lineKey, e.target.value, item.discountType || 'TL')}
                    placeholder={canDiscount ? '0' : '—'}
                    title="İskonto"
                    className="w-12 bg-slate-950 border border-slate-700 rounded-lg px-1 py-1 text-center font-mono text-[11px] disabled:opacity-40"
                  />
                </div>
                <span className="font-mono font-black text-emerald-300 text-xs shrink-0">{money(lineTotal(item))}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 bg-slate-900/85 rounded-3xl border border-slate-800 p-3.5 overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center gap-2 p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800 mb-3">
          <button type="button" onClick={() => setMiddleTab('quick')} className={`flex-1 py-3 px-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${middleTab === 'quick' ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-600/30' : 'text-slate-400'}`}>
            <Sparkles className="w-5 h-5 text-amber-300" /> Hızlı Satış (Kısayol Tuşları & Ürünler)
          </button>
          <button type="button" onClick={() => setMiddleTab('dept')} className={`flex-1 py-3 px-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 ${middleTab === 'dept' ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 text-white' : 'text-slate-400'}`}>
            <Cpu className="w-5 h-5 text-indigo-300" /> Departmanlı Satış (ÖKC Tuş Takımı)
          </button>
        </div>

        {middleTab === 'quick' ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1">
              <button type="button" onClick={() => setBoard('quick')} className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border-2 ${board === 'quick' ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-950 text-amber-300 border-amber-500/40'}`}>
                <Star className={`w-4 h-4 ${board === 'quick' ? 'fill-slate-950' : 'fill-amber-400'}`} /> Hızlı Satış Tuşları ({shortcuts.length})
              </button>
              {categoryTabs.map((id) => {
                const category = categories.find((item) => sameId(item.id, id))
                if (!category) return null
                const selected = sameId(board, category.id)
                const color = category.color || '#10b981'
                const count = (categoryPins[category.id] || []).length
                return (
                  <button key={category.id} type="button" onClick={() => setBoard(category.id)} style={selected ? { backgroundColor: color, borderColor: color } : { borderColor: color, backgroundColor: `${color}22` }} className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border-2 text-white ${selected ? 'shadow-lg' : ''}`}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    {category.name} ({count})
                    <span role="button" title="Sekmeden kaldır" onClick={(e) => { e.stopPropagation(); toggleCategoryTab(category) }} className="opacity-80">×</span>
                  </button>
                )
              })}
              <button type="button" onClick={() => setCategoryPicker(true)} className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border-2 border-dashed border-slate-600 text-slate-300">
                <Plus className="w-3.5 h-3.5" /> Kategori
              </button>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 content-start pr-1">
              {visible.map((product) => {
                const image = productImage(product)
                return (
                  <div key={product.id} className="rounded-2xl border-2 border-slate-700 bg-gradient-to-b from-slate-800 to-slate-900 min-h-[150px] overflow-hidden flex flex-col">
                    <button type="button" onClick={() => chooseProduct(product)} className="text-left flex flex-col flex-1">
                      {image ? (
                        <div className="h-24 bg-slate-950 relative">
                          <img src={image} alt="" className="w-full h-full object-cover" />
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-300 absolute top-1.5 right-1.5" />
                        </div>
                      ) : (
                        <div className="h-12 px-2.5 flex items-center justify-between border-b border-slate-800">
                          <Package className="w-4 h-4 text-slate-500" />
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              const url = window.prompt('Resim adresi', '')
                              if (url) saveImage(product.id, url)
                            }}
                            className="text-[10px] text-emerald-400 font-bold"
                          >+ Resim Ekle</span>
                        </div>
                      )}
                      <div className="p-2 flex-1 flex flex-col justify-between">
                        <h4 className="font-bold text-white text-[12px] leading-snug line-clamp-2">{product.name}</h4>
                        <div className="pt-1 border-t border-slate-700/60 flex justify-between items-end">
                          <span className="text-[10px] text-slate-400 font-mono border border-slate-800 rounded px-1">{product.unit || 'Adet'}</span>
                          <span className="font-black text-sm text-emerald-300 font-mono">{money(product.salePrice)}</span>
                        </div>
                      </div>
                    </button>
                  </div>
                )
              })}
              <button type="button" onClick={openShortcutModal} className="min-h-[150px] rounded-2xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/10 text-emerald-300 flex flex-col items-center justify-center gap-1">
                <span className="w-9 h-9 rounded-full border border-emerald-400/40 bg-emerald-500/20 flex items-center justify-center"><Plus className="w-5 h-5" /></span>
                <span className="font-black text-xs">+ Kısayol Ekle</span>
                <span className="text-[10px]">Resimli Tuş</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-3 bg-gradient-to-b from-[#0f0c29] via-[#1a1040] to-[#0d0b1e] p-4 rounded-3xl border border-indigo-500/40 min-h-0">
            <div className="flex items-center justify-between border-2 border-indigo-400/40 rounded-2xl px-4 py-3 bg-indigo-950/40">
              <span className="text-xs font-black text-indigo-300 uppercase tracking-widest">Departman Tutar Girişi</span>
              <span className="text-4xl font-mono font-black text-white">{deptAmount ? `₺${deptAmount}` : '₺0'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {departments.map((dept) => (
                <button key={dept.id} type="button" onClick={() => addDepartment(dept)} style={{ backgroundColor: dept.color }} className="rounded-3xl p-4 min-h-[88px] text-left text-white font-black">
                  <div className="text-xs">D{dept.slot} · %{dept.vat}</div>
                  <div className="text-sm mt-2">{dept.name}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 mt-auto">
              {[
                ['7', '7'], ['8', '8'], ['9', '9'], ['⌫', 'SİL'],
                ['4', '4'], ['5', '5'], ['6', '6'], ['C', 'TEMİZLE'],
                ['1', '1'], ['2', '2'], ['3', '3'], ['00', '00'],
                ['0', '0'], ['.', '.'], ['Z', 'SIFIRLA']
              ].map(([key, label]) => (
                <button key={label + key} type="button" onClick={() => pressDeptKey(key === 'Z' ? 'C' : key)} className={`h-14 rounded-2xl font-black border border-indigo-400/30 ${key === '0' ? 'col-span-2 text-xl' : ''} ${'⌫CZ'.includes(key) ? 'bg-rose-800 text-sm' : 'bg-indigo-800 text-white text-xl'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-[420px] xl:w-[460px] shrink-0 bg-slate-900/95 rounded-3xl border border-slate-800 p-4 flex flex-col gap-3 overflow-y-auto">
        <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-sm"><ShoppingCart className="w-5 h-5 text-emerald-400" /> Satış Sepeti</div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                <span className="px-2 py-0.5 bg-emerald-500 text-slate-950">{cart.length} Kalem</span>
                <span className="px-2 py-0.5 text-slate-300">{formatQty(qtySum)} Adet</span>
              </span>
              {cart.length > 0 && <button type="button" onClick={() => { if (canClear) setCart([]); else setError('Sepeti temizleme yetkin yok.') }} className="p-1.5 rounded-xl bg-red-950/60 text-red-400 border border-red-800/60"><Trash2 className="w-4 h-4" /></button>}
            </div>
          </div>
          <div className="flex justify-between text-xs mt-2 pt-2 border-t border-slate-800">
            <span className="text-emerald-400 font-bold">{cart.length} Ürün Kalemi</span>
            <span className="font-mono font-black">{money(subtotal)}</span>
          </div>
        </div>

        <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex justify-between text-xs font-bold">
            <span>Ara Toplam</span>
            <span className="font-mono text-base">{money(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
            <span className="font-bold">İskonto / İndirim</span>
            <div className="flex bg-slate-900 rounded-lg border border-slate-800 p-0.5">
              <button type="button" disabled={!canDiscount} onClick={() => { setDiscountType('TL'); setDiscount('') }} className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${discountType === 'TL' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>₺ (TL)</button>
              <button type="button" disabled={!canDiscount} onClick={() => { setDiscountType('PERCENT'); setDiscount('') }} className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${discountType === 'PERCENT' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>% (Oran)</button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            {discountType === 'PERCENT' ? (
              <div className="flex gap-1">
                {[5, 10, 15, 20].map((pct) => (
                  <button key={pct} type="button" disabled={!canDiscount} onClick={() => setDiscount(String(pct))} className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${Number(discount) === pct ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' : 'border-slate-700 text-slate-400'}`}>%{pct}</button>
                ))}
              </div>
            ) : <span className="text-[11px] text-slate-400">{canDiscount ? 'Sabit Tutar İndirimi' : 'İskonto yetkisi yok'}</span>}
            <div className="flex items-center gap-1">
              <input value={discount} disabled={!canDiscount} onChange={(e) => setDiscount(e.target.value)} placeholder={canDiscount ? '0' : 'Yetki yok'} className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1 text-center font-mono text-xs disabled:opacity-40" />
              <span className="text-xs text-slate-400">{discountType === 'PERCENT' ? '%' : '₺'}</span>
            </div>
          </div>
          {cartDiscount > 0 && <div className="flex justify-between text-xs font-bold text-rose-400"><span>İndirim Tutarı</span><span>-{money(cartDiscount)}</span></div>}
        </div>

        <div className="bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 px-5 py-6 rounded-2xl border-2 border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.25)]">
          <div className="flex items-center gap-2 text-emerald-300 text-sm font-black uppercase"><Wallet className="w-5 h-5" /> Ödenecek Tutar</div>
          <div className="text-right text-5xl xl:text-6xl font-mono font-black text-emerald-300 leading-none mt-3">{money(total)}</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 text-[10px] font-bold text-slate-400">
            Alınan Para
            <input value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder={money(total)} className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-sm font-mono font-bold text-white" />
          </label>
          <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 text-[10px] font-bold text-slate-400">
            Para Üstü
            <div className="mt-1 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-sm font-mono font-black text-amber-300 flex justify-between"><span>₺</span><span>{change.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {[10, 20, 50, 100, 200].map((amount) => (
            <button key={amount} type="button" onClick={() => addQuickMoney(amount)} className="py-3 rounded-2xl border border-slate-800 bg-slate-950 text-emerald-400 font-mono font-black text-xs">+₺{amount}</button>
          ))}
          <button type="button" onClick={() => setPaidAmount(total.toFixed(2))} className="py-3 rounded-2xl border border-emerald-500/50 bg-emerald-950 text-emerald-300 font-black text-xs">TAM</button>
        </div>

        {askCustomer && (
          <label className="text-[11px] text-slate-400">
            Veresiye cari
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-sm text-white">
              <option value="">Seçin</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" disabled={!cart.length || busy} onClick={() => checkout('Nakit')} className="py-7 rounded-2xl text-base font-black bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex items-center justify-center gap-2 disabled:opacity-40"><Banknote className="w-6 h-6" /> NAKİT (F4)</button>
          <button type="button" disabled={!cart.length || busy} onClick={() => checkout('KrediKarti')} className="py-7 rounded-2xl text-base font-black bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-center gap-2 disabled:opacity-40"><CreditCard className="w-6 h-6" /> KART (F8)</button>
          <button type="button" disabled={!cart.length || busy} onClick={openSplit} className="py-7 rounded-2xl text-base font-black bg-gradient-to-r from-purple-600 to-pink-600 text-white flex items-center justify-center gap-2 disabled:opacity-40"><Layers className="w-6 h-6" /> PARÇALI (F10)</button>
          <button type="button" disabled={!cart.length || busy || !canCredit} onClick={() => checkout('Veresiye')} className="py-7 rounded-2xl text-base font-black bg-gradient-to-r from-amber-600 to-orange-600 text-white flex items-center justify-center gap-2 disabled:opacity-40"><Users className="w-6 h-6" /> VERESİYE (F9)</button>
        </div>
        <button type="button" disabled={!cart.length || busy} onClick={() => setError('Fatura kesimi sıradaki adım. Satışı nakit, kart veya veresiye ile tamamlayın.')} className="w-full py-5 rounded-2xl text-base font-black border-2 border-purple-500/50 text-purple-300 bg-slate-950 flex items-center justify-center gap-2 disabled:opacity-40">
          <FileText className="w-5 h-5" /> FATURA KES (F12)
        </button>
      </div>

      {categoryPicker && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-black">Kategori sekmesi</div>
                <div className="text-xs text-slate-400">Tanımlamalardaki kategoriyi hızlı satışın yanına koy.</div>
              </div>
              <button type="button" onClick={() => setCategoryPicker(false)} className="p-1.5 rounded-xl bg-slate-800"><X className="w-4 h-4" /></button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1">
              {categories.length === 0 ? (
                <p className="text-sm text-slate-400">Henüz kategori yok. Tanımlamalar → Kategori’den ekle.</p>
              ) : categories.map((category) => {
                const added = categoryTabs.some((id) => sameId(id, category.id))
                return (
                  <button key={category.id} type="button" onClick={() => toggleCategoryTab(category)} className="w-full flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-left">
                    <span className="inline-flex items-center gap-2 text-sm font-bold">
                      <span className="w-3 h-3 rounded-full" style={{ background: category.color || '#10b981' }} />
                      {category.name}
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ${added ? 'bg-rose-700' : 'bg-emerald-600'}`}>{added ? 'Kaldır' : 'Ekle'}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {shortcutOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-black">{activeCategory ? `${activeCategory.name} kısayolu` : 'Hızlı Satış Kısayol Tuşu Ekle'}</div>
                <div className="text-xs text-slate-400">{activeCategory ? 'Bu kategori sekmesine ürün ekle.' : 'Tuşa ürün ve resim tanımlayın.'}</div>
              </div>
              <button type="button" onClick={() => setShortcutOpen(false)} className="p-1.5 rounded-xl bg-slate-800"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
              <button type="button" onClick={() => setShortcutMode('select')} className={`flex-1 py-2 rounded-xl ${shortcutMode === 'select' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Stoktaki Ürün</button>
              <button type="button" onClick={() => setShortcutMode('new')} className={`flex-1 py-2 rounded-xl ${shortcutMode === 'new' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>+ Yeni Ürün</button>
            </div>
            {shortcutMode === 'select' ? (
              <div className="space-y-2">
                <input value={shortcutSearch} onChange={(e) => setShortcutSearch(e.target.value)} placeholder="Ürün adı veya barkod" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm" />
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {products.filter((product) => {
                    const q = shortcutSearch.trim().toLowerCase()
                    return !q || product.name.toLowerCase().includes(q) || (product.barcode || '').includes(q)
                  }).map((product) => {
                    const pinned = isOnBoard(product.id)
                    return (
                      <div key={product.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{product.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{money(product.salePrice)}</div>
                        </div>
                        {pinned ? (
                          <button type="button" onClick={() => unpinFromBoard(product.id)} className="px-2 py-1 rounded-lg bg-rose-700 text-[11px] font-bold">Kaldır</button>
                        ) : (
                          <button type="button" onClick={() => { pinToBoard(product.id); setShortcutOpen(false); setMessage(`${product.name} eklendi.`) }} className="px-2 py-1 rounded-lg bg-emerald-600 text-[11px] font-bold">+ Ekle</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <form onSubmit={createShortcut} className="space-y-2">
                <input value={shortcutForm.name} onChange={(e) => setShortcutForm({ ...shortcutForm, name: e.target.value })} placeholder="Ürün adı" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm" required />
                <div className="grid grid-cols-2 gap-2">
                  <input value={shortcutForm.salePrice} onChange={(e) => setShortcutForm({ ...shortcutForm, salePrice: e.target.value })} placeholder="Satış fiyatı" className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm" required />
                  <input value={shortcutForm.barcode} onChange={(e) => setShortcutForm({ ...shortcutForm, barcode: e.target.value })} placeholder="Barkod" className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm" />
                  <input value={shortcutForm.vatRate} onChange={(e) => setShortcutForm({ ...shortcutForm, vatRate: e.target.value })} placeholder="KDV %" className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm" />
                  <input value={shortcutForm.stockQuantity} onChange={(e) => setShortcutForm({ ...shortcutForm, stockQuantity: e.target.value })} placeholder="Stok" className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm" />
                </div>
                <label className="block text-[11px] text-slate-400">
                  Resim
                  <input type="file" accept="image/*" className="mt-1 block w-full text-xs" onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => setShortcutForm((prev) => ({ ...prev, imageUrl: String(reader.result || '') }))
                    reader.readAsDataURL(file)
                  }} />
                </label>
                {shortcutForm.imageUrl && <img src={shortcutForm.imageUrl} alt="" className="h-16 w-16 object-cover rounded-xl" />}
                {shortcutError && <p className="text-xs text-red-300">{shortcutError}</p>}
                <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-600 font-black">Kaydet ve tuşa ekle</button>
              </form>
            )}
          </div>
        </div>
      )}

      {missingBarcode && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-5 space-y-3">
            <div className="font-black text-lg text-white">Kayıt yok</div>
            <p className="text-sm text-slate-300">Barkod <span className="font-mono text-amber-300">{missingBarcode}</span> stokta yok. Kart açmak ister misin?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMissingBarcode('')} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">Vazgeç</button>
              <button type="button" onClick={() => navigate(`/app/products?barkod=${encodeURIComponent(missingBarcode)}`)} className="flex-1 py-2.5 rounded-xl bg-emerald-600 font-black">Stok kartı aç</button>
            </div>
          </div>
        </div>
      )}

      {variantAsk && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-3xl p-5 space-y-3">
            <div className="font-black text-lg text-white">{variantAsk.name}</div>
            <p className="text-xs text-slate-400">Hangi stoğundan düşsün?</p>
            <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
              {(variantAsk.variants || []).map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => pickVariant(variantAsk, variant)}
                  className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-left disabled:opacity-40"
                >
                  <span className="font-black text-white">{[variant.sizeName, variant.colorName].filter(Boolean).join(' · ')}</span>
                  <span className="font-mono text-emerald-300">{formatQty(variant.stockQuantity)} {variantAsk.unit || 'adet'}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setVariantAsk(null)} className="w-full py-2 rounded-xl border border-slate-700 text-slate-300">Vazgeç</button>
          </div>
        </div>
      )}

      {weightAsk && (() => {
        const qty = weightQuantity(weightAsk)
        const unit = weightAsk.product.unit || 'Kg'
        const stock = Number(weightAsk.variant ? weightAsk.variant.stockQuantity : weightAsk.product.stockQuantity)
        const price = qty * Number(weightAsk.product.salePrice || 0)
        const variantLabel = [weightAsk.variant?.sizeName, weightAsk.variant?.colorName].filter(Boolean).join(' · ')
        const over = qty > stock
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <form
              onSubmit={(e) => { e.preventDefault(); confirmWeight() }}
              className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="font-black text-lg text-white">{weightAsk.product.name}</div>
                    <div className="text-[11px] text-emerald-300 font-mono">{money(weightAsk.product.salePrice)} / {unit}{variantLabel ? ` · ${variantLabel}` : ''}</div>
                  </div>
                </div>
                <button type="button" onClick={() => setWeightAsk(null)} className="text-slate-400"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-slate-400">Kaç {unit === 'Gram' ? 'gram' : 'kilo'}? Stok: {formatQty(stock)} {unit}</p>
              <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-700">
                <button type="button" onClick={() => setWeightAsk((prev) => prev && ({ ...prev, mode: 'kg', value: prev.mode === 'gram' && Number(prev.value) > 0 ? formatQty(Number(prev.value) / 1000) : prev.value }))} className={`flex-1 py-2 rounded-lg text-xs font-black ${weightAsk.mode === 'kg' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'}`}>Kilogram</button>
                <button type="button" onClick={() => setWeightAsk((prev) => prev && ({ ...prev, mode: 'gram', value: prev.mode === 'kg' && Number(String(prev.value).replace(',', '.')) > 0 ? String(Math.round(Number(String(prev.value).replace(',', '.')) * 1000)) : prev.value }))} className={`flex-1 py-2 rounded-lg text-xs font-black ${weightAsk.mode === 'gram' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'}`}>Gram</button>
              </div>
              <input
                autoFocus
                inputMode="decimal"
                value={weightAsk.value}
                onChange={(e) => setWeightAsk((prev) => prev && ({ ...prev, value: e.target.value }))}
                placeholder={weightAsk.mode === 'gram' ? 'Örn: 500' : 'Örn: 0.5'}
                className="w-full bg-slate-950 border-2 border-amber-500/60 rounded-xl px-4 py-3 text-2xl font-black font-mono text-center text-white outline-none"
              />
              <div className="grid grid-cols-5 gap-1.5">
                {WEIGHT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setWeightAsk((prev) => prev && ({ ...prev, value: prev.mode === 'gram' ? String(preset.gram) : String(preset.kg) }))}
                    className="py-2 rounded-lg border border-slate-700 bg-slate-800 text-[11px] font-bold text-slate-200"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 px-3 py-2">
                <div>
                  <div className="text-[10px] text-slate-400">Miktar</div>
                  <div className="font-mono font-black text-white">{qty > 0 ? `${formatQty(qty)} ${unit}` : '—'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Tutar</div>
                  <div className="font-mono font-black text-emerald-300">{money(price)}</div>
                </div>
              </div>
              {over && <p className="text-xs text-amber-300">Stok {formatQty(stock)} {unit}. Fazlası eksiye düşer, satış durmaz.</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setWeightAsk(null)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300">Vazgeç</button>
                <button type="submit" disabled={!(qty > 0)} className="flex-1 py-2.5 rounded-xl bg-emerald-600 font-black disabled:opacity-40">Sepete ekle</button>
              </div>
            </form>
          </div>
        )
      })()}

      {splitOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-[360px] bg-slate-900 border border-purple-500/40 rounded-3xl p-5 space-y-3">
            <div className="font-black text-lg">Parçalı ödeme</div>
            <div className="text-emerald-300 font-mono text-2xl">{money(total)}</div>
            <label className="block text-xs text-slate-400">Nakit<input value={splitCash} onChange={(e) => setSplitCash(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white" /></label>
            <label className="block text-xs text-slate-400">Kart<input value={splitCard} onChange={(e) => setSplitCard(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white" /></label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSplitOpen(false)} className="flex-1 py-2 rounded-xl border border-slate-700">Vazgeç</button>
              <button type="button" onClick={confirmSplit} className="flex-1 py-2 rounded-xl bg-purple-600 font-bold">Tamamla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
