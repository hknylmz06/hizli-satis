export const READY_IMAGES = [
  { label: 'Ekmek', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=70' },
  { label: 'Su', url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=400&q=70' },
  { label: 'Çay', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=70' },
  { label: 'Kahve', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=70' },
  { label: 'Süt', url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=70' },
  { label: 'Peynir', url: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=400&q=70' },
  { label: 'Cips', url: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=400&q=70' },
  { label: 'Kola', url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=70' },
  { label: 'Kek', url: 'https://images.unsplash.com/photo-1511381939415-e44015466834?auto=format&fit=crop&w=400&q=70' },
  { label: 'Meyve', url: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=70' },
  { label: 'Deterjan', url: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=400&q=70' },
  { label: 'Dondurma', url: 'https://images.unsplash.com/photo-1567206563064-6f60f4078b57?auto=format&fit=crop&w=400&q=70' }
]

const KEYWORDS = [
  { words: ['ekmek', 'somun', 'francala'], url: READY_IMAGES[0].url },
  { words: ['su', 'damacana'], url: READY_IMAGES[1].url },
  { words: ['çay', 'cay', 'lipton'], url: READY_IMAGES[2].url },
  { words: ['kahve', 'nescafe'], url: READY_IMAGES[3].url },
  { words: ['süt', 'sut', 'sütaş'], url: READY_IMAGES[4].url },
  { words: ['peynir', 'kaşar'], url: READY_IMAGES[5].url },
  { words: ['cips', 'doritos', 'lays'], url: READY_IMAGES[6].url },
  { words: ['kola', 'coca', 'pepsi', 'fanta', 'sprite'], url: READY_IMAGES[7].url },
  { words: ['kek', 'çikolata', 'cikolata', 'gofret'], url: READY_IMAGES[8].url },
  { words: ['elma', 'muz', 'meyve', 'sebze'], url: READY_IMAGES[9].url },
  { words: ['deterjan', 'sabun', 'şampuan'], url: READY_IMAGES[10].url },
  { words: ['dondurma', 'magnum'], url: READY_IMAGES[11].url }
]

export function keywordImage(name) {
  const text = String(name || '').toLocaleLowerCase('tr')
  return KEYWORDS.find((item) => item.words.some((word) => text.includes(word)))?.url || ''
}

export async function searchProductImages(api, token, name) {
  const term = String(name || '').trim()
  const local = keywordImage(term)
  let remote = []
  if (term.length >= 2) {
    try {
      const data = await api(`/api/products/image-search?q=${encodeURIComponent(term)}`, { token })
      remote = Array.isArray(data.images) ? data.images : []
    } catch { /* hazır görsel yeter */ }
  }
  return [...new Set([local, ...remote].filter(Boolean))]
}
