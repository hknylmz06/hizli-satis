export const PERMISSIONS = [
  { group: 'Sayfa erişimi', key: 'can_access_pos', title: 'Hızlı Satış (POS)', hint: 'Kasa ekranını kullanabilme' },
  { group: 'Sayfa erişimi', key: 'can_access_invoices', title: 'Faturalar', hint: 'Alış faturalarına erişim' },
  { group: 'Sayfa erişimi', key: 'can_access_reports', title: 'Raporlar', hint: 'Kâr, zarar ve kasa raporları' },
  { group: 'Sayfa erişimi', key: 'can_access_definitions', title: 'Tanımlamalar', hint: 'Stok, cari, kategori' },
  { group: 'Sayfa erişimi', key: 'can_access_settings', title: 'Sistem ayarları', hint: 'Yazarkasa ve cihaz ayarları' },
  { group: 'Sayfa erişimi', key: 'can_manage_users', title: 'Kullanıcı ve yetki', hint: 'Personel ekleme ve yetkilendirme' },
  { group: 'Kasa', key: 'can_discount', title: 'İskonto', hint: 'Satışta indirim uygulayabilme' },
  { group: 'Kasa', key: 'can_clear_cart', title: 'Sepeti silme', hint: 'Sepetteki kalemi veya sepeti temizleme' },
  { group: 'Kasa', key: 'can_credit_sale', title: 'Veresiye', hint: 'Açık hesap satış (F9)' },
  { group: 'Kasa', key: 'can_view_cost', title: 'Maliyet ve kâr', hint: 'Alış fiyatı ve kâr görme' },
  { group: 'Kasa', key: 'can_edit_products', title: 'Ürün ve fiyat', hint: 'Ürün ekleme ve fiyat değiştirme' },
  { group: 'Kasa', key: 'can_delete_records', title: 'Kayıt silme', hint: 'Ürün ve cari silme' }
]

export const CASHIER_DEFAULTS = {
  can_access_pos: true,
  can_access_invoices: false,
  can_access_reports: false,
  can_access_definitions: false,
  can_access_settings: false,
  can_manage_users: false,
  can_discount: false,
  can_clear_cart: true,
  can_credit_sale: false,
  can_view_cost: false,
  can_edit_products: false,
  can_delete_records: false
}

export function allPermissions(on) {
  return Object.fromEntries(PERMISSIONS.map((item) => [item.key, on]))
}

export function allows(session, key) {
  if (!session || session.role === 'PlatformAdmin') return true
  if (session.tenantRole === 'Admin') return true
  if (!session.permissions) {
    if (!session.tenantRole) return true
    return CASHIER_DEFAULTS[key] === true
  }
  return session.permissions[key] === true
}
