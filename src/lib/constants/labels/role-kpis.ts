/**
 * Copy for the per-domain KPI section. @see lib/analytics/role-kpis.ts
 */
export const ROLE_KPI_LABELS = {
  eyebrow: 'Wirkung',
  jobTitle: 'Arbeitsmarkt-Integration',
  volunteeringTitle: 'Engagement & Teilhabe',

  /** Says whose numbers these are — a personal caseload or the whole pilot. */
  scopeOwn: 'Ihre begleiteten Personen.',
  scopeAll: 'Alle Klient*innen — ohne noch nicht übernommene Platzhalter-Profile.',

  unitDays: 'Tage · ',
  /**
   * Singular matters here rather than being pedantry: these caseloads are one
   * and two people, so "von 1 Personen" is the string a real coach would read
   * on a real screen, every day, about a real person.
   */
  denominator: (n: number) => (n === 1 ? 'von 1 Person' : `von ${n} Personen`),

  basis: 'Grundlage:',

  laggingTitle: 'Wirkungsziele Integrationsagenda Schweiz',
  laggingHelp:
    'Die verbindlichen Fernziele, auf die diese Frühindikatoren hinarbeiten. Sie werden hier nicht gemessen — dafür braucht es Jahre und eine kantonale Definition von «nachhaltig».',
} as const
