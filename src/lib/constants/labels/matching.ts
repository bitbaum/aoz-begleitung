/**
 * Matching and placement labels: UI text for matching workflow,
 * spot selection, unit mode, resident selector, and placement confirmation.
 */

export const MATCHING_LABELS = {
  topRecommendation: 'Top Empfehlung',
  topRank: (rank: number) => `Top ${rank}`,
  empty: 'Leer',
  history: 'Verlauf:',
  conflictFree: 'konfliktfrei)',
  perMonthAvg: '/Monat Ø',
  conflictsLast30Days: 'Konflikte letzte 30 Tage',
  apartmentProfile: 'Wohnungs-Profil',
  residents: 'Klient*innen',
  matching: 'Passend',
  /** The action on an unplaced person: an adjective looked like a status. */
  findUnitAction: 'Unterkunft finden',
  scoreDerivation: 'Score-Berechnung anzeigen',
  basePenalty: 'Basis: 100 Punkte',
  conflictDeductions: 'Abzüge (Konflikte):',
  strengthBonus: 'Bonus (Stärken):',
  smallGroupBonus: 'Bonus (kleine Gruppe):',
  totalFit: 'Gesamtpassung',
  historicalData: 'Historische Daten',
  placements: 'Platzierungen',
  successRate: 'Erfolgsrate',
  successRateDesc: (pct: number) => `waren erfolgreich`,
  placementsWithSimilar: 'Platzierungen mit ähnlicher Kompatibilität',
  noHistoricalData: 'Keine historischen Daten für ähnliche Kompatibilitätswerte',
  plusMinusTen: '±10',
  available: 'verfügbar',
  noRoommatesNoConflicts: 'Keine Mitbewohner - keine Konflikte',
  sharedLanguageWith: 'Gemeinsame Sprache mit',
  residentsCount: 'Klient*innen',
  currentResidents: 'Aktuelle Klient*innen:',
  strengths: 'Stärken',
  concerns: 'Bedenken',
  challenges: 'Herausforderungen',
  moreConcerns: (count: number) => `+${count} weitere Bedenken`,
  blocked: 'Blockiert',
  place: 'Platzieren',
  placeLowCompat: 'Platzieren (niedrige Kompatibilität)',
  // Spot selection
  noSpotsAvailable: 'Keine freien Plätze verfügbar',
  selectSpot: 'Platz auswählen',
  noSuitableSpots: 'Keine Plätze für diese*n Klient*in geeignet',
  medDocsMissing: '(med. Dokumente fehlen)',
  moreUnsuitableSpots: (count: number) => `${count} weitere Plätze (nicht geeignet)`,
  medDocsRequired: '(med. Dok. erforderlich)',
  notAuthorized: '(nicht berechtigt)',
  // Unit mode
  matchingResidents: 'Passende Klient*innen',
  occupied: 'belegt',
  freeSpots: (n: number) => (n === 1 ? 'freier Platz' : 'freie Plätze'),
  back: 'Zurück',
  noMatchingResidents: 'Keine passenden unplatzierten Klient*innen',
  createNewResident: 'Neue*n Klient*in erfassen',
  // Resident selector
  unplacedResidents: 'Unplatzierte Klient*innen',
  searchPlaceholder: 'Klient*innen suchen (Code, Sprache)',
  search: 'Suchen',
  noResidentsFound: 'Keine Klient*innen für diese Suche gefunden',
  selected: 'Ausgewählt',
  placedResidents: 'Platzierte Klient*innen',
  selectForAnalysis: 'Wählen Sie eine*n Klient*in für "Was-wäre-wenn"-Analyse',
  placed: 'Platziert',
  compare: 'Vergleichen',
  // Matching page header
  title: 'Matching',
  findMatchingResidents: (address: string) => `Finden Sie passende Klient*innen für ${address}`,
  step2SelectUnit: (code: string) => `Schritt 2 von 2: Wählen Sie eine Unterkunft für ${code}`,
  findOptimalPlacement: 'Finden Sie die optimale Platzierung für Klient*innen',
  whoFitsIn: (code: string) => `Wer passt in ${code}?`,
  profileCaptured: 'Profil erfasst',
  findUnit: 'Unterkunft finden',
  residentCreated: (code: string) => `Klient*in ${code} erfolgreich erstellt`,
  newResidentBannerDesc:
    'Wählen Sie jetzt eine passende Unterkunft. Die Unterkünfte sind nach Kompatibilität sortiert - oben die besten Matches.',
  selectResidentForMatches: 'Wählen Sie eine*n Klient*in aus, um Matches zu sehen',
  orSelectUnit: 'oder wählen Sie eine Unterkunft, um zu sehen wer dort passt:',
  freeBeds: (free: number, total: number) => `${free} von ${total} frei`,
  // Available units panel
  availableUnitsTitle: (count: number) => `Verfügbare Unterkünfte (${count})`,
  // What-if analysis banner (placed resident selected)
  whatIfTitle: (code: string) => `Was-wäre-wenn-Analyse für ${code}`,
  whatIfCurrentPlacement: (code: string) => `Aktuell platziert in ${code}.`,
  whatIfDesc: 'Diese Ansicht zeigt Kompatibilität mit anderen Unterkünften.',
} as const

export const ALGORITHM_OVERVIEW_LABELS = {
  processStep1Title: 'Profil erfassen',
  processStep2Title: 'Kompatibilität berechnen',
  processStep3Title: 'Empfehlung erhalten',
  tabDimensions: 'Dimensionen',
  tabFactors: 'Faktoren',
  tabOverview: 'Übersicht',
  tabScience: 'Forschung',
  tabCollection: 'Datenerfassung',
  tabTechnical: 'Technik',
  headToHeadAvg: 'Durchschnitt',
  heroSubtitle: 'Evidenzbasiertes Matching',
  heroTitle: 'Kompatibilitäts-Algorithmus',
  heroDesc: (factors: number, dimensions: number) =>
    `Basierend auf wissenschaftlicher Forschung zu Wohnkonflikten analysiert unser System ${factors} Faktoren in ${dimensions} Dimensionen für harmonisches Zusammenleben.`,
  sourcesLabel: (count: number) => `${count} Quellen`,
  ethicsValue: 'Ethisch',
  ethicsLabel: 'gestaltet',
  dimensionsIntro:
    'Alle Faktoren werden direkt aus der Algorithmus-Konfiguration generiert. Klicken Sie auf eine Dimension für Details.',
  factorsCount: (n: number) => `${n} Faktoren`,
  // Overview tab sections
  howItWorksTitle: 'So funktioniert das Matching',
  processStep1Desc: 'Bei der Aufnahme werden Präferenzen und Bedürfnisse systematisch erfasst.',
  processStep2Desc: (count: number) => `${count} Faktoren werden gewichtet verglichen.`,
  processStep3Desc: 'Ein Score zeigt die Eignung, Warnungen weisen auf Risiken hin.',
  scienceMethodTitle: 'Wissenschaftliche Methodik',
  scienceMethodP1:
    'Die Gewichtung der Faktoren basiert auf einem evidenzbasierten Ansatz: Jeder Faktor wird durch mindestens eine publizierte Studie gestützt. Wir unterscheiden zwischen starker Evidenz (experimentelle Studien, grosse Umfragen), moderater Evidenz (Beobachtungsstudien, Expertenkonsens) und vorläufiger Evidenz (Einzelstudien, indirekte Belege).',
  scienceMethodP2:
    'Schweizer Forschung wird priorisiert, da sie den lokalen Kontext von Asylunterkünften am besten abbildet. Internationale Studien dienen zur Validierung und Ergänzung. Die Gewichtungen werden regelmässig überprüft, wenn neue Forschungsergebnisse vorliegen.',
  dimensionsSectionTitle: (count: number) => `Die ${count} Dimensionen`,
  weightDistribution: 'Gewichtungsverteilung',
  scoreInterpTitle: 'Score-Interpretation',
  scoreInterpDesc: 'Der Kompatibilitäts-Score (0-100) zeigt, wie gut Klient*innen zusammenpassen.',
  lastUpdated: 'Letzte Aktualisierung: v2.0 – 10. Februar 2026',
  // CTA section
  ctaTitle: 'Bereit für bessere Platzierungen?',
  ctaDesc: 'Starten Sie das Matching und finden Sie die optimale Wohnkonstellation.',
  ctaBtn: 'Matching starten',
} as const

export const TECHNICAL_TAB_LABELS = {
  scoringRulesTitle: 'Bewertungsregeln',
  examplePrefix: 'Beispiel:',
  logicPrefix: 'Logik:',
  weightDerivationTitle: 'Gewichtungsherleitung',
  weightDerivationDesc:
    'Die Gewichtung jeder Dimension basiert auf der Stärke und Häufigkeit der Forschungsbelege für die zugehörigen Faktoren.',
  colDimension: 'Dimension',
  colWeight: 'Gewicht',
  colRationale: 'Begründung',
  blockingTitle: 'Blockierung',
  blockingDescPrefix: 'Bei kritischen Inkompatibilitäten wird die Platzierung',
  blockingDescBold: 'blockiert',
  hardRequirementsLabel: 'Harte Anforderungen:',
  hardRequirementsDesc: 'Rollstuhlzugang, Einzelzimmer-Bedarf, etc. müssen erfüllt sein',
  extremeDifferencesLabel: 'Extreme Differenzen:',
  extremeDifferencesDesc: '3+ Stufen Unterschied bei Sauberkeit oder Lärmtoleranz',
  incompatibleBehaviorLabel: 'Inkompatibles Verhalten:',
  incompatibleBehaviorDesc: 'Innen-Raucher + Nichtraucher in gleicher Einheit',
  confidenceMatrixTitle: 'Konfidenz-Matrix',
  confidenceMatrixDesc:
    'Übersicht der Evidenzstärke pro Faktor. Stärkere Evidenz bedeutet höheres Vertrauen in die Gewichtung.',
  weightSuffix: '% Gewicht',
  versionHistoryTitle: 'Algorithmus-Versionshistorie',
  versionPrefix: 'Version',
  currentBadge: 'Aktuell',
  configTitle: 'Konfiguration (SSOT)',
  configDesc:
    'Alle Faktoren, Gewichtungen und Regeln sind in der Konfiguration definiert. Änderungen dort aktualisieren automatisch diese Seite und den Algorithmus.',
  configFile1: 'src/lib/config/resident-factors.ts - Faktoren & Dimensionen',
  configFile2: 'src/lib/config/algorithm-docs.ts - Wissenschaftliche Basis',
  configFile3: 'src/lib/config/types.ts - Typdefinitionen',
} as const

export const SCIENCE_TAB_LABELS = {
  title: 'Wissenschaftliche Grundlage',
  intro:
    'Die Faktorenauswahl basiert auf Forschung zu Wohnkonflikten aus der Schweiz, Deutschland und internationalen Studien. Die Gewichtungen spiegeln die empirisch belegte Bedeutung wider.',
  evidenceHierarchyTitle: 'Evidenz-Hierarchie',
  evidenceHierarchyDesc:
    'Nicht alle Forschung hat die gleiche Aussagekraft. Wir bewerten jede Quelle nach ihrer methodischen Stärke.',
  examplePrefix: 'Beispiel:',
  evidenceMapTitle: 'Evidenz-Karte pro Dimension',
  evidenceMapDesc:
    'Welche Forschung stützt welche Dimension? Schweizer Studien sind mit einem Flag markiert.',
  weightSuffix: '% Gewicht',
  evidencePerFactorTitle: 'Evidenz pro Faktor',
  evidencePerFactorDesc:
    'Detaillierte wissenschaftliche Grundlage für jeden Kompatibilitätsfaktor.',
  sourcesLabel: 'Quellen:',
} as const

export const DATA_COLLECTION_TAB_LABELS = {
  title: 'Wie werden die Daten erfasst?',
  intro:
    'Alle Daten werden bei der Aufnahme durch das Klient*innen-Formular erfasst. Die Fragen sind so gestaltet, dass sie ohne Sprachbarrieren verständlich sind (Skalen, Bildauswahl wo möglich).',
  privacyTitle: 'Datenschutz-Grundsätze',
  privacyBullet1: '- Nur funktionale Daten, keine medizinischen Diagnosen',
  privacyBullet2: '- Selbstauskunft der Klient*innen',
  privacyBullet3: '- Anonymisierte Verarbeitung',
  privacyBullet4: '- Keine politischen/religiösen Daten',
  methodsTitle: 'Erfassungsmethoden pro Faktor',
  scaleType: 'Skala 1-5',
  formSectionsTitle: 'Formular-Sektionen',
  fieldsSuffix: 'Felder',
} as const

export const PLACEMENT_ACTIONS_LABELS = {
  actionsTitle: 'Aktionen',
  transferTitle: 'Klient*in verlegen',
  endTitle: 'Platzierung beenden',
  conflictAnalysisTitle: 'Konfliktanalyse',
  conflictAnalysisDesc:
    'Diese Angaben helfen, das Matching zu verbessern und zukünftige Konflikte zu vermeiden.',
  conflictCauseLabel: 'Hauptursache des Konflikts *',
  conflictPredictableLabel: 'War der Konflikt vorhersehbar?',
  conflictAlgorithmLabel: 'Hätte der Algorithmus diesen Konflikt vorhersagen können?',
  linkedIncidentLabel: 'Verknüpfter Vorfall',
  noLinkedIncident: 'Keinen Vorfall verknüpfen',
  transferNotesLabel: 'Notizen',
  transferNotesPlaceholder: 'Optionale Anmerkungen zur Verlegung...',
  endNotesLabel: 'Notizen',
  endNotesPlaceholder: 'Optionale Anmerkungen...',
  endBtn: 'Platzierung endgültig beenden',
  endBtnPending: 'Wird beendet...',
  conflictNoPredictable: 'Nein',
  // Button labels
  checkinBtn: 'Check-in durchführen',
  transferToggleBtn: 'Verlegen',
  endToggleBtn: 'Beenden',
  closeBtn: '✕ Schliessen',
  transferConfirmBtn: 'Verlegen bestätigen',
  transferConfirmBtnPending: 'Wird verlegt...',
  // Hints
  shortcutHint: 'Schnellzugriff: Alt+Shift+V (Verlegen), Alt+Shift+E (Beenden)',
  noEligibleUnits:
    'Aktuell gibt es keine geeigneten Ziel-Unterkünfte für diese*n Klient*in. Prüfen Sie medizinische Berechtigung oder verfügbare Plätze.',
  // Transfer form
  targetUnitLabel: 'Ziel-Unterkunft *',
  targetSpotLabel: 'Ziel-Platz *',
  selectSpot: 'Platz auswählen',
  selectUnitFirst: 'Zuerst Unterkunft wählen',
  medDocsSpotHint: 'Zeigt Plätze passend zur med. Dokumentation',
  noMedDocsSpotHint: 'Zeigt nur Betten (keine med. Dokumentation)',
  transferReasonLabel: 'Grund für Verlegung *',
  transferReasonHint: 'Wählen Sie den Hauptgrund für die Verlegung',
  summaryLabel: 'Zusammenfassung:',
  // End form
  endWarningTitle: 'Achtung:',
  endWarning:
    'Diese Aktion beendet die aktuelle Platzierung. Der*die Klient*in wird als nicht platziert markiert.',
  endReasonLabel: 'Grund *',
  conflictPredictableYes: 'Ja',
  conflictScoreHint: (score: number) => `(Score war ${score}%)`,
  incidentOptionalHint: 'Optional: Vorfall der zu dieser Beendigung geführt hat',
  // Unit select option
  spotsAvailableCount: (count: number) => `${count} Plätze frei`,
  // Dynamic summaries
  transferSummaryWithUnit: (unitCode: string) =>
    `Klient*in wird in ${unitCode} verlegt. Ziel-Unterkunft prüfen und Grund dokumentieren.`,
  transferSummaryEmpty: 'Wählen Sie eine Ziel-Unterkunft, um die Verlegung zu bestätigen.',
  endSummaryWithReason: (reason: string) =>
    `Diese Platzierung wird beendet (Grund: ${reason}). Klient*in wird als unplatziert geführt.`,
  endSummaryEmpty: 'Wählen Sie einen Grund, um die Beendigung zu bestätigen.',
} as const

export const PLACEMENT_CONCERN_LABELS = {
  wheelchairRequired: 'Benötigt Rollstuhlzugang',
  groundFloorRequired: 'Benötigt Erdgeschoss',
  smokerInNonSmokingUnit: 'Raucher, aber Nichtraucher-Unterkunft',
  sharedKitchenOnly: 'Nur geteilte Küche',
  sharedBathroomOnly: 'Geteiltes Badezimmer',
} as const

export const PLACEMENT_CONFIRM_LABELS = {
  title: 'Platzierung bestätigen',
  prompt: 'Sie sind dabei zu platzieren:',
  resident: 'Klient*in:',
  unit: 'Unterkunft:',
  spot: 'Platz:',
  compatibility: 'Kompatibilität:',
  lowCompatWarning: 'Niedrige Kompatibilität',
  lowCompatMessage:
    'Diese Platzierung hat eine niedrige Kompatibilitätsbewertung. Bitte stellen Sie sicher, dass dies die beste verfügbare Option ist.',
  notePoints: 'Beachten Sie folgende Punkte:',
  confirmMessage:
    'Diese Aktion wird die*den Klient*in platzieren und den Platz als belegt markieren. Möchten Sie fortfahren?',
  cancel: 'Abbrechen',
  placing: 'Wird platziert...',
  confirm: 'Jetzt platzieren',
} as const

/**
 * The audit trail, as something a person can read.
 *
 * 120 sites wrote to it and nothing read it — including the impersonation
 * entries, whose reviewability is the entire safeguard for "Ansicht öffnen
 * als". A record nobody can look at is a claim, not a control.
 */
export const AUDIT_LABELS = {
  title: 'Protokoll',
  subtitle: 'Wer hat was geändert. Neueste zuerst.',
  empty: 'Noch keine Einträge.',
  filterAll: 'Alle Bereiche',
  filterLabel: 'Bereich',
  systemActor: 'System',
  impersonationTitle: 'Geliehene Ansichten',
  impersonationHint:
    'Wenn eine Person die Ansicht einer anderen öffnet, steht es hier — und nur hier ist es überprüfbar.',
  actions: {
    CREATE: 'Erstellt',
    UPDATE: 'Geändert',
    DELETE: 'Gelöscht',
    END: 'Beendet',
    TRANSFER: 'Verlegt',
    RESOLVE: 'Gelöst',
    ARCHIVE: 'Archiviert',
    RESTORE: 'Wiederhergestellt',
  } as Record<string, string>,
  entities: {
    RESIDENT: 'Klient*in',
    HOUSING_UNIT: 'Unterkunft',
    SPOT: 'Platz',
    PLACEMENT: 'Platzierung',
    INCIDENT: 'Vorfall',
    MAINTENANCE: 'Unterhalt',
    CHECK_IN: 'Check-in',
    HOUSEHOLD_TASK: 'Ämtli',
    TRANSFER_REQUEST: 'Verlegungsantrag',
    ACTIVITY: 'Aktivität',
    HOUSE_RULE: 'Hausregel',
    PROPOSAL: 'Antrag',
    CONFLICT_AGREEMENT: 'Konfliktvereinbarung',
    EXPENSE: 'Ausgabe',
    MESSAGE: 'Nachricht',
    SETTLEMENT: 'Ausgleich',
    RESIDENT_PROFILE: 'Profil',
    OPPORTUNITY: 'Einsatzplatz',
    OPPORTUNITY_APPLICATION: 'Bewerbung',
    STAFF_USER: 'Mitarbeitendenkonto',
  } as Record<string, string>,
} as const

/**
 * Why a unit sits where it sits in the match list.
 *
 * The order is not the score on the card. `/algorithm` documents the
 * compatibility dimensions and their weights; nothing documented the ranking,
 * which is what staff actually act on — the top card is the one that gets
 * placed. `roomFit` / `apartmentFit` exist as separate labels because the
 * ranking uses the ROOM percentage wherever a room can be scored, while the
 * card headlines the apartment one, and the two can point opposite ways.
 */
export const RANKING_LABELS = {
  why: 'Warum an dieser Stelle',
  helps: 'Spricht dafür',
  hurts: 'Spricht dagegen',
  hint: 'Die Reihenfolge folgt nicht allein der Passung — Vorgeschichte, Zimmer und Sprache zählen mit.',
  riskLevels: {
    LOW: 'Vorgeschichte: geringes Risiko',
    MEDIUM: 'Vorgeschichte: mittleres Risiko',
    HIGH: 'Vorgeschichte: hohes Risiko',
    CRITICAL: 'Vorgeschichte: kritisches Risiko',
  } as Record<string, string>,
  factors: {
    blockingIssue: () => 'Ausschlusskriterium dieser Unterkunft',
    blockingConflicts: (n: number) =>
      n === 1 ? '1 blockierender Konflikt' : `${n} blockierende Konflikte`,
    roomBlocking: () => 'Kein passendes Zimmer',
    highConflicts: (n: number) =>
      n === 1 ? '1 schwerwiegender Konflikt' : `${n} schwerwiegende Konflikte`,
    unitConcerns: (n: number) => `Unterkunft: ${n} Bedenken`,
    roommateConcerns: (n: number) => `Mitbewohner*innen: ${n} Bedenken`,
    unscorableRoom: () => 'Zimmerpassung noch unbekannt',
    sharedLanguages: (n: number) => (n === 1 ? '1 gemeinsame Sprache' : `${n} gemeinsame Sprachen`),
    emptyUnit: () => 'Unterkunft ist noch leer',
    roomFit: (score: number) => `Zimmerpassung ${score}%`,
    apartmentFit: (score: number) => `Wohnungspassung ${score}%`,
  },
} as const
