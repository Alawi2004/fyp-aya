// Translations for the mobile app.
// Keys are English; values are the translated string for each locale.
// Add more keys here as needed — screens import t() from this module.

const STRINGS = {
  // ── Tab navigation ──────────────────────────────────────────────────────────
  'Home':       { ar: 'الرئيسية', fr: 'Accueil',   de: 'Startseite', es: 'Inicio',   tr: 'Ana Sayfa' },
  'Trips':      { ar: 'رحلاتي',   fr: 'Trajets',   de: 'Fahrten',    es: 'Viajes',   tr: 'Seyahatler' },
  'Wallet':     { ar: 'المحفظة',  fr: 'Portefeuille', de: 'Geldbörse', es: 'Billetera', tr: 'Cüzdan' },
  'Profile':    { ar: 'الملف',    fr: 'Profil',    de: 'Profil',     es: 'Perfil',   tr: 'Profil' },
  'Dashboard':  { ar: 'لوحة القيادة', fr: 'Tableau de bord', de: 'Dashboard', es: 'Panel',  tr: 'Panel' },
  'Navigate':   { ar: 'الملاحة',  fr: 'Navigation', de: 'Navigation', es: 'Navegar',  tr: 'Navigasyon' },
  'Vehicle':    { ar: 'المركبة',  fr: 'Véhicule',  de: 'Fahrzeug',   es: 'Vehículo', tr: 'Araç' },
  'Earnings':   { ar: 'الأرباح',  fr: 'Revenus',   de: 'Einnahmen',  es: 'Ganancias', tr: 'Kazanç' },
  'History':    { ar: 'السجل',    fr: 'Historique', de: 'Verlauf',    es: 'Historial', tr: 'Geçmiş' },

  // ── Profile screen sections ──────────────────────────────────────────────────
  'Account':         { ar: 'الحساب',     fr: 'Compte',       de: 'Konto',       es: 'Cuenta',    tr: 'Hesap' },
  'Preferences':     { ar: 'التفضيلات',  fr: 'Préférences',  de: 'Einstellungen', es: 'Preferencias', tr: 'Tercihler' },
  'Support':         { ar: 'الدعم',      fr: 'Assistance',   de: 'Support',     es: 'Soporte',   tr: 'Destek' },
  'Danger Zone':     { ar: 'منطقة الخطر', fr: 'Zone dangereuse', de: 'Gefahrenzone', es: 'Zona de peligro', tr: 'Tehlike Bölgesi' },

  // ── Profile menu items ───────────────────────────────────────────────────────
  'Personal Info':     { ar: 'المعلومات الشخصية', fr: 'Infos personnelles', de: 'Persönliche Daten', es: 'Información personal', tr: 'Kişisel Bilgiler' },
  'Notifications':     { ar: 'الإشعارات',  fr: 'Notifications',  de: 'Benachrichtigungen', es: 'Notificaciones', tr: 'Bildirimler' },
  'Privacy Policy':    { ar: 'سياسة الخصوصية', fr: 'Politique de confidentialité', de: 'Datenschutz', es: 'Política de privacidad', tr: 'Gizlilik Politikası' },
  'Help & Support':    { ar: 'المساعدة',   fr: 'Aide & Support',  de: 'Hilfe & Support', es: 'Ayuda y soporte', tr: 'Yardım ve Destek' },
  'Call Support':      { ar: 'اتصل بالدعم', fr: 'Appeler le support', de: 'Support anrufen', es: 'Llamar soporte', tr: 'Destek Ara' },
  'Rate the App':      { ar: 'قيّم التطبيق', fr: "Noter l'appli",  de: 'App bewerten',  es: 'Calificar app',  tr: 'Uygulamayı Değerlendir' },
  'Sign Out':          { ar: 'تسجيل الخروج', fr: 'Se déconnecter', de: 'Abmelden',      es: 'Cerrar sesión', tr: 'Çıkış Yap' },
  'Delete Account':    { ar: 'حذف الحساب', fr: 'Supprimer le compte', de: 'Konto löschen', es: 'Eliminar cuenta', tr: 'Hesabı Sil' },

  // ── Common ───────────────────────────────────────────────────────────────────
  'Cancel':    { ar: 'إلغاء',   fr: 'Annuler',  de: 'Abbrechen', es: 'Cancelar', tr: 'İptal' },
  'Save':      { ar: 'حفظ',     fr: 'Enregistrer', de: 'Speichern', es: 'Guardar', tr: 'Kaydet' },
  'Submit':    { ar: 'إرسال',   fr: 'Soumettre', de: 'Einreichen', es: 'Enviar',  tr: 'Gönder' },
  'Confirm':   { ar: 'تأكيد',   fr: 'Confirmer', de: 'Bestätigen', es: 'Confirmar', tr: 'Onayla' },
  'Book':      { ar: 'احجز',    fr: 'Réserver',  de: 'Buchen',     es: 'Reservar', tr: 'Rezerve Et' },
  'Pay':       { ar: 'ادفع',    fr: 'Payer',     de: 'Bezahlen',   es: 'Pagar',   tr: 'Öde' },
  'Loading...': { ar: 'جار التحميل...', fr: 'Chargement...', de: 'Laden...', es: 'Cargando...', tr: 'Yükleniyor...' },
  'Available Balance': { ar: 'الرصيد المتاح', fr: 'Solde disponible', de: 'Verfügbares Guthaben', es: 'Saldo disponible', tr: 'Mevcut Bakiye' },
  'Top Up':    { ar: 'شحن الرصيد', fr: 'Recharger', de: 'Aufladen', es: 'Recargar', tr: 'Bakiye Yükle' },
  'Transactions': { ar: 'المعاملات', fr: 'Transactions', de: 'Transaktionen', es: 'Transacciones', tr: 'İşlemler' },
};

/**
 * Translate a string to the given locale.
 * Falls back to the original English key if no translation exists.
 */
export function t(key, lang = 'en') {
  if (!lang || lang === 'en') return key;
  return STRINGS[key]?.[lang] ?? key;
}
