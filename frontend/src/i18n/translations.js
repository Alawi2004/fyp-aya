// Translations for the mobile app.
// Keys are English; values are the translated string for each locale.
// Add more keys here as needed — screens import t() from this module.

const STRINGS = {
  // ── Tab navigation ──────────────────────────────────────────────────────────
  'Home':       { ar: 'الرئيسية', fr: 'Accueil',   de: 'Startseite', es: 'Inicio',   tr: 'Ana Sayfa' },
  'Trips':      { ar: 'رحلات',    fr: 'Trajets',   de: 'Fahrten',    es: 'Viajes',   tr: 'Seyahatler' },
  'Wallet':     { ar: 'المحفظة',  fr: 'Portefeuille', de: 'Geldbörse', es: 'Billetera', tr: 'Cüzdan' },
  'Profile':    { ar: 'الملف',    fr: 'Profil',    de: 'Profil',     es: 'Perfil',   tr: 'Profil' },
  'Dashboard':  { ar: 'لوحة القيادة', fr: 'Tableau de bord', de: 'Dashboard', es: 'Panel',  tr: 'Panel' },
  'Navigate':   { ar: 'الملاحة',  fr: 'Navigation', de: 'Navigation', es: 'Navegar',  tr: 'Navigasyon' },
  'Vehicle':    { ar: 'المركبة',  fr: 'Véhicule',  de: 'Fahrzeug',   es: 'Vehículo', tr: 'Araç' },
  'Earnings':   { ar: 'الأرباح',  fr: 'Revenus',   de: 'Einnahmen',  es: 'Ganancias', tr: 'Kazanç' },
  'History':    { ar: 'السجل',    fr: 'Historique', de: 'Verlauf',    es: 'Historial', tr: 'Geçmiş' },

  // ── Vehicle types ────────────────────────────────────────────────────────────
  'All':      { ar: 'الكل',     fr: 'Tous',     de: 'Alle',    es: 'Todos',    tr: 'Hepsi' },
  'Bus':      { ar: 'باص',      fr: 'Bus',      de: 'Bus',     es: 'Autobús',  tr: 'Otobüs' },
  'Van':      { ar: 'فان',      fr: 'Fourgon',  de: 'Van',     es: 'Furgoneta', tr: 'Van' },
  'Taxi':     { ar: 'تاكسي',    fr: 'Taxi',     de: 'Taxi',    es: 'Taxi',     tr: 'Taksi' },
  'Tuktuk':   { ar: 'توك توك',  fr: 'Tuk-tuk',  de: 'Tuk-tuk', es: 'Tuk-tuk',  tr: 'Tuk-tuk' },
  'Shuttle':  { ar: 'سيارة أجرة صغيرة', fr: 'Navette', de: 'Shuttle', es: 'Lanzadera', tr: 'Servis' },
  'Minivan':  { ar: 'ميني فان', fr: 'Minibus',  de: 'Minivan', es: 'Minivan',  tr: 'Minivan' },

  // ── Status labels ────────────────────────────────────────────────────────────
  'Active':    { ar: 'نشط',       fr: 'Actif',        de: 'Aktiv',          es: 'Activo',     tr: 'Aktif' },
  'Boarding':  { ar: 'في الصعود', fr: 'Embarquement', de: 'Einstieg',       es: 'Abordaje',   tr: 'Biniş' },
  'Delayed':   { ar: 'متأخر',     fr: 'Retardé',      de: 'Verspätet',      es: 'Retrasado',  tr: 'Gecikmiş' },
  'Upcoming':  { ar: 'قادمة',     fr: 'À venir',      de: 'Bevorstehend',   es: 'Próximo',    tr: 'Yaklaşan' },
  'Completed': { ar: 'مكتملة',    fr: 'Terminé',      de: 'Abgeschlossen',  es: 'Completado', tr: 'Tamamlandı' },
  'Cancelled': { ar: 'ملغاة',     fr: 'Annulé',       de: 'Storniert',      es: 'Cancelado',  tr: 'İptal Edildi' },
  'Scheduled': { ar: 'مجدولة',    fr: 'Planifié',     de: 'Geplant',        es: 'Programado', tr: 'Planlandı' },
  'Confirmed': { ar: 'مؤكد',      fr: 'Confirmé',     de: 'Bestätigt',      es: 'Confirmado', tr: 'Onaylandı' },
  'Frozen':    { ar: 'مجمد',      fr: 'Gelé',         de: 'Eingefroren',    es: 'Congelado',  tr: 'Dondurulmuş' },
  'Ongoing':   { ar: 'جارٍ',      fr: 'En cours',     de: 'Laufend',        es: 'En curso',   tr: 'Devam Eden' },

  // ── Greetings ────────────────────────────────────────────────────────────────
  'Good morning':   { ar: 'صباح الخير',  fr: 'Bonjour',         de: 'Guten Morgen',     es: 'Buenos días',    tr: 'Günaydın' },
  'Good afternoon': { ar: 'مساء الخير',  fr: 'Bon après-midi',  de: 'Guten Nachmittag', es: 'Buenas tardes',  tr: 'İyi öğleden sonra' },
  'Good evening':   { ar: 'مساء الخير',  fr: 'Bonsoir',         de: 'Guten Abend',      es: 'Buenas noches',  tr: 'İyi akşamlar' },

  // ── Quick actions ────────────────────────────────────────────────────────────
  'Plan Trip':      { ar: 'تخطيط رحلة',   fr: 'Planifier',        de: 'Reise planen',      es: 'Planificar',      tr: 'Yolculuk Planla' },
  'Reserve Taxi':   { ar: 'حجز تاكسي',    fr: 'Réserver taxi',    de: 'Taxi buchen',       es: 'Reservar taxi',   tr: 'Taksi Rezerve Et' },
  'Nearby Stops':   { ar: 'محطات قريبة',  fr: 'Arrêts proches',   de: 'Nahe Haltestellen', es: 'Paradas cercanas', tr: 'Yakın Duraklar' },
  'Saved':          { ar: 'المحفوظات',    fr: 'Enregistrés',      de: 'Gespeichert',       es: 'Guardados',       tr: 'Kaydedilenler' },

  // ── Section titles ───────────────────────────────────────────────────────────
  'Available Rides':  { ar: 'الرحلات المتاحة',  fr: 'Trajets disponibles',  de: 'Verfügbare Fahrten',   es: 'Viajes disponibles',  tr: 'Mevcut Yolculuklar' },
  'My Trips':         { ar: 'رحلاتي',            fr: 'Mes trajets',          de: 'Meine Fahrten',        es: 'Mis viajes',          tr: 'Seyahatlerim' },
  'Top-Up Stations':  { ar: 'محطات الشحن',       fr: 'Stations de recharge', de: 'Aufladestationen',     es: 'Estaciones de recarga', tr: 'Yükleme İstasyonları' },
  'Active Ride':      { ar: 'الرحلة النشطة',     fr: 'Trajet en cours',      de: 'Aktive Fahrt',         es: 'Viaje activo',        tr: 'Aktif Seyahat' },
  'Quick Actions':    { ar: 'إجراءات سريعة',     fr: 'Actions rapides',      de: 'Schnellaktionen',      es: 'Acciones rápidas',    tr: 'Hızlı İşlemler' },
  'Route Info':       { ar: 'معلومات الخط',       fr: 'Infos sur le trajet',  de: 'Routeninfo',           es: 'Info de ruta',        tr: 'Rota Bilgisi' },
  'Trip Details':     { ar: 'تفاصيل الرحلة',     fr: 'Détails du trajet',    de: 'Reisedetails',         es: 'Detalles del viaje',  tr: 'Seyahat Detayları' },
  'Stop Info':        { ar: 'معلومات المحطة',     fr: 'Info arrêt',           de: 'Haltestelleninfo',     es: 'Info de parada',      tr: 'Durak Bilgisi' },

  // ── Wallet labels ────────────────────────────────────────────────────────────
  'Available Balance':    { ar: 'الرصيد المتاح',      fr: 'Solde disponible',         de: 'Verfügbares Guthaben',  es: 'Saldo disponible',     tr: 'Mevcut Bakiye' },
  'Available balance':    { ar: 'الرصيد المتاح',      fr: 'Solde disponible',         de: 'Verfügbares Guthaben',  es: 'Saldo disponible',     tr: 'Mevcut Bakiye' },
  'Top Up':               { ar: 'شحن الرصيد',          fr: 'Recharger',                de: 'Aufladen',              es: 'Recargar',             tr: 'Bakiye Yükle' },
  'Top Up Wallet':        { ar: 'شحن المحفظة',         fr: 'Recharger le portefeuille', de: 'Geldbörse aufladen',   es: 'Recargar billetera',   tr: 'Cüzdanı Doldur' },
  'Transactions':         { ar: 'المعاملات',           fr: 'Transactions',             de: 'Transaktionen',         es: 'Transacciones',        tr: 'İşlemler' },
  'Total Spent':          { ar: 'إجمالي الإنفاق',     fr: 'Total dépensé',            de: 'Gesamt ausgegeben',     es: 'Total gastado',        tr: 'Toplam Harcama' },
  'Trips Paid':           { ar: 'رحلات مدفوعة',       fr: 'Trajets payés',            de: 'Bezahlte Fahrten',      es: 'Viajes pagados',       tr: 'Ödenen Seyahatler' },
  'Show to Cashier':      { ar: 'أظهر للكاشير',       fr: 'Montrer au caissier',      de: 'Kassier zeigen',        es: 'Mostrar al cajero',    tr: 'Kasiyere Göster' },
  'Top Up at a Counter':  { ar: 'شحن في نقطة بيع',   fr: 'Recharger au comptoir',    de: 'An Kasse aufladen',     es: 'Recargar en mostrador', tr: 'Sayaçta Yükle' },
  'Scan your code to top up instantly': { ar: 'امسح الرمز لشحن فوري', fr: 'Scannez pour recharger', de: 'Code scannen zum Aufladen', es: 'Escanea para recargar', tr: 'Anında yükleme için kodu tarat' },
  'Wallet Frozen':        { ar: 'المحفظة مجمدة',      fr: 'Portefeuille gelé',        de: 'Geldbörse eingefroren', es: 'Billetera congelada',  tr: 'Cüzdan Dondurulmuş' },
  'Yalla Wallet':         { ar: 'يلا والت',            fr: 'Yalla Wallet',             de: 'Yalla Wallet',          es: 'Yalla Wallet',         tr: 'Yalla Cüzdanı' },
  'Map':                  { ar: 'الخريطة',             fr: 'Carte',                    de: 'Karte',                 es: 'Mapa',                 tr: 'Harita' },
  'List':                 { ar: 'القائمة',             fr: 'Liste',                    de: 'Liste',                 es: 'Lista',                tr: 'Liste' },
  'All Txns':             { ar: 'كل المعاملات',        fr: 'Toutes',                   de: 'Alle',                  es: 'Todas',                tr: 'Hepsi' },
  'Top-Ups':              { ar: 'عمليات الشحن',        fr: 'Rechargements',            de: 'Aufladungen',           es: 'Recargas',             tr: 'Yüklemeler' },
  'Payments':             { ar: 'المدفوعات',           fr: 'Paiements',                de: 'Zahlungen',             es: 'Pagos',                tr: 'Ödemeler' },
  'Wallet Top-Up':        { ar: 'شحن المحفظة',         fr: 'Rechargement',             de: 'Wallet-Aufladung',      es: 'Recarga de billetera', tr: 'Cüzdan Yüklemesi' },
  'Trip Payment':         { ar: 'دفع رحلة',            fr: 'Paiement trajet',          de: 'Fahrtbezahlung',        es: 'Pago de viaje',        tr: 'Yolculuk Ödemesi' },
  'Fare deducted from wallet': { ar: 'خُصم الأجر من المحفظة', fr: 'Tarif déduit du portefeuille', de: 'Fahrpreis vom Guthaben abgezogen', es: 'Tarifa deducida de billetera', tr: 'Ücret cüzdandan düşüldü' },
  'In-person recharge':   { ar: 'شحن شخصي',            fr: 'Recharge en personne',     de: 'Persönliche Aufladung', es: 'Recarga presencial',   tr: 'Yüz yüze yükleme' },
  'Today':      { ar: 'اليوم',       fr: "Aujourd'hui", de: 'Heute',     es: 'Hoy',       tr: 'Bugün' },
  'Yesterday':  { ar: 'أمس',         fr: 'Hier',         de: 'Gestern',   es: 'Ayer',      tr: 'Dün' },

  // ── Booking labels ───────────────────────────────────────────────────────────
  'Book a Seat':          { ar: 'احجز مقعداً',    fr: 'Réserver une place',    de: 'Platz buchen',     es: 'Reservar asiento',  tr: 'Koltuk Rezerve Et' },
  'Book Now':             { ar: 'احجز الآن',      fr: 'Réserver maintenant',   de: 'Jetzt buchen',     es: 'Reservar ahora',    tr: 'Şimdi Rezerve Et' },
  'Price / Seat':         { ar: 'السعر / مقعد',   fr: 'Prix / place',          de: 'Preis / Platz',    es: 'Precio / asiento',  tr: 'Fiyat / Koltuk' },
  'Your Balance':         { ar: 'رصيدك',          fr: 'Votre solde',           de: 'Ihr Guthaben',     es: 'Tu saldo',          tr: 'Bakiyeniz' },
  'Insufficient Balance': { ar: 'رصيد غير كافٍ',  fr: 'Solde insuffisant',     de: 'Unzureicendes Guthaben', es: 'Saldo insuficiente', tr: 'Yetersiz Bakiye' },
  'per seat':             { ar: 'لكل مقعد',       fr: 'par place',             de: 'pro Platz',        es: 'por asiento',       tr: 'koltuk başına' },
  'FROM':                 { ar: 'من',             fr: 'DE',                    de: 'VON',              es: 'DE',                tr: 'DAN' },
  'TO':                   { ar: 'إلى',            fr: 'À',                     de: 'NACH',             es: 'A',                 tr: 'A' },
  'seats available':      { ar: 'مقاعد متاحة',    fr: 'places disponibles',    de: 'Plätze verfügbar', es: 'asientos disponibles', tr: 'koltuk mevcut' },
  'seat':                 { ar: 'مقعد',           fr: 'place',                 de: 'Platz',            es: 'asiento',           tr: 'koltuk' },
  'Seats':                { ar: 'المقاعد',        fr: 'Places',                de: 'Plätze',           es: 'Asientos',          tr: 'Koltuklar' },
  'Choose Your Seat':     { ar: 'اختر مقعدك',     fr: 'Choisissez votre place', de: 'Wählen Sie Ihren Platz', es: 'Elige tu asiento', tr: 'Koltuğunuzu Seçin' },
  'Available':            { ar: 'متاح',           fr: 'Disponible',            de: 'Verfügbar',        es: 'Disponible',        tr: 'Müsait' },
  'Selected':             { ar: 'محدد',           fr: 'Sélectionné',           de: 'Ausgewählt',       es: 'Seleccionado',      tr: 'Seçildi' },
  'Booked':               { ar: 'محجوز',          fr: 'Réservé',               de: 'Gebucht',          es: 'Reservado',         tr: 'Dolu' },
  'Shortfall':            { ar: 'العجز',          fr: 'Manque',                de: 'Fehlbetrag',       es: 'Déficit',           tr: 'Açık' },

  // ── Ticket labels ────────────────────────────────────────────────────────────
  'Your Ticket':              { ar: 'تذكرتك',           fr: 'Votre billet',             de: 'Ihr Ticket',               es: 'Tu boleto',          tr: 'Biletiniz' },
  'Present QR code to board': { ar: 'اعرض رمز QR للصعود', fr: 'Présentez le QR pour monter', de: 'QR-Code zum Einsteigen zeigen', es: 'Muestra QR para abordar', tr: 'Binmek için QR kodu gösterin' },
  'Booking Confirmed':        { ar: 'الحجز مؤكد',       fr: 'Réservation confirmée',    de: 'Buchung bestätigt',        es: 'Reserva confirmada', tr: 'Rezervasyon onaylandı' },
  'Offline Mode':             { ar: 'وضع عدم الاتصال',  fr: 'Mode hors ligne',          de: 'Offline-Modus',            es: 'Modo sin conexión',  tr: 'Çevrimdışı Mod' },

  // ── Trip history actions ──────────────────────────────────────────────────────
  'View Ticket':  { ar: 'عرض التذكرة',  fr: 'Voir le billet',  de: 'Ticket anzeigen', es: 'Ver boleto',    tr: 'Bileti Gör' },
  'Track Bus':    { ar: 'تتبع الباص',   fr: 'Suivre le bus',   de: 'Bus verfolgen',   es: 'Rastrear bus',  tr: 'Otobüsü Takip Et' },
  'Track':        { ar: 'تتبع',         fr: 'Suivre',          de: 'Verfolgen',       es: 'Rastrear',      tr: 'Takip Et' },
  'Rate':         { ar: 'قيّم',          fr: 'Évaluer',         de: 'Bewerten',        es: 'Calificar',     tr: 'Değerlendir' },
  'Complaint':    { ar: 'شكوى',         fr: 'Réclamation',     de: 'Beschwerde',      es: 'Queja',         tr: 'Şikayet' },
  'Export':       { ar: 'تصدير',        fr: 'Exporter',        de: 'Exportieren',     es: 'Exportar',      tr: 'Dışa Aktar' },
  'No trips found':   { ar: 'لا توجد رحلات',     fr: 'Aucun trajet',      de: 'Keine Fahrten',   es: 'Sin viajes',    tr: 'Yolculuk yok' },
  'bookings total':   { ar: 'إجمالي الحجوزات',  fr: 'réservations',      de: 'Buchungen',       es: 'reservas',      tr: 'rezervasyon' },
  'found':            { ar: 'موجود',             fr: 'trouvé',            de: 'gefunden',        es: 'encontrado',    tr: 'bulundu' },

  // ── Driver map strings ───────────────────────────────────────────────────────
  'Start Trip':            { ar: 'بدء الرحلة',    fr: 'Démarrer le trajet', de: 'Fahrt starten',  es: 'Iniciar viaje',   tr: 'Seyahati Başlat' },
  'End Trip':              { ar: 'إنهاء الرحلة',  fr: 'Terminer le trajet', de: 'Fahrt beenden',  es: 'Finalizar viaje', tr: 'Seyahati Bitir' },
  'Cancel Trip':           { ar: 'إلغاء الرحلة',  fr: 'Annuler le trajet',  de: 'Fahrt abbrechen', es: 'Cancelar viaje', tr: 'Seyahati İptal Et' },
  'Next Stop':             { ar: 'المحطة التالية', fr: 'Prochain arrêt',     de: 'Nächste Station', es: 'Próxima parada', tr: 'Sonraki Durak' },
  'Location Access Needed': { ar: 'يلزم إذن الموقع', fr: 'Accès localisation nécessaire', de: 'Standortzugriff erforderlich', es: 'Se necesita acceso de ubicación', tr: 'Konum Erişimi Gerekli' },
  'Getting GPS...':        { ar: 'جار تحديد الموقع...', fr: 'Localisation...', de: 'GPS wird ermittelt...', es: 'Obteniendo GPS...', tr: 'GPS alınıyor...' },
  'Off Route':             { ar: 'خارج المسار',   fr: 'Hors itinéraire',    de: 'Vom Kurs abgekommen', es: 'Fuera de ruta', tr: 'Rotadan Çıkıldı' },

  // ── Taxi reservation ─────────────────────────────────────────────────────────
  'Choose your ride':    { ar: 'اختر وسيلتك',    fr: 'Choisissez votre véhicule', de: 'Fahrzeug wählen', es: 'Elige tu vehículo', tr: 'Aracını Seç' },
  'Confirm Booking':     { ar: 'تأكيد الحجز',    fr: 'Confirmer la réservation',  de: 'Buchung bestätigen', es: 'Confirmar reserva', tr: 'Rezervasyonu Onayla' },
  'Confirm Reservation': { ar: 'تأكيد الحجز',    fr: 'Confirmer la réservation',  de: 'Reservierung bestätigen', es: 'Confirmar reserva', tr: 'Rezervasyonu Onayla' },

  // ── Driver dashboard strings ─────────────────────────────────────────────────
  'Scan QR':               { ar: 'مسح QR',         fr: 'Scanner QR',        de: 'QR scannen',         es: 'Escanear QR',      tr: 'QR Tara' },
  'Schedule':              { ar: 'الجدول',          fr: 'Horaire',           de: 'Zeitplan',           es: 'Horario',          tr: 'Program' },
  'Emergency':             { ar: 'طوارئ',           fr: 'Urgence',           de: 'Notfall',            es: 'Emergencia',       tr: 'Acil Durum' },
  'Active Trip in Progress': { ar: 'رحلة نشطة جارية', fr: 'Trajet actif en cours', de: 'Aktive Fahrt läuft', es: 'Viaje activo en curso', tr: 'Aktif Seyahat Devam Ediyor' },
  'Open Map':              { ar: 'افتح الخريطة',   fr: 'Ouvrir la carte',   de: 'Karte öffnen',       es: 'Abrir mapa',       tr: 'Haritayı Aç' },
  "Today's Schedule":      { ar: 'جدول اليوم',     fr: "Planning du jour",  de: 'Heutiger Zeitplan',  es: 'Programa de hoy',  tr: 'Bugünün Programı' },
  'Week View':             { ar: 'عرض الأسبوع',    fr: 'Vue semaine',       de: 'Wochenansicht',      es: 'Vista semanal',    tr: 'Haftalık Görünüm' },

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
  'Language':          { ar: 'اللغة',      fr: 'Langue',            de: 'Sprache',       es: 'Idioma',          tr: 'Dil' },
  'Currency':          { ar: 'العملة',     fr: 'Devise',            de: 'Währung',       es: 'Moneda',          tr: 'Para Birimi' },
  'Select Language':   { ar: 'اختر اللغة', fr: 'Choisir la langue', de: 'Sprache wählen', es: 'Seleccionar idioma', tr: 'Dil Seç' },
  'Select Currency':   { ar: 'اختر العملة', fr: 'Choisir la devise', de: 'Währung wählen', es: 'Seleccionar moneda', tr: 'Para Birimi Seç' },

  // ── Common buttons / labels ──────────────────────────────────────────────────
  'Cancel':    { ar: 'إلغاء',   fr: 'Annuler',     de: 'Abbrechen',  es: 'Cancelar', tr: 'İptal' },
  'Save':      { ar: 'حفظ',     fr: 'Enregistrer', de: 'Speichern',  es: 'Guardar',  tr: 'Kaydet' },
  'Submit':    { ar: 'إرسال',   fr: 'Soumettre',   de: 'Einreichen', es: 'Enviar',   tr: 'Gönder' },
  'Confirm':   { ar: 'تأكيد',   fr: 'Confirmer',   de: 'Bestätigen', es: 'Confirmar', tr: 'Onayla' },
  'Book':      { ar: 'احجز',    fr: 'Réserver',    de: 'Buchen',     es: 'Reservar', tr: 'Rezerve Et' },
  'Pay':       { ar: 'ادفع',    fr: 'Payer',       de: 'Bezahlen',   es: 'Pagar',    tr: 'Öde' },
  'Share':     { ar: 'مشاركة',  fr: 'Partager',    de: 'Teilen',     es: 'Compartir', tr: 'Paylaş' },
  'Close':     { ar: 'إغلاق',   fr: 'Fermer',      de: 'Schließen',  es: 'Cerrar',   tr: 'Kapat' },
  'Back':      { ar: 'رجوع',    fr: 'Retour',      de: 'Zurück',     es: 'Atrás',    tr: 'Geri' },
  'Search':    { ar: 'بحث',     fr: 'Rechercher',  de: 'Suchen',     es: 'Buscar',   tr: 'Ara' },
  'Loading...': { ar: 'جار التحميل...', fr: 'Chargement...', de: 'Laden...', es: 'Cargando...', tr: 'Yükleniyor...' },

  // ── Time labels ──────────────────────────────────────────────────────────────
  'Just now':   { ar: 'الآن',           fr: "À l'instant",  de: 'Gerade eben',  es: 'Ahora mismo',  tr: 'Hemen şimdi' },
  'min':        { ar: 'د',              fr: 'min',           de: 'Min.',         es: 'min',          tr: 'dk' },
  'hr':         { ar: 'س',              fr: 'h',             de: 'Std.',         es: 'h',            tr: 'sa' },
  'mins ago':   { ar: 'دقائق مضت',      fr: 'min. ago',      de: 'Min. vor',     es: 'min atrás',    tr: 'dk önce' },
  'hrs ago':    { ar: 'ساعات مضت',      fr: 'h ago',         de: 'Std. vor',     es: 'h atrás',      tr: 'sa önce' },
  'arriving in':{ ar: 'يصل خلال',       fr: 'arrivée dans',  de: 'ankommt in',   es: 'llega en',     tr: 'varış zamanı' },
  'on time':    { ar: 'في الموعد',      fr: 'à l\'heure',    de: 'pünktlich',    es: 'a tiempo',     tr: 'zamanında' },
  'On Time':    { ar: 'في الموعد',      fr: 'À l\'heure',    de: 'Pünktlich',    es: 'A tiempo',     tr: 'Zamanında' },
  'Full':       { ar: 'ممتلئ',          fr: 'Complet',       de: 'Voll',         es: 'Lleno',        tr: 'Dolu' },
  'via':        { ar: 'عبر',            fr: 'via',           de: 'über',         es: 'vía',          tr: 'ile' },
  'Transfer':   { ar: 'تحويل',          fr: 'Correspondance', de: 'Umstieg',     es: 'Trasbordo',    tr: 'Aktarma' },
  'Walk':       { ar: 'مشياً',          fr: 'à pied',        de: 'zu Fuß',       es: 'a pie',        tr: 'yürüyerek' },
  'Free':       { ar: 'مجاني',          fr: 'Gratuit',       de: 'Kostenlos',    es: 'Gratis',       tr: 'Ücretsiz' },
  'free':       { ar: 'خالٍ',           fr: 'libre',         de: 'frei',         es: 'libre',        tr: 'serbest' },
  'Now':        { ar: 'الآن',           fr: 'Maintenant',    de: 'Jetzt',        es: 'Ahora',        tr: 'Şimdi' },
  'Live Tracking':  { ar: 'تتبع مباشر', fr: 'Suivi en direct', de: 'Live-Verfolgung', es: 'Seguimiento en vivo', tr: 'Canlı Takip' },
  'Connecting...':  { ar: 'جار الاتصال...', fr: 'Connexion...', de: 'Verbinde...', es: 'Conectando...', tr: 'Bağlanıyor...' },
  'Seat Availability': { ar: 'توفر المقاعد', fr: 'Disponibilité des places', de: 'Sitzplatzverfügbarkeit', es: 'Disponibilidad de asientos', tr: 'Koltuk Müsaitliği' },
  'Upcoming Stops':    { ar: 'المحطات القادمة', fr: 'Prochains arrêts', de: 'Nächste Haltestellen', es: 'Próximas paradas', tr: 'Yaklaşan Duraklar' },
  'Report an Issue':   { ar: 'الإبلاغ عن مشكلة', fr: 'Signaler un problème', de: 'Problem melden', es: 'Reportar un problema', tr: 'Sorun Bildir' },
  'Road dist.':        { ar: 'المسافة',  fr: 'Dist. route',   de: 'Strecke',      es: 'Dist. carretera', tr: 'Yol mesafesi' },
  'GPS signal':        { ar: 'إشارة GPS', fr: 'Signal GPS',   de: 'GPS-Signal',   es: 'Señal GPS',    tr: 'GPS Sinyali' },
  'At stop':           { ar: 'عند المحطة', fr: 'À l\'arrêt',  de: 'An der Haltestelle', es: 'En parada', tr: 'Durağa vardı' },
  'Per km':     { ar: 'لكل كم',         fr: 'Par km',        de: 'Pro km',       es: 'Por km',       tr: 'Km başına' },
  'Refund':     { ar: 'استرداد',        fr: 'Remboursement', de: 'Rückerstattung', es: 'Reembolso',  tr: 'İade' },
  'Fare':       { ar: 'الأجرة',         fr: 'Tarif',         de: 'Fahrpreis',    es: 'Tarifa',       tr: 'Ücret' },
  'Amount':     { ar: 'المبلغ',         fr: 'Montant',       de: 'Betrag',       es: 'Importe',      tr: 'Tutar' },
  'Balance':    { ar: 'الرصيد',         fr: 'Solde',         de: 'Guthaben',     es: 'Saldo',        tr: 'Bakiye' },
  'Total':      { ar: 'الإجمالي',       fr: 'Total',         de: 'Gesamt',       es: 'Total',        tr: 'Toplam' },

  // ── Earnings screen ───────────────────────────────────────────────────────────
  'Total Earned':     { ar: 'إجمالي المكاسب',         fr: 'Total gagné',                   de: 'Gesamtverdienst',                  es: 'Total ganado',               tr: 'Toplam Kazanç' },
  'Passengers':       { ar: 'الركاب',                  fr: 'Passagers',                     de: 'Fahrgäste',                        es: 'Pasajeros',                  tr: 'Yolcular' },
  'Per Trip':         { ar: 'لكل رحلة',                fr: 'Par trajet',                    de: 'Pro Fahrt',                        es: 'Por viaje',                  tr: 'Yolculuk başına' },
  'Earnings by Route':{ ar: 'الأرباح حسب الخط',       fr: 'Revenus par ligne',             de: 'Einnahmen nach Route',             es: 'Ganancias por ruta',         tr: 'Güzergaha Göre Kazanç' },
  'Trip Earnings':    { ar: 'أرباح الرحلات',           fr: 'Revenus des trajets',           de: 'Fahrteinnahmen',                   es: 'Ganancias de viaje',         tr: 'Yolculuk Kazançları' },
  'No earnings in this period': { ar: 'لا أرباح في هذه الفترة', fr: 'Aucun revenu sur cette période', de: 'Keine Einnahmen in diesem Zeitraum', es: 'Sin ganancias en este período', tr: 'Bu dönemde kazanç yok' },
  'Completed trips will appear here.': { ar: 'ستظهر الرحلات المكتملة هنا.', fr: 'Les trajets terminés apparaîtront ici.', de: 'Abgeschlossene Fahrten erscheinen hier.', es: 'Los viajes completados aparecerán aquí.', tr: 'Tamamlanan yolculuklar burada görünecek.' },
  'pax':              { ar: 'راكب',                    fr: 'pax',                           de: 'Pax',                              es: 'pax',                        tr: 'yolcu' },
  'Journey':          { ar: 'الرحلة',                  fr: 'Trajet',                        de: 'Fahrt',                            es: 'Trayecto',                   tr: 'Yolculuk' },
  'Date':             { ar: 'التاريخ',                 fr: 'Date',                          de: 'Datum',                            es: 'Fecha',                      tr: 'Tarih' },
  'Time':             { ar: 'الوقت',                   fr: 'Heure',                         de: 'Uhrzeit',                          es: 'Hora',                       tr: 'Saat' },
  'Duration':         { ar: 'المدة',                   fr: 'Durée',                         de: 'Dauer',                            es: 'Duración',                   tr: 'Süre' },
  'Trip ID':          { ar: 'رقم الرحلة',              fr: 'ID trajet',                     de: 'Fahrt-ID',                         es: 'ID de viaje',                tr: 'Yolculuk ID' },
  'Retry':            { ar: 'إعادة المحاولة',           fr: 'Réessayer',                     de: 'Wiederholen',                      es: 'Reintentar',                 tr: 'Yeniden Dene' },
  'Week':             { ar: 'أسبوع',                   fr: 'Semaine',                       de: 'Woche',                            es: 'Semana',                     tr: 'Hafta' },
  'Month':            { ar: 'شهر',                     fr: 'Mois',                          de: 'Monat',                            es: 'Mes',                        tr: 'Ay' },
  'All Time':         { ar: 'كل الوقت',               fr: 'Tout le temps',                 de: 'Gesamt',                           es: 'Todo el tiempo',             tr: 'Tüm Zamanlar' },

  // ── Weekly schedule ───────────────────────────────────────────────────────────
  'Weekly Schedule':  { ar: 'الجدول الأسبوعي',        fr: 'Planning hebdomadaire',         de: 'Wochenplan',                       es: 'Horario semanal',            tr: 'Haftalık Program' },
  'trips':            { ar: 'رحلات',                   fr: 'trajets',                       de: 'Fahrten',                          es: 'viajes',                     tr: 'yolculuk' },
  'working days':     { ar: 'أيام عمل',                fr: 'jours travaillés',              de: 'Arbeitstage',                      es: 'días laborales',             tr: 'çalışma günü' },
  'Rest day':         { ar: 'يوم راحة',                fr: 'Jour de repos',                 de: 'Ruhetag',                          es: 'Día de descanso',            tr: 'Dinlenme günü' },
  'No trips scheduled — enjoy your day off!': { ar: 'لا رحلات مجدولة — استمتع بيومك!', fr: 'Aucun trajet planifié — profitez de votre repos !', de: 'Keine Fahrten geplant — genießen Sie Ihren freien Tag!', es: 'Sin viajes programados — ¡disfruta tu día libre!', tr: 'Planlanmış yolculuk yok — izninizi iyi geçirin!' },
  'Off':              { ar: 'إجازة',                   fr: 'Repos',                         de: 'Frei',                             es: 'Libre',                      tr: 'İzin' },
  'Done':             { ar: 'منجز',                    fr: 'Terminé',                       de: 'Erledigt',                         es: 'Hecho',                      tr: 'Yapıldı' },
  'full':             { ar: 'ممتلئ',                   fr: 'plein',                         de: 'voll',                             es: 'lleno',                      tr: 'dolu' },

  // ── Vehicle status screen ─────────────────────────────────────────────────────
  'Vehicle Status':       { ar: 'حالة المركبة',        fr: 'État du véhicule',         de: 'Fahrzeugstatus',            es: 'Estado del vehículo',     tr: 'Araç Durumu' },
  'Operational':          { ar: 'يعمل بشكل طبيعي',    fr: 'Opérationnel',             de: 'Betriebsbereit',            es: 'Operativo',               tr: 'Faal' },
  'In Maintenance':       { ar: 'في الصيانة',          fr: 'En maintenance',           de: 'In Wartung',                es: 'En mantenimiento',        tr: 'Bakımda' },
  'Inactive':             { ar: 'غير نشط',             fr: 'Inactif',                  de: 'Inaktiv',                   es: 'Inactivo',                tr: 'Aktif Değil' },
  'No vehicle assigned':  { ar: 'لا مركبة معينة',      fr: 'Aucun véhicule assigné',   de: 'Kein Fahrzeug zugewiesen', es: 'Sin vehículo asignado',   tr: 'Araç atanmadı' },
  'Odometer':             { ar: 'عداد المسافة',        fr: 'Odomètre',                 de: 'Kilometerstand',            es: 'Odómetro',                tr: 'Kilometre Sayacı' },
  'Next Service':         { ar: 'الخدمة القادمة',      fr: 'Prochain entretien',       de: 'Nächste Wartung',           es: 'Próximo servicio',        tr: 'Sonraki Bakım' },
  'Capacity':             { ar: 'السعة',               fr: 'Capacité',                 de: 'Kapazität',                 es: 'Capacidad',               tr: 'Kapasite' },
  'Model':                { ar: 'الطراز',              fr: 'Modèle',                   de: 'Modell',                    es: 'Modelo',                  tr: 'Model' },
  'Plate No.':            { ar: 'لوحة الترخيص',       fr: 'No. plaque',               de: 'Kennzeichen',               es: 'Matrícula',               tr: 'Plaka No.' },
  'Last Service':         { ar: 'آخر صيانة',           fr: 'Dernier entretien',        de: 'Letzte Wartung',            es: 'Último servicio',         tr: 'Son Bakım' },
  'Maintenance':          { ar: 'الصيانة',             fr: 'Maintenance',              de: 'Wartung',                   es: 'Mantenimiento',           tr: 'Bakım' },
  'Scheduled Service':    { ar: 'الخدمة المجدولة',    fr: 'Entretien planifié',       de: 'Geplanter Service',         es: 'Servicio programado',     tr: 'Planlanmış Bakım' },
  'Vehicle Specifications': { ar: 'مواصفات المركبة', fr: 'Spécifications du véhicule', de: 'Fahrzeugspezifikationen', es: 'Especificaciones del vehículo', tr: 'Araç Özellikleri' },
  'Report a Vehicle Issue': { ar: 'الإبلاغ عن مشكلة في المركبة', fr: 'Signaler un problème', de: 'Fahrzeugproblem melden', es: 'Reportar un problema del vehículo', tr: 'Araç Sorunu Bildir' },
  'Notify management about any problems': { ar: 'أبلغ الإدارة عن أي مشاكل', fr: 'Notifier la direction', de: 'Management über Probleme informieren', es: 'Notificar a la gerencia', tr: 'Yönetimi bilgilendir' },
  'No vehicle is currently assigned to you.': { ar: 'لا توجد مركبة مخصصة لك حالياً.', fr: 'Aucun véhicule ne vous est actuellement attribué.', de: 'Ihnen ist derzeit kein Fahrzeug zugewiesen.', es: 'Actualmente no tiene ningún vehículo asignado.', tr: 'Şu anda size atanmış bir araç yok.' },

  // ── Notifications screen ─────────────────────────────────────────────────────
  'Notifications':       { ar: 'الإشعارات',          fr: 'Notifications',             de: 'Benachrichtigungen',        es: 'Notificaciones',          tr: 'Bildirimler' },
  'new':                 { ar: 'جديد',               fr: 'nouveau',                   de: 'neu',                       es: 'nuevo',                   tr: 'yeni' },
  'Mark all read':       { ar: 'تحديد الكل كمقروء',  fr: 'Tout marquer comme lu',     de: 'Alle als gelesen markieren', es: 'Marcar todo como leído',  tr: 'Tümünü okundu işaretle' },
  'Tap to mark as read': { ar: 'اضغط لتحديده مقروءاً', fr: 'Appuyez pour marquer lu', de: 'Zum Lesen markieren tippen', es: 'Toca para marcar como leído', tr: 'Okundu için dokun' },
  'No notifications yet': { ar: 'لا إشعارات بعد',   fr: 'Aucune notification',        de: 'Noch keine Benachrichtigungen', es: 'Aún no hay notificaciones', tr: 'Henüz bildirim yok' },
  'Updates from the transit system will appear here': { ar: 'ستظهر تحديثات نظام النقل هنا', fr: 'Les mises à jour du système de transport apparaîtront ici', de: 'Updates des Transitsystems erscheinen hier', es: 'Las actualizaciones del sistema de tránsito aparecerán aquí', tr: 'Toplu taşıma güncellemeleri burada görünecek' },

  // ── Trip planner ──────────────────────────────────────────────────────────────
  'Plan a Trip':       { ar: 'خطط رحلتك',            fr: 'Planifier un trajet',      de: 'Reise planen',             es: 'Planificar viaje',        tr: 'Yolculuk Planla' },
  'From':              { ar: 'من',                    fr: 'De',                       de: 'Von',                      es: 'Desde',                   tr: 'Nereden' },
  'To':                { ar: 'إلى',                   fr: 'À',                        de: 'Nach',                     es: 'A',                       tr: 'Nereye' },
  'Search stop or address…': { ar: 'ابحث عن محطة أو عنوان...', fr: 'Chercher arrêt ou adresse...', de: 'Haltestelle oder Adresse...', es: 'Buscar parada o dirección...', tr: 'Durak veya adres ara...' },
  'Fastest':           { ar: 'الأسرع',               fr: 'Le plus rapide',           de: 'Schnellste',               es: 'Más rápido',              tr: 'En Hızlı' },
  'Easiest':           { ar: 'الأسهل',               fr: 'Le plus simple',           de: 'Einfachste',               es: 'Más fácil',               tr: 'En Kolay' },
  'Cheapest':          { ar: 'الأرخص',               fr: 'Le moins cher',            de: 'Günstigste',               es: 'Más barato',              tr: 'En Ucuz' },
  'Leave at':          { ar: 'المغادرة في',            fr: 'Partir à',                 de: 'Abfahrt um',               es: 'Salir a las',             tr: 'Kalkış Zamanı' },
  'Now (leave immediately)': { ar: 'الآن (مغادرة فورية)', fr: 'Maintenant (départ immédiat)', de: 'Jetzt (sofort abfahren)', es: 'Ahora (salir ya)', tr: 'Şimdi (hemen kalk)' },
  'Find Route':        { ar: 'ابحث عن مسار',          fr: 'Trouver le trajet',        de: 'Route finden',             es: 'Encontrar ruta',          tr: 'Rota Bul' },
  'Select Origin':     { ar: 'اختر نقطة البداية',     fr: "Choisir l'origine",        de: 'Startpunkt wählen',        es: 'Seleccionar origen',      tr: 'Başlangıç Seç' },
  'Select Destination':{ ar: 'اختر الوجهة',           fr: 'Choisir la destination',   de: 'Ziel wählen',              es: 'Seleccionar destino',     tr: 'Varış Noktası Seç' },
  'walk':              { ar: 'مشياً',                 fr: 'à pied',                   de: 'zu Fuß',                   es: 'andando',                 tr: 'yürüyerek' },

  // ── Driver trip history ───────────────────────────────────────────────────────
  'Trip History':      { ar: 'سجل الرحلات',        fr: 'Historique de trajets',   de: 'Fahrtverlauf',               es: 'Historial de viajes',     tr: 'Yolculuk Geçmişi' },
  'Earned':            { ar: 'المكتسب',             fr: 'Gagné',                   de: 'Verdient',                   es: 'Ganado',                  tr: 'Kazanılan' },
  "Couldn't load trips": { ar: 'تعذر تحميل الرحلات', fr: 'Impossible de charger', de: 'Fahrten konnten nicht geladen werden', es: 'No se pudo cargar los viajes', tr: 'Yolculuklar yüklenemedi' },
  'Your assigned trips will appear here.': { ar: 'ستظهر رحلاتك المعينة هنا.', fr: 'Vos trajets assignés apparaîtront ici.', de: 'Ihre zugewiesenen Fahrten erscheinen hier.', es: 'Tus viajes asignados aparecerán aquí.', tr: 'Atanan yolculuklarınız burada görünecek.' },

  // ── Nearby stops ─────────────────────────────────────────────────────────────
  'Finding nearby stops':   { ar: 'البحث عن محطات قريبة',  fr: "Recherche d'arrêts proches",    de: 'Nahe Haltestellen suchen',         es: 'Buscando paradas cercanas',  tr: 'Yakın duraklar aranıyor' },
  'No stops nearby':        { ar: 'لا محطات قريبة',         fr: 'Aucun arrêt à proximité',       de: 'Keine nahen Haltestellen',         es: 'Sin paradas cercanas',       tr: 'Yakında durak yok' },
  'Route':                  { ar: 'الخط',                   fr: 'Ligne',                         de: 'Route',                            es: 'Ruta',                       tr: 'Rota' },
  'min walk':               { ar: 'دقيقة مشياً',             fr: 'min à pied',                    de: 'Min. zu Fuß',                      es: 'min andando',                tr: 'dk yürüme' },
  'stops':                  { ar: 'محطات',                  fr: 'arrêts',                        de: 'Haltestellen',                     es: 'paradas',                    tr: 'durak' },
  'All stops':              { ar: 'جميع المحطات',           fr: 'Tous les arrêts',               de: 'Alle Haltestellen',                es: 'Todas las paradas',          tr: 'Tüm Duraklar' },
  'Sorted by distance · walking at 5 km/h': { ar: 'مرتبة حسب المسافة · مشياً بـ 5 كم/س', fr: 'Trié par distance · marche à 5 km/h', de: 'Nach Entfernung sortiert · 5 km/h', es: 'Ordenado por distancia · caminando a 5 km/h', tr: 'Mesafeye göre sıralandı · 5 km/s yürüme' },
};

/**
 * Translate a string to the given locale.
 * Falls back to the original English key if no translation exists.
 */
export function t(key, lang = 'en') {
  if (!lang || lang === 'en') return key;
  return STRINGS[key]?.[lang] ?? key;
}
