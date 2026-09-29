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
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  if (res.status === 204) return null
  return res.json()
}
