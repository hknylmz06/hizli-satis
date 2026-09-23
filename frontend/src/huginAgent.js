const AGENT_URL = 'http://127.0.0.1:5055'
const PROTOCOL = 'hizlisatis-agent://start'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function isAgentOnline(timeoutMs = 1200) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${AGENT_URL}/health`, {
      signal: ctrl.signal,
      mode: 'cors',
      cache: 'no-store'
    })
    return res.ok
  } catch (err) {
    console.warn('Hugin agent health failed', err)
    return false
  } finally {
    clearTimeout(t)
  }
}

/** Giriş sonrası: ajan yoksa protokol ile gizli başlatmayı dene */
export async function ensureHuginAgent() {
  if (await isAgentOnline()) {
    return { ok: true, running: true }
  }

  try {
    // Özel protokol — install edilmişse gizli launcher açılır
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = PROTOCOL
    document.body.appendChild(iframe)
    setTimeout(() => iframe.remove(), 2000)
  } catch {
    /* ignore */
  }

  for (let i = 0; i < 20; i++) {
    await sleep(400)
    if (await isAgentOnline()) {
      return { ok: true, started: true }
    }
  }

  return {
    ok: false,
    message: 'Yazarkasa ajanına ulaşılamadı (Failed to fetch). publish-agent.ps1 ile kurun, Chrome’da sayfayı yenileyin.'
  }
}

export function getAgentBaseUrl() {
  return AGENT_URL
}
