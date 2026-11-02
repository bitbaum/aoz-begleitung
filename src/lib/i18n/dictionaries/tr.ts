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
  'nav.marketplace': 'Pazar Yeri',
  'nav.events': 'Etkinlikler',
  'nav.preferences': 'Ayarlar',
  'nav.accountSecurity': 'Giriş ve güvenlik',
  'accountSecurity.deletion':
    'Erişiminiz kişisel kodunuza bağlıdır. Onu yalnızca irtibat kişiniz kaldırabilir.',
  'accountSecurity.help': 'Yardım ve iletişim',
  'nav.profile': 'Profil',
  'nav.transfer': 'Nakil talebi',
  'nav.help': 'Yardım',
  'nav.learning': 'Öğrenme',
  'nav.logout': 'Çıkış yap',
  'nav.more': 'Daha fazla',
  'nav.moreTitle': 'Her şey bir bakışta',
  'nav.closeMore': 'Menüyü kapat',
  'nav.accountMenu': 'Hesap',

  'navGroup.living': 'Konut',
  'navGroup.community': 'Topluluk',
  'navGroup.concerns': 'Taleplerim',
  'navGroup.integration': 'Uyum',
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
  'messages.sendFailed': 'Mesaj gönderilemedi. Lütfen tekrar dene.',
  'messages.you': 'Sen',
  'messages.staff': 'Ekip',
  'messages.unread': 'yeni',

  'action.save': 'Kaydet',
  'action.saving': 'Kaydediliyor ...',
  'action.saved': 'Kaydedildi',
  'action.cancel': 'İptal',
  'action.back': 'Geri',
  'action.close': 'Kapat',
  'action.showAll': 'Tümünü göster',
  'error.generic': 'Bir hata oluştu. Lütfen tekrar deneyin.',

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
  'help.faq.preferences.a':
    'Evet, Ayarlar altında. Değişiklikler sonraki yerleştirmeler için geçerlidir.',
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
  'care.volunteering': 'Gönüllülük',
  'care.appointments': 'Randevular',
  'care.appointmentsEmpty': 'Planlanmış randevu yok.',

  'marketplace.title': 'Pazar Yeri',
  'marketplace.subtitle': 'Bağışla, ödünç ver ya da ara — kendi evinde ve ötesinde.',
  'marketplace.ownUnit': 'Evin',
  'marketplace.otherUnits': 'Diğer evler',
  'marketplace.empty': 'Henüz ilan yok.',
  'marketplace.postNew': 'Yeni ilan',
  'marketplace.formTitle': 'Başlık',
  'marketplace.formDescription': 'Açıklama',
  'marketplace.formKind': 'Tür',
  'marketplace.formCategory': 'Kategori',
  'marketplace.submit': 'Yayınla',
  'marketplace.claim': 'Ayır',
  'marketplace.close': 'Kapat',
  'marketplace.postedBy': 'Kimden',
  'marketplace.claimedBy': 'Ayıran',
  'marketplace.kindGiveAway': 'Bağış',
  'marketplace.kindLend': 'Ödünç',
  'marketplace.kindWanted': 'Aranıyor',
  'marketplace.categoryFurniture': 'Mobilya',
  'marketplace.categoryKitchen': 'Mutfak',
  'marketplace.categoryClothing': 'Giysi',
  'marketplace.categoryElectronics': 'Elektronik',
  'marketplace.categoryKids': 'Çocuk',
  'marketplace.categoryOther': 'Diğer',
  'marketplace.statusOpen': 'Açık',
  'marketplace.statusClaimed': 'Ayrıldı',
  'marketplace.statusClosed': 'Kapandı',

  'events.title': 'Etkinlikler',
  'events.subtitle':
    'Ev toplantıları ve ortak buluşmalar — katılımını bildir ya da kendin bir etkinlik oluştur.',
  'events.empty': 'Henüz planlanmış etkinlik yok.',
  'events.createNew': 'Yeni etkinlik',
  'events.formTitle': 'Başlık',
  'events.formDescription': 'Açıklama',
  'events.formLocation': 'Yer',
  'events.formStartsAt': 'Başlangıç',
  'events.formCategory': 'Kategori',
  'events.submit': 'Oluştur',
  'events.rsvpGoing': 'Katılıyorum',
  'events.rsvpMaybe': 'Belki',
  'events.rsvpDeclined': 'Katılmıyorum',
  'events.cancel': 'İptal et',
  'events.cancelled': 'İptal edildi',
  'events.categoryHouseMeeting': 'Ev toplantısı',
  'events.categorySocial': 'Sosyal',
  'events.categoryCulture': 'Kültür',
  'events.categorySupport': 'Destek',
}
