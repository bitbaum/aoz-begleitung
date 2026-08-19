/**
 * The German dictionary — the shape every other language must fit, and the
 * fallback for every string no other language has yet.
 *
 * WHY THIS IS A FLAT MAP OF DOTTED KEYS rather than the nested objects the rest
 * of the label files use: a translator works through a list, and a missing key
 * must be a single missing line rather than a hole three levels down a tree
 * that TypeScript reports as an incompatible object. Flat also makes coverage
 * countable, which is what decides whether a language may be offered at all.
 *
 * SCOPE. This is the resident portal's chrome — navigation, the reports flow,
 * shared actions. It is deliberately not the whole product: staff surfaces are
 * used by AOZ employees who work in German, and translating those first would
 * spend the effort where it changes nothing. Residents are the people who may
 * not read German at all.
 */

export const de = {
  // Navigation
  'nav.overview': 'Übersicht',
  'nav.apartment': 'Wohnung',
  'nav.expenses': 'Ausgaben',
  'nav.roommates': 'Mitbewohner',
  'nav.chores': 'Aufgaben',
  'nav.rules': 'Regeln',
  'nav.decisions': 'Abstimmen',
  'nav.report': 'Melden',
  'nav.reports': 'Meine Meldungen',
  'nav.messages': 'Nachrichten',
  'nav.housing': 'Unterkünfte',
  'nav.activities': 'Aktivitäten',
  'nav.preferences': 'Einstellungen',
  'nav.profile': 'Profil',
  'nav.transfer': 'Verlegung',
  'nav.help': 'Hilfe',
  'nav.learning': 'Lernen',
  'nav.logout': 'Abmelden',
  'nav.more': 'Mehr',
  'nav.moreTitle': 'Alles im Überblick',
  'nav.closeMore': 'Menü schliessen',
  'nav.accountMenu': 'Konto',

  // Sections of the "more" sheet
  'navGroup.living': 'Alltag & Wohnen',
  'navGroup.together': 'Miteinander',
  'navGroup.integration': 'Integration & Beruf',
  'navGroup.account': 'Mein Konto',

  // Reports
  'reports.title': 'Deine Meldungen',
  'reports.subtitle': 'Alles, was du gemeldet hast — und was die Betreuung dazu sagt.',
  'reports.showAll': 'Alle Meldungen anzeigen',
  'reports.empty': 'Du hast noch nichts gemeldet.',
  'reports.new': 'Neu melden',
  'reports.open': 'Offen',
  'reports.done': 'Erledigt',
  'reports.pending': 'Das Team prüft diese Meldung aktuell.',
  'reports.answer': 'Antwort der Betreuung',
  'reports.viewYours': 'Deine Meldungen ansehen',

  // Messages
  'messages.title': 'Nachrichten',
  'messages.subtitle': 'Schreib der Betreuung — sie antwortet dir hier.',
  'messages.empty': 'Noch keine Nachrichten. Schreib uns, wenn du etwas brauchst.',
  'messages.placeholder': 'Deine Nachricht …',
  'messages.send': 'Senden',
  'messages.sending': 'Wird gesendet …',
  'messages.you': 'Du',
  'messages.staff': 'Betreuung',
  'messages.unread': 'neu',

  // Shared actions
  'action.save': 'Speichern',
  'action.cancel': 'Abbrechen',
  'action.back': 'Zurück',
  'action.close': 'Schliessen',
  'action.showAll': 'Alle anzeigen',

  // The language picker itself
  'language.label': 'Sprache',
  'language.change': 'Sprache wechseln',
  'language.machineNotice':
    'Diese Übersetzung wurde noch nicht von einer muttersprachlichen Person geprüft.',

  // Safety copy. Translated last and reviewed hardest — this is the text that
  // has to be right at three in the morning.
  'safety.emergency': 'Bei Notfällen: 112 oder Hausverwaltung kontaktieren',

  'help.title': 'Hilfe & FAQ',
  'help.subtitle': 'Antworten und Kontakt — bei Gefahr zuerst die Notfallnummern.',
  'help.faqTitle': 'Häufig gestellte Fragen',
  'help.contactTitle': 'Kontakt',
  'help.emergencyTitle': 'Notfall',
  'help.emergencyDesc': 'Bei Notfällen oder akuter Gefahr wende dich sofort an:',
  'help.faq.placement.q': 'Wie funktioniert die Zimmerverteilung?',
  'help.faq.placement.a':
    'Wir berücksichtigen Schlafrhythmus, Lärm, Sauberkeit und Sprachen. Je genauer deine Angaben, desto besser die Platzierung.',
  'help.faq.preferences.q': 'Kann ich meine Angaben ändern?',
  'help.faq.preferences.a':
    'Ja, unter Einstellungen. Änderungen gelten für künftige Platzierungen.',
  'help.faq.conflict.q': 'Was passiert bei einem Konflikt?',
  'help.faq.conflict.a':
    'Melde das über «Melden» im Portal. Das Team nimmt jede Meldung ernst.',
  'help.faq.transfer.q': 'Kann ich einen Umzug beantragen?',
  'help.faq.transfer.a':
    'Ja, über «Verlegung» oder deine Betreuungsperson.',
  'help.faq.privacy.q': 'Werden meine Daten geschützt?',
  'help.faq.privacy.a':
    'Ja. Nur Wohnpräferenzen, keine Diagnosen, kein Asylstatus. Du kannst deine Daten einsehen lassen.',
  'help.link.report': 'Problem melden',
  'help.link.rules': 'Hausregeln',

  'report.title': 'Problem melden',
  'report.subtitle': 'Technisches Problem oder Konflikt — das Team sieht die Meldung.',
  'report.emergencyTitle': 'Akute Gefahr?',
  'report.emergencyMessage': 'Bei Notfällen: 112. Notfall ausserhalb der Bürozeiten: 044 415 63 30.',
  'report.noPlacement': 'Du hast noch keine Unterkunft. Melde dich bei der Betreuung.',

  'rules.title': 'Hausregeln',
  'rules.subtitle':
    'Die verbindliche Fassung ist Deutsch — die Fassung, die du unterschreibst. Frag die Betreuung, wenn du etwas nicht verstehst.',
  'rules.noPlacement': 'Sobald du einer Unterkunft zugeteilt bist, findest du hier die Regeln.',
  'rules.toDecisions': 'Zu den Beschlüssen',

  'learning.title': 'Dein Lernen',
  'learning.subtitle':
    'Nachweise, Kurse und Freiwilligenarbeit — du kannst selbst eintragen, was du machst.',
  'learning.achievements': 'Nachweise',
  'learning.achievementsEmpty':
    'Noch keine Nachweise. Abgeschlossene Tests, Kurse und Freiwilligenarbeit erscheinen hier.',
  'learning.inProgress': 'Laufend',
  'learning.offers': 'Kurse und Angebote',
  'learning.offersEmpty': 'Gerade keine Lernangebote. Schau unter Aktivitäten nach.',
  'learning.hours': 'Stunden',

  'care.title': 'Dein Team',
  'care.subtitle': 'Wer für dich zuständig ist — Wohnen, Sozialarbeit, Jobcoach.',
  'care.empty': 'Noch niemand zugewiesen. Die Betreuung trägt das Team ein.',
  'care.housing': 'Wohnen / Betreuung',
  'care.social': 'Sozialarbeit',
  'care.job': 'Jobcoach',
  'care.appointments': 'Termine',
  'care.appointmentsEmpty': 'Keine Termine geplant.',

  // Dashboard page
  'dashboard.welcome': 'Willkommen',
  'dashboard.subtitle': 'Hier findest du alles zu deiner Unterkunft',
  'dashboard.housing': 'Deine Unterkunft',
  'dashboard.active': 'Aktiv',
  'dashboard.moveIn': 'Einzug',
  'dashboard.rooms': 'Zimmer',
  'dashboard.roommatesCount': 'Mitbewohner',
  'dashboard.compatibility': 'Kompatibilität',
  'dashboard.houseRules': 'Hausregeln',
  'dashboard.quietHours': 'Ruhezeit',
  'dashboard.smokingAllowed': 'Rauchen erlaubt',
  'dashboard.noSmoking': 'Nichtraucher',
  'dashboard.petsAllowed': 'Haustiere erlaubt',
  'dashboard.noPets': 'Keine Haustiere',
  'dashboard.roommates': 'Mitbewohner',
  'dashboard.myReports': 'Deine Meldungen',
  'dashboard.newReport': 'Neu melden',
  'dashboard.noReports': 'Keine Meldungen',
  'dashboard.now': 'Jetzt',
  'dashboard.taskSingular': 'Aufgabe braucht Aufmerksamkeit.',
  'dashboard.taskPlural': 'Aufgaben brauchen Aufmerksamkeit.',
  'dashboard.nextDesc': 'Melde Probleme früh und halte deine Präferenzen aktuell.',
  'dashboard.quickChores': 'Aufgaben',
  'dashboard.quickReport': 'Problem melden',
  'dashboard.quickLearning': 'Lernen',
  'dashboard.quickPreferences': 'Einstellungen',

  // Dashboard onboarding card
  'dashboard.onboarding.title': 'Dein Profil ist erstellt',
  'dashboard.onboarding.subtitle': 'Wir suchen die passende Unterkunft für dich',
  'dashboard.onboarding.completePreferences': 'Einstellungen vervollständigen',
  'dashboard.onboarding.completePreferencesHint': 'Je mehr wir über dich wissen, desto besser können wir passende Mitbewohner finden.',
  'dashboard.onboarding.browseHousing': 'Verfügbare Unterkünfte ansehen',
  'dashboard.onboarding.browseHousingHint': 'Sieh dir Unterkünfte an, die zu deinen Präferenzen passen.',
  'dashboard.onboarding.step1': 'Profil erstellt',
  'dashboard.onboarding.step2': 'Einstellungen vervollständigen',
  'dashboard.onboarding.step3': 'Unterkunft suchen',
  'dashboard.onboarding.step4': 'Einzug',
  'dashboard.noHousingContact': 'Bitte kontaktiere deine Betreuungsperson.',

  // Activities card
  'activities.dashboardTitle': 'Aktivitäten in Zürich',
  'activities.dashboardSubtitle': 'Kostenlose & günstige Angebote',
  'activities.dashboardCta': 'Alle Angebote anzeigen',
  'activities.noResults': 'Keine Aktivitäten in dieser Kategorie gefunden.',

  // Expenses card
  'expenses.dashboardTitle': 'Ausgaben',
  'expenses.dashboardCta': 'Alle Ausgaben anzeigen',
  'expenses.dashboardBalance': 'Dein Kontostand',
  'expenses.balanceSettled': 'ausgeglichen',
  'expenses.balancePositive': 'bekommt',
  'expenses.balanceNegative': 'schuldet',

  // Satisfaction widget
  'satisfaction.title': 'Wie geht es dir in deiner Unterkunft?',
  'satisfaction.subtitle': 'Dein vertrauliches Feedback hilft uns, Probleme früh zu erkennen',
  'satisfaction.privacyNote': 'Vertraulich gespeichert · Wird nicht mit deinem Namen verknüpft',
  'satisfaction.thankYouTitle': 'Danke für dein Feedback!',
  'satisfaction.thankYouMessage': 'Deine Rückmeldung hilft uns, die Unterkunft zu verbessern',
  'satisfaction.concernsForwarded': 'Wir haben deine Anliegen weitergeleitet',
  'satisfaction.newFeedback': 'Neues Feedback',
  'satisfaction.lastFeedback': 'Letztes Feedback',
  'satisfaction.today': 'Heute',

  // Reports card
  'reports.showAllCount': 'Alle Meldungen anzeigen',
} as const

/** The key set every dictionary is measured against. */
export type MessageKey = keyof typeof de

/**
 * A translation may be incomplete — missing strings fall back to German. What
 * an incomplete translation may NOT do is be offered to residents; that is what
 * `Locale.reviewed` gates, and the test suite ties the two together.
 */
export type Dictionary = Partial<Record<MessageKey, string>>
