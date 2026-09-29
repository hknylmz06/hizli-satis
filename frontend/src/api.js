const API_BASE = import.meta.env.VITE_API_URL || ''

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  if (res.status === 401 && token) {
    localStorage.removeItem('hizlisatis_auth')
    sessionStorage.setItem('hizlisatis_auth_notice', 'Oturumun doldu. Tekrar giriş yap, kayıtlar veritabanına o zaman düşer.')
    window.location.assign('/')
    throw new Error('Oturumun doldu. Tekrar giriş yap.')
  }

  if (!res.ok) {
    let message = res.status === 401 ? 'Oturumun doldu. Tekrar giriş yap.' : 'İstek başarısız'
    try {
      const data = await res.json()
      const fieldError = data.errors ? Object.values(data.errors).flat().find(Boolean) : null
      message = data.message || fieldError || data.title || message
      const err = new Error(message)
      err.data = data
      throw err
    } catch (err) {
      if (err.data) throw err
    }
    throw new Error(message)
  }

  if (res.status === 204) return null
  return res.json()
}

export function readLocalShortcuts() {
  try { return JSON.parse(localStorage.getItem('pos-shortcuts') || '[]') } catch { return [] }
}

function numericIds(ids) {
  return [...new Set((ids || []).map((id) => Number(id)).filter((id) => id > 0))]
}

export async function fetchShortcuts(token) {
  const remote = await api('/api/pos/shortcuts', { token })
  const ids = Array.isArray(remote) ? remote : []
  if (ids.length) {
    localStorage.setItem('pos-shortcuts', JSON.stringify(ids))
    return ids
  }
  const local = numericIds(readLocalShortcuts())
  if (!local.length) return []
  return storeShortcuts(token, local)
}

export async function storeShortcuts(token, ids) {
  const productIds = numericIds(ids)
  localStorage.setItem('pos-shortcuts', JSON.stringify(productIds))
  const saved = await api('/api/pos/shortcuts', { method: 'PUT', token, body: { productIds } })
  const next = Array.isArray(saved) ? saved : productIds
  localStorage.setItem('pos-shortcuts', JSON.stringify(next))
  return next
}
