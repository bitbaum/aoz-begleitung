import type { Dictionary } from './de'

/**
 * Turkish — also the language many Kurdish residents from Turkey read, which is
 * why it is worth having even though Kurdish is listed separately.
 *
 * NOT VOUCHED FOR — see `LOCALES.tr.reviewed`. Complete, in the repo, and not
 * in the picker.
 *
 * WHAT A REVIEWER SHOULD CHECK FIRST:
 *
 *  1. `sen` throughout, following the German source. Turkish marks respect
 *     through `siz` more strongly than German marks it through "Sie", and an
 *     adult being addressed as `sen` by the institution housing them may read
 *     it as diminishing. One decision, not forty.
 *  2. `bildirim` for a report. It is also the ordinary word for a phone
 *     notification, so "Bildirimlerim" may parse as "my notifications" rather
 *     than "the things I reported". `başvuru` or `talep` are the alternatives.
 *  3. `safety.emergency` — the only string here somebody has to act on. Note
 *     that 112 is the emergency number in Switzerland AND in Turkey, so it
 *     needs no explanation, which is a small piece of luck.
 */
export const tr: Dictionary = {
  'nav.overview': 'Genel bakış',
  'nav.apartment': 'Daire',
  'nav.expenses': 'Masraflar',
  'nav.roommates': 'Ev arkadaşları',
  'nav.chores': 'Görevler',
  'nav.rules': 'Kurallar',
  'nav.decisions': 'Oylama',
  'nav.report': 'Bildir',
  'nav.reports': 'Bildirimlerim',
  'nav.messages': 'Mesajlar',
  'nav.housing': 'Konutlar',
  'nav.activities': 'Etkinlikler',
  'nav.preferences': 'Ayarlar',
  'nav.profile': 'Profil',
  'nav.transfer': 'Nakil talebi',
  'nav.help': 'Yardım',
  'nav.learning': 'Öğrenme',
  'nav.logout': 'Çıkış yap',
  'nav.more': 'Daha fazla',
  'nav.moreTitle': 'Her şey bir bakışta',
  'nav.closeMore': 'Menüyü kapat',
  'nav.accountMenu': 'Hesap',

  'navGroup.living': 'Günlük yaşam ve konut',
  'navGroup.together': 'Birlikte',
  'navGroup.integration': 'Entegrasyon ve iş',
  'navGroup.account': 'Hesabım',

  'reports.title': 'Bildirimlerin',
  'reports.subtitle': 'Bildirdiğin her şey — ve ekibin bunlar hakkında söyledikleri.',
  'reports.showAll': 'Tüm bildirimleri göster',
  'reports.empty': 'Henüz bir şey bildirmedin.',
  'reports.new': 'Yeni bildirim',
  'reports.open': 'Açık',
  'reports.done': 'Çözüldü',
  'reports.pending': 'Ekip bu bildirimi inceliyor.',
  'reports.answer': 'Ekibin yanıtı',
  'reports.viewYours': 'Bildirimlerini gör',

  'messages.title': 'Mesajlar',
  'messages.subtitle': 'Ekibe yaz — sana buradan yanıt verir.',
  'messages.empty': 'Henüz mesaj yok. Bir şeye ihtiyacın olursa bize yaz.',
  'messages.placeholder': 'Mesajın …',
  'messages.send': 'Gönder',
  'messages.sending': 'Gönderiliyor …',
  'messages.you': 'Sen',
  'messages.staff': 'Ekip',
  'messages.unread': 'yeni',

  'action.save': 'Kaydet',
  'action.cancel': 'İptal',
  'action.back': 'Geri',
  'action.close': 'Kapat',
  'action.showAll': 'Tümünü göster',

  'language.label': 'Dil',
  'language.change': 'Dili değiştir',
  'language.machineNotice':
    'Bu çeviri henüz ana dili bu dil olan biri tarafından kontrol edilmedi.',

  'safety.emergency': 'Acil durumda: 112’yi ara veya konut yönetimine başvur',

  'help.title': 'Yardım ve SSS',
  'help.subtitle': 'Yanıtlar ve iletişim — tehlikede önce acil numaralar.',
  'help.faqTitle': 'Sık sorulan sorular',
  'help.contactTitle': 'İletişim',
  'help.emergencyTitle': 'Acil durum',
  'help.emergencyDesc': 'Tehlikedeysen hemen şuraya başvur:',
  'help.faq.placement.q': 'Odalar nasıl dağıtılıyor?',
  'help.faq.placement.a':
    'Uyku, gürültü, temizlik ve dilleri dikkate alırız. Yanıtların ne kadar doğruysa yerleştirme o kadar iyi olur.',
  'help.faq.preferences.q': 'Bilgilerimi değiştirebilir miyim?',
  'help.faq.preferences.a': 'Evet, Ayarlar altında. Değişiklikler sonraki yerleştirmeler için geçerlidir.',
  'help.faq.conflict.q': 'Çatışmada ne yapmalıyım?',
  'help.faq.conflict.a': 'Portalde «Bildir»i kullan. Ekip her bildirimi ciddiye alır.',
  'help.faq.transfer.q': 'Taşınma isteyebilir miyim?',
  'help.faq.transfer.a': 'Evet, «Nakil» üzerinden veya danışmanından.',
  'help.faq.privacy.q': 'Verilerim korunuyor mu?',
  'help.faq.privacy.a':
    'Evet. Yalnızca konut tercihleri — teşhis yok, iltica durumu yok. Verilerini görmeyi isteyebilirsin.',
  'help.link.report': 'Sorun bildir',
  'help.link.rules': 'Ev kuralları',

  'report.title': 'Sorun bildir',
  'report.subtitle': 'Arıza veya çatışma — ekip görür.',
  'report.emergencyTitle': 'Acil tehlike?',
  'report.emergencyMessage': 'Acil durumda: 112. Mesai dışı: 044 415 63 30.',
  'report.noPlacement': 'Henüz konutun yok. Danışmanına başvur.',

  'rules.title': 'Ev kuralları',
  'rules.subtitle':
    'Bağlayıcı metin Almancadır — imzaladığın sürüm. Anlamadığın bir şey varsa danışmanına sor.',
  'rules.noPlacement': 'Odan olunca kurallar burada görünür.',
  'rules.toDecisions': 'Kararlara',

  'learning.title': 'Öğrenmen',
  'learning.subtitle': 'Sertifikalar, kurslar ve gönüllülük — ne yaptığını kendin ekleyebilirsin.',
  'learning.achievements': 'Başarılar',
  'learning.achievementsEmpty':
    'Henüz başarı yok. Bitmiş testler, kurslar ve gönüllülük burada görünür.',
  'learning.inProgress': 'Devam ediyor',
  'learning.offers': 'Kurslar ve teklifler',
  'learning.offersEmpty': 'Şu an öğrenme teklifi yok. Etkinliklere bak.',
  'learning.hours': 'Saat',

  'care.title': 'Senin ekibin',
  'care.subtitle': 'Senden sorumlu kişiler — konut, sosyal çalışma, iş koçu.',
  'care.empty': 'Henüz kimse atanmadı. Danışman ekibi ekler.',
  'care.housing': 'Konut / danışmanlık',
  'care.social': 'Sosyal çalışma',
  'care.job': 'İş koçu',
  'care.appointments': 'Randevular',
  'care.appointmentsEmpty': 'Planlanmış randevu yok.',

  'dashboard.welcome': 'Hoş geldin',
  'dashboard.subtitle': 'Konaklaman hakkındaki her şey tek bir yerde',
  'dashboard.housing': 'Konaklaman',
  'dashboard.active': 'Aktif',
  'dashboard.moveIn': 'Taşınma tarihi',
  'dashboard.rooms': 'Odalar',
  'dashboard.roommatesCount': 'Ev arkadaşları',
  'dashboard.compatibility': 'Uyumluluk',
  'dashboard.houseRules': 'Ev kuralları',
  'dashboard.quietHours': 'Sessiz saatler',
  'dashboard.smokingAllowed': 'Sigara içilebilir',
  'dashboard.noSmoking': 'Sigara içilmez',
  'dashboard.petsAllowed': 'Evcil hayvan kabul edilir',
  'dashboard.noPets': 'Evcil hayvan kabul edilmez',
  'dashboard.roommates': 'Ev arkadaşları',
  'dashboard.myReports': 'Bildirimlerim',
  'dashboard.newReport': 'Yeni bildirim',
  'dashboard.noReports': 'Bildirim yok',
  'dashboard.now': 'Şimdi',
  'dashboard.taskSingular': 'görev ilgi gerektiriyor.',
  'dashboard.taskPlural': 'görev ilgi gerektiriyor.',
  'dashboard.nextDesc': 'Sorunları erkenden bildir ve tercihlerini güncel tut.',
  'dashboard.quickChores': 'Görevler',
  'dashboard.quickReport': 'Sorun bildir',
  'dashboard.quickLearning': 'Öğrenme',
  'dashboard.quickPreferences': 'Ayarlar',
  'dashboard.onboarding.title': 'Profil oluşturuldu',
  'dashboard.onboarding.subtitle': 'Sana uygun konaklama arıyoruz',
  'dashboard.onboarding.completePreferences': 'Ayarları tamamla',
  'dashboard.onboarding.completePreferencesHint': 'Seni ne kadar çok tanırsak, o kadar uyumlu ev arkadaşı bulabiliriz.',
  'dashboard.onboarding.browseHousing': 'Mevcut konaklama seçenekleri',
  'dashboard.onboarding.browseHousingHint': 'Tercihlerine uyan konaklama seçeneklerini incele.',
  'dashboard.onboarding.step1': 'Profil oluşturuldu',
  'dashboard.onboarding.step2': 'Ayarları tamamla',
  'dashboard.onboarding.step3': 'Konaklama bul',
  'dashboard.onboarding.step4': 'Taşın',
  'dashboard.noHousingContact': 'Sosyal çalışmanla iletişime geç.',
  'activities.dashboardTitle': "Zürich'teki etkinlikler",
  'activities.dashboardSubtitle': 'Ücretsiz ve uygun fiyatlı teklifler',
  'activities.dashboardCta': 'Tüm teklifler',
  'activities.noResults': 'Bu kategoride etkinlik bulunamadı.',
  'expenses.dashboardTitle': 'Harcamalar',
  'expenses.dashboardCta': 'Tüm harcamalar',
  'expenses.dashboardBalance': 'Bakiyen',
  'expenses.balanceSettled': 'eşit',
  'expenses.balancePositive': 'alacaklı',
  'expenses.balanceNegative': 'borçlu',
  'satisfaction.title': 'Konaklamanda nasıl hissediyorsun?',
  'satisfaction.subtitle': 'Gizli geri bildirimin sorunları erken fark etmemize yardımcı olur',
  'satisfaction.privacyNote': 'Gizli olarak saklanır · Adınla ilişkilendirilmez',
  'satisfaction.thankYouTitle': 'Geri bildiriminiz için teşekkürler!',
  'satisfaction.thankYouMessage': 'Geri bildiriminiz konaklamayı iyileştirmemize yardımcı olur',
  'satisfaction.concernsForwarded': 'Endişelerinizi ilettik',
  'satisfaction.newFeedback': 'Yeni geri bildirim',
  'satisfaction.lastFeedback': 'Son geri bildirim',
  'satisfaction.today': 'Bugün',
  'reports.showAllCount': 'Tüm bildirimleri göster',
}
