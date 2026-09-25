import {
  FACTOR_COUNT,
  SOURCE_COUNT,
  type MarketingCopy,
  type MarketingRegisters,
} from './marketing-types'

/**
 * German — the language the product is written in, and the base every other
 * landing language is translated FROM.
 *
 * WHAT IS DELIBERATELY ABSENT: numbers. No "30% fewer conflicts", no residents
 * housed, no hours saved. This product is measured by a pilot that has not
 * reported yet, and a landing page that invents its own evidence is the one
 * thing that would disqualify it in front of the people being asked to trust
 * it with vulnerable residents. Everything claimed here is a description of
 * what the software does, which is checkable by pressing the demo button.
 * That rule binds every translation too — a language is not a licence to make
 * a stronger claim than the German page makes.
 */

/** The pitch register: an organisation deciding whether to use this. */
const PLACEMENT_COPY: MarketingCopy = {
  eyebrow: 'Für Fachpersonen und Klient*innen',
  headline: 'Die ganze Begleitung an einem Ort.',
  // Short on purpose. This line also renders beside the login form, where a
  // paragraph is a wall of text — and a hero that needs sixty words to say what
  // the product is has not decided what the product is.
  subline:
    'Wohnen, Alltag im Haus, Gemeinschaft und Integration in einem Verlauf — Fachpersonen und Klient*innen sehen denselben Stand.',
  ctaPrimary: 'Produkt ansehen',
  ctaSecondary: 'Anmelden',
  ctaNote: 'Kein Konto nötig. Sie sehen das echte Produkt mit Beispieldaten.',

  problemEyebrow: 'Das Problem',
  problemTitle: 'Integration scheitert oft an Fragmentierung, nicht an fehlendem Willen.',
  problems: [
    {
      title: 'Stabilität und Fortschritt laufen getrennt',
      body: 'Housing, Sprache, Arbeit, Teilhabe und Betreuungsschritte liegen oft in verschiedenen Listen, Köpfen und Postfächern. Niemand sieht schnell genug, was als Nächstes zählt.',
    },
    {
      title: 'Instabilität frisst Betreuungszeit',
      body: 'Konflikte, ungeklärte Transfers, verpasste Rückmeldungen und offene Follow-ups binden Fachpersonen genau dort, wo sie eigentlich begleiten sollten.',
    },
    {
      title: 'Evidenz bleibt zu oft folgenlos',
      body: 'Kurse, Sprachtests, Qualifikationen oder freiwilliges Engagement werden dokumentiert, aber nicht konsequent in Prioritäten, Boards und nächste Schritte übersetzt.',
    },
  ],

  howEyebrow: 'So funktioniert es',
  howTitle: 'Vier Arbeitsbereiche, ein gemeinsamer Verlauf.',
  steps: [
    {
      title: 'Stabilität sichern',
      body: 'Housing, Sicherheit, Vorfälle, Transfers und Regeln bilden die belastbare Basis. Ohne Stabilität trägt keine Integration.',
    },
    // German, like the rest of the page. "Capability / Participation / Guidance"
    // survived an earlier sweep that fixed the same three English abstractions
    // in `features` and missed this list — on a page written for Swiss social
    // services, in a product whose own rule is that UI text is German.
    {
      title: 'Fähigkeiten sichtbar machen',
      body: 'Sprache, Kurse, Qualifikationen und Arbeitsmarktschritte werden als belegter Verlauf erfasst, nicht als lose Notizen.',
    },
    {
      title: 'Teilhabe fördern',
      body: 'Freiwilligenarbeit, Aktivitäten und Alltagsorientierung werden als echte Fortschrittssignale sichtbar gemacht.',
    },
    {
      title: 'Begleitung abschliessen',
      body: 'Boards, Follow-ups, Nachrichten und nächste Schritte führen Fachpersonen zurück in eine klare Handlung statt in offene Schleifen.',
    },
  ],

  featuresEyebrow: 'Im Produkt',
  // No number in this heading. It said "Vier Pfeiler" while the list below it
  // had six, because a count written into prose does not move when the list
  // does — and the two sat three lines apart in the same file. Pinned by
  // `marketing-copy.test.ts` ("a heading may not count its own list").
  featuresTitle: 'Was das Produkt für Fachpersonen und Klient*innen kann.',
  // German, not English. "Stability / Capability / Participation / Guidance"
  // were four abstract nouns in the wrong language on a page written for Swiss
  // social services, and none of them named a thing you could go and press.
  features: [
    {
      icon: 'building',
      title: 'Stabilität im Wohnen',
      body: 'Unterkünfte, Platzierung, Verlegungen, Wartung und Vorfälle in einem Verlauf — mit einem Matching, das erklärt, warum es diese Kombination vorschlägt.',
    },
    {
      icon: 'vote',
      title: 'Das Haus regelt seinen Alltag',
      body: 'Hausregeln mit Versionen und Bestätigung, Aufgaben mit Fairness-Bilanz und ein Weg für Anliegen, der bis zur Antwort führt.',
    },
    {
      icon: 'shop',
      title: 'Nachbarschaft, die trägt',
      body: 'Ein Marktplatz für Sachen und für Hilfe, Veranstaltungen im Haus mit Zusagen, und ein Verzeichnis der Angebote im Quartier.',
    },
    {
      icon: 'learning',
      title: 'Weiterkommen',
      body: 'Sprache, Kurse und Qualifikationen als belegter Verlauf, dazu Einsatzplätze und Freiwilligenarbeit mit Bewerbungsstand.',
    },
    {
      icon: 'message',
      title: 'Antworten, die ankommen',
      body: 'Meldungen gehen an die Stelle, die etwas tun kann, und die Antwort kommt zurück. Care Team, Nachrichten und Follow-ups halten die Zuständigkeit sichtbar.',
    },
    {
      icon: 'chart',
      title: 'Nachvollziehbar für alle',
      body: 'Jede Platzierung ist protokolliert, jeder Score zerlegbar, jedes Abstimmungsergebnis mit der damals gültigen Regel erklärbar.',
    },
  ],

  scienceEyebrow: 'Wissenschaftliche Grundlage',
  scienceTitle: `Keine Meinung, sondern Methode: ${FACTOR_COUNT} Matching-Faktoren — und Alltagsmechanik nach dokumentierten Befunden.`,
  scienceBody: `Die Kompatibilitätsfaktoren sind aus publizierter Forschung abgeleitet — Schweizer Studien zuerst, internationale zur Einordnung, insgesamt ${SOURCE_COUNT} Quellen —, und die Evidenzstärke ist je Faktor offen ausgewiesen: Manche Befunde stammen aus anderen Wohnformen und sind für Kollektivunterkünfte eine begründete Annahme, die der Pilot prüft. Und die Mechanik jenseits des Matchings folgt denselben Massstäben: vom Eigenanteil-Bias beim Putzplan bis zur Regel, dass Sicherheit nie zur Abstimmung steht. Die vollständige Methodik samt Quellenverzeichnis ist im Produkt für alle Fachpersonen einsehbar — und in der Demo für Sie.`,
  science: [
    {
      title: 'Sauberkeit ist eine Richtung, kein Durchschnitt',
      body: 'Gemessen wird, wessen Erwartung an die anderen unerfüllt bleibt — nicht die Differenz zweier Zahlen. Ordentlich-aber-gelassen neben unordentlich ergibt keinen Konflikt; zwei gleich Unordentliche, von denen eine*r viel erwartet, sehr wohl.',
    },
    {
      title: 'Das schwierigste Paar bestimmt die Bewertung',
      body: 'Ein Haushalt wird nach seiner konfliktreichsten Paarung bewertet, nie nach dem Durchschnitt — der Durchschnitt versteckt genau die Paarung, die später die Vorfälle produziert.',
    },
    {
      title: 'Harte Anforderungen werden nicht verrechnet',
      body: 'Rollstuhlzugang, Rauchen, Schutzbedürfnis Einzelzimmer: Was nicht erfüllbar ist, wird nicht von guten Teilwerten schöngerechnet, sondern blockiert die Platzierung.',
    },
    {
      title: 'Jede Zahl ist erklärbar',
      body: 'Jeder Score zerlegt sich in benannte Faktoren mit Gewicht und Evidenzstärke, und Warnungen sagen, wer sich woran stören wird. Entscheidungen bleiben bei den Fachpersonen — begründbar gegenüber Team und Klient*innen.',
    },
    {
      title: 'Fairness ist eine Bilanz, kein Ranking',
      body: 'Wer aufräumt, überschätzt den eigenen Anteil — ein dokumentierter Bias, kein Charakterfehler. Der Aufgabenplan zeigt deshalb, wer wie viel getragen hat, statt Erinnerung gegen Erinnerung antreten zu lassen.',
    },
    {
      title: 'Sicherheit steht nie zur Abstimmung',
      body: 'Haushalte entscheiden über ihren Alltag selbst — aber eine Mehrheit kann die Sicherheit einer Minderheit nicht wegstimmen. Solche Themen gehen immer an die Fachpersonen, und jedes Abstimmungsergebnis bleibt mit der damals gültigen Regel erklärbar.',
    },
  ],

  ethicsEyebrow: 'Grenzen',
  ethicsTitle: 'Was diese Software über Menschen nicht wissen will.',
  ethicsBody:
    'Das System dient Menschen in einer verletzlichen Lage. Erfasst wird nur, was die Begleitung wirklich braucht. Ausweisart und Ablaufdatum tragen Klient*innen selbst ein, wenn sie wollen — diese Angaben gehören ihnen, dienen der Erinnerung an eine Frist und fliessen nie in eine Zuteilung, eine Bewertung oder eine Statistik ein. Was nicht erfasst wird, lässt sich auch nicht gegen jemanden verwenden.',
  neverTracked: [
    'Medizinische Diagnosen',
    'Dossierdetails: Verfahren, Stand, Entscheid',
    'Religion und politische Überzeugung',
    'Persönliche Geschichte ohne Wohnbezug',
  ],

  blogEyebrow: 'Blog und Produktdokumente',
  blogTitle: 'Warum das Produkt so gebaut ist und wie es sich weiterentwickelt.',
  blogLink: 'Alle Beiträge lesen',

  surfaceEyebrow: 'Im Produkt enthalten',
  surfaceTitle: 'Beide Seiten, vollständig — so wie sie im Menü stehen.',
  surfaceBody:
    'Diese Liste ist nicht abgetippt, sondern die Navigation des Produkts selbst. Kommt ein Bereich dazu, steht er hier. Verschwindet einer, verschwindet er auch hier.',
  // Nothing to explain on the German page: the menu names below ARE German.
  surfaceStaffNote: '',

  docsEyebrow: 'Nachvollziehbarkeit',
  docsTitle: 'Produktdenken, Fortschritt und wissenschaftliche Grundlage sind öffentlich lesbar.',
  docs: [
    {
      title: 'Roadmap',
      body: 'Wohin sich das Produkt entwickelt und welche Prinzipien die Richtung bestimmen.',
    },
    {
      title: 'Changelog',
      body: 'Was bereits im Produkt angekommen ist und wie sich die Plattform konkret verändert.',
    },
    {
      title: 'Blog',
      body: 'Hintergründe zu Entscheidungen, Forschung, Produktlogik und technischer Umsetzung.',
    },
  ],

  closingTitle: 'Sehen Sie es sich an.',
  closingBody:
    'Die Demo ist das echte Produkt mit Beispieldaten — Verwaltung, Begleitung und das Portal der Klient*innen. Blog, Roadmap und Changelog machen die Produktentscheidungen nachvollziehbar.',
}

/** The household register: the people who actually live in the flat. */
const HOUSEHOLD_COPY: MarketingCopy = {
  eyebrow: 'Gemeinsam wohnen',
  headline: 'Die Wohnung, auf die ihr euch einigen könnt.',
  subline:
    'Wer hat den Abfall rausgebracht, wer hat das WC-Papier bezahlt, und ab wann ist es zu laut? Alles an einem Ort — damit es nicht jedes Mal von vorn ausgehandelt wird.',
  ctaPrimary: 'Ausprobieren',
  ctaSecondary: 'Anmelden',
  ctaNote: 'Kein Konto nötig. Du siehst das echte Produkt mit Beispieldaten.',

  problemEyebrow: 'Warum',
  problemTitle: 'Streit in einer WG ist selten ein Streit über die Sache.',
  problems: [
    {
      title: 'Alle glauben, sie machen mehr',
      body: 'Man erinnert sich an die eigene Arbeit besser als an die der anderen. Das ist normal — und es reicht, damit sich alle ungerecht behandelt fühlen.',
    },
    {
      title: 'Abmachungen verschwinden',
      body: 'Was im Flur besprochen wurde, gilt genau so lange, bis sich zwei Leute unterschiedlich daran erinnern.',
    },
    {
      title: 'Geld macht es persönlich',
      body: 'Kleine Beträge, die niemand aufschreibt, werden zu einem Gefühl darüber, wer sich wie verhält.',
    },
  ],

  howEyebrow: 'So läuft es',
  howTitle: 'Aufschreiben, abmachen, nachschauen.',
  steps: [
    {
      title: 'Aufgaben festhalten',
      body: 'Putzen, Abfall, Einkauf. Wer es gemacht hat, steht da — nicht nur, wer dran gewesen wäre.',
    },
    {
      title: 'Ausgaben teilen',
      body: 'Ausgabe eintragen, Anteile werden berechnet. Der Kontostand sagt, wer wem was schuldet.',
    },
    {
      title: 'Gemeinsam entscheiden',
      body: 'Vorschlag einbringen, alle stimmen ab, das Ergebnis ist die Hausregel. Nachlesbar, mit Datum.',
    },
    {
      title: 'Melden, was kaputt ist',
      body: 'Der tropfende Wasserhahn geht an die Verwaltung, der Konflikt an die Betreuung. Ihr seht die Antwort.',
    },
  ],

  featuresEyebrow: 'Drin',
  featuresTitle: 'Was ihr benutzen könnt.',
  features: [
    {
      icon: 'wallet',
      title: 'Geteilte Ausgaben',
      body: 'Wer hat was bezahlt, wer schuldet wem. Auf den Rappen genau, mit dem kürzesten Ausgleichsweg.',
    },
    {
      icon: 'calendar',
      title: 'Aufgaben und Fairness',
      body: 'Der Putzplan als Bilanz statt als Rangliste: sichtbar, wer wie viel getragen hat.',
    },
    {
      icon: 'scroll',
      title: 'Hausregeln',
      body: 'Was in dieser Wohnung gilt, an einem Ort — und jede Änderung wird allen neu vorgelegt.',
    },
    {
      icon: 'vote',
      title: 'Abstimmen',
      body: 'Vorschläge, Fristen, Ergebnis mit Begründung. Sicherheit wird nie zur Abstimmung gestellt.',
    },
    {
      icon: 'building',
      title: 'Eure Wohnung',
      body: 'Ein Name, den ihr wählt, die Zimmer und wer hier wohnt. Mit Foto, wenn ihr wollt.',
    },
    {
      icon: 'alert',
      title: 'Melden',
      body: 'Schaden oder Konflikt — landet bei der Stelle, die etwas tun kann, und die Antwort kommt zurück.',
    },
  ],

  scienceEyebrow: 'Warum das funktioniert',
  scienceTitle: 'Hinter den Regeln steckt Forschung, kein Bauchgefühl.',
  scienceBody:
    'WG-Konflikte sind gut erforscht: Wer aufräumt, überschätzt den eigenen Anteil; Abmachungen ohne Datum zerfallen; Sauberkeitsstreit entsteht aus enttäuschten Erwartungen, nicht aus Unterschieden an sich. Die App ist um diese Befunde herum gebaut.',
  science: [
    {
      title: 'Alle glauben, sie machen mehr — messbar',
      body: 'Der dokumentierte Eigenanteil-Bias ist der Grund, weshalb der Putzplan eine Bilanz ist: sichtbar, wer wie viel getragen hat, statt Erinnerung gegen Erinnerung.',
    },
    {
      title: 'Sauberkeit ist eine Richtung',
      body: 'Es zählt, wessen Erwartung unerfüllt bleibt — nicht wer «ordentlicher» ist. Deshalb fragt die App nach eigenem Standard, Erwartung an andere und Toleranz, nicht nach einer Note.',
    },
    {
      title: 'Abmachungen brauchen ein Datum',
      body: 'Was im Flur besprochen wurde, gilt bis zur nächsten Erinnerungslücke. Beschlüsse mit Frist, Ergebnis und Begründung halten — und Sicherheit wird nie zur Abstimmung gestellt.',
    },
  ],

  ethicsEyebrow: 'Privatsphäre',
  ethicsTitle: 'Was die App über euch nicht wissen will.',
  ethicsBody:
    'Standardmässig habt ihr nicht einmal einen Namen in der App — euer Code genügt. Name, Foto und Text sind freiwillig, und Fotos sehen nur ihr und eure Mitbewohnenden.',
  neverTracked: [
    'Medizinische Diagnosen',
    'Dossierdetails: Verfahren, Stand, Entscheid',
    'Religion und politische Überzeugung',
    'Persönliche Geschichte ohne Wohnbezug',
  ],

  blogEyebrow: 'Technik-Blog',
  blogTitle: 'Warum das Produkt so gebaut ist, wie es ist.',
  blogLink: 'Alle Beiträge lesen',

  surfaceEyebrow: 'Alles drin',
  surfaceTitle: 'Was ihr in der App findet — genau so wie im Menü.',
  surfaceBody:
    'Diese Liste ist nicht abgetippt, sondern das Menü der App selbst. Kommt etwas dazu, steht es hier.',
  surfaceStaffNote: '',

  docsEyebrow: 'Zum Nachlesen',
  docsTitle: 'Wie die App entstanden ist und was als Nächstes kommt.',
  docs: [
    {
      title: 'Roadmap',
      body: 'Woran gerade gearbeitet wird und was als Nächstes dazukommt.',
    },
    {
      title: 'Changelog',
      body: 'Was sich zuletzt geändert hat, mit Datum.',
    },
    {
      title: 'Blog',
      body: 'Warum die App so funktioniert, wie sie funktioniert.',
    },
  ],

  closingTitle: 'Schau es dir an.',
  closingBody:
    'Die Demo ist das echte Produkt mit Beispieldaten — du siehst genau das, was die Bewohnenden sehen.',
}

export const marketingDe: MarketingRegisters = {
  placement: PLACEMENT_COPY,
  household: HOUSEHOLD_COPY,
}
