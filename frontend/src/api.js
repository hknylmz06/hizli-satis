const API_BASE = import.meta.env.VITE_API_URL || ''

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  if (!res.ok) {
    let message = 'İstek başarısız'
    try {
      const data = await res.json()
      message = data.message || data.title || message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  if (res.status === 204) return null
  return res.json()
}
