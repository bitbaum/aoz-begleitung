/**
 * Authentication and role labels
 */
import { BRAND } from '@/lib/config/brand'
import { RESIDENT_CODE_PREFIX } from '@/lib/auth/code-prefixes'

/**
 * The German word for each staff role.
 *
 * Every value in `StaffRole` must appear here. A missing entry does not throw
 * and does not fail a type check — the lookup simply falls through and the
 * team roster prints the raw enum, which is how `LIEGENSCHAFTEN` sat in
 * SCREAMING_SNAKE_CASE beside "Betreuung" and "Jobcoach" on the settings page
 * from the day the role was added. Pinned by `role-labels.test.ts`.
 */
export const ROLE_LABELS: Record<string, string> = {
  // NOT "Leitung". ADMIN is the retired role, kept only so live JWTs and
  // existing rows resolve; what it actually grants is ALL_DOMAINS scope plus
  // isSystemAdmin — reconfiguring the product. "Leitung" names an
  // organisational rank AOZ genuinely has (it was recruiting a
  // Programmleiter*in and a Teamleiter*in Betreuung), and a Teamleiter*in
  // Betreuung is deliberately expressible WITHOUT this role: BETREUUNG +
  // ALL_DOMAINS + NOT isSystemAdmin. Labelling ADMIN "Leitung" claimed the
  // rank for the one role that does not confer it, and quietly undercut the
  // three-axis split that exists precisely to avoid a LEITUNG enum value.
  ADMIN: 'Systemadministration',
  BETREUUNG: 'Betreuung',
  SOZIALARBEIT: 'Sozialarbeit',
  JOBCOACH: 'Jobcoach',
  FREIWILLIGENARBEIT: 'Freiwilligenarbeit',
  // Runs the buildings, holds no caseload. Named for the stock, not for a
  // care domain — which is the whole reason the role exists.
  LIEGENSCHAFTEN: 'Liegenschaften',
}

/**
 * How wide someone's view is — the second of the three facts a staff member
 * carries, and the one a team roster actually needs to show.
 *
 * The roster used to print each colleague's login CODE here. A code is the
 * credential, not an identifier, so that was every account's password on one
 * page. What an administrator genuinely needs to know about a colleague is
 * whose files they can open, which is this.
 */
export const SCOPE_LABELS: Record<string, string> = {
  OWN_DOMAIN: 'eigener Bereich',
  ALL_DOMAINS: 'alle Bereiche',
}

/** Marks the people who may reconfigure the product, distinct from reach. */
export const SYSTEM_ADMIN_LABEL = 'Systemverwaltung'

/**
 * The access-denied page.
 *
 * A permission denial used to surface as "Etwas ist schiefgelaufen … Bitte
 * versuchen Sie es erneut" — a generic crash telling the person to retry
 * something that can never succeed. A Jobcoach clicking a button the app
 * itself offered would conclude the software was broken. A boundary is not an
 * outage, and it must never be dressed as one.
 */
export const NO_ACCESS_LABELS = {
  eyebrow: 'Kein Zugriff',
  title: 'Diese Seite gehört zu einem anderen Aufgabenbereich.',
  /** Filled with the permission's plain-language description. */
  needs: (what: string) => `Um sie zu öffnen, braucht es die Berechtigung, ${what}.`,
  needsUnknown: 'Ihre Rolle hat für diesen Bereich keine Berechtigung.',
  yourRole: 'Ihre Rolle',
  whoCan: 'Diese Rollen können das',
  /** Named so nobody has to guess whom to ask. */
  askHint:
    'Wenden Sie sich an die Person, die diese Instanz verwaltet, wenn Sie den Zugriff brauchen.',
  backToDashboard: 'Zum Eingang',
  /** NOT "Erneut versuchen": retrying a permission boundary never works. */
  retryIsPointless: 'Erneutes Laden ändert daran nichts — es ist kein Fehler.',
} as const

export const LOGIN_LABELS = {
  /** The way out of the login page. It had none: every account page was a
   *  dead end, so anyone who reached /login could no longer get to the site. */
  backToHome: 'Zurück zur Startseite',
  /**
   * Names who each door is for, so nobody guesses which field is theirs.
   * Reads the register from the brand: hardcoding "Klient*innen" here put AOZ
   * casework language on the shared-flat deployment, in the same change that
   * added the config to stop exactly that.
   */
  audienceHint: `Für Fachpersonen und ${BRAND.clientTermPlural} — ein Login, beide Rollen.`,
  title: 'Anmelden',
  subtitle: 'Mit E-Mail und Passwort anmelden',
  email: 'E-Mail',
  emailPlaceholder: 'name@example.ch',
  password: 'Passwort',
  forgotPassword: 'Passwort vergessen?',
  noAccount: 'Noch kein Konto?',
  registerLink: 'Konto erstellen',
  useCode: 'Mit Code anmelden',
  useEmail: 'Mit E-Mail anmelden',
  codeSubtitle: 'Code eingeben, um sich anzumelden',
  code: 'Zugangscode',
  codePlaceholder: `${BRAND.codePrefix}XXXXXX oder ${RESIDENT_CODE_PREFIX}XXXXXX`,
  codeHint: 'Verwenden Sie Ihren persönlichen Zugangscode.',
  emailVerified: 'E-Mail-Adresse bestätigt. Sie können sich jetzt anmelden.',
  emailVerifyFailed: 'Der Bestätigungslink ist ungültig oder abgelaufen.',
  passwordResetDone: 'Passwort gesetzt. Melden Sie sich jetzt damit an.',
  submit: 'Anmelden',
  submitting: 'Anmelden...',
  success: {
    staff: 'Admin-Zugang aktiviert',
    resident: 'Klient*innen-Zugang aktiviert',
    redirecting: 'Weiterleitung...',
  },
  error: {
    required: 'Code erforderlich',
    invalid: 'Ungültiger Code',
    rateLimit: 'Zu viele Anmeldeversuche',
    generic: 'Ein Fehler ist aufgetreten',
  },
  help: `Bei Problemen wenden Sie sich an die ${BRAND.shortName}-Verwaltung.`,
  demo: {
    title: 'Direkt ausprobieren',
    // The person's term comes from the brand, like their code prefix does —
    // this line used to say "Bewohner:in", a third gendering convention beside
    // the gender star used everywhere else in the product.
    // Names the choice, because the choice is the point: the product looks
    // different for every role, and the visitor picks which one to stand in.
    description: `Ohne Konto, ein Klick: Sie sehen das echte Produkt aus der Sicht der Rolle, die Sie wählen — auch als ${BRAND.clientTerm}.`,
    staff: `${BRAND.shortName}-Verwaltung`,
    resident: `Als ${BRAND.clientTerm} ausprobieren`,
    // Production holds real people and offers no demo doors; the demo lives
    // on its own instance with invented data.
    elsewhere:
      'Ohne Konto, mit erfundenen Daten: Die Demo läuft auf einer eigenen Instanz, getrennt von echten Personendaten.',
    openDemo: 'Demo öffnen',
  },
} as const

export const REGISTER_LABELS = {
  title: 'Konto erstellen',
  subtitle:
    'Mit Ihrem Zugangscode registrieren — danach melden Sie sich mit E-Mail und Passwort an.',
  codeHint: 'Der Code, den Sie von der Verwaltung oder Ihrer WG erhalten haben.',
  passwordHint: 'Mindestens 8 Zeichen.',
  submit: 'Konto erstellen',
  submitting: 'Konto wird erstellt...',
  success: 'Konto erstellt — Sie sind angemeldet.',
  // Linking a second role is the same form, so it needs saying out loud —
  // otherwise nobody discovers that one login can hold both sides.
  linkTitle: 'Zwei Rollen, ein Login',
  linkHint:
    'Sie haben bereits ein Konto und einen zweiten Code — etwa als Klient*in und in der Verwaltung? Registrieren Sie den zweiten Code mit derselben E-Mail-Adresse und Ihrem bestehenden Passwort. Beide Rollen liegen danach auf einem Login.',
  successBothRoles: 'Codes verknüpft — Sie sind für beide Rollen angemeldet.',
  hasAccount: 'Bereits ein Konto?',
  loginLink: 'Anmelden',

  // --- Self-serve household (WG brand only; see BRAND.features.selfServeHousehold)
  // Duzen, not siezen: the rest of this block sietzt because it addresses AOZ
  // staff and clients. This door only ever opens on a WG deployment, where the
  // reader is someone setting up their own flat.
  modeCodeTab: 'Ich habe einen Code',
  modeHouseholdTab: 'Neue Wohnung',
  householdSubtitle: 'Erstelle eine Wohnung und lade deine Mitbewohner*innen später dazu ein.',
  householdNameLabel: 'Name der Wohnung',
  householdNamePlaceholder: 'z. B. Singapur',
  householdNameHint: 'Frei wählbar — so heisst eure Wohnung in der App.',
  displayNameLabel: 'Dein Name (optional)',
  displayNameHint: 'Kannst du leer lassen. Ohne Namen erscheint dein Code.',
  householdSubmit: 'Wohnung erstellen',
  householdSubmitting: 'Wohnung wird erstellt...',
  householdSuccess: 'Wohnung erstellt — du bist angemeldet.',
  // Shown once and never again: this is the other way back in, and after this
  // screen nothing in the product ever displays it.
  householdCodeTitle: 'Dein persönlicher Code',
  householdCodeHint:
    'Notiere ihn dir. Du kannst dich damit auch ohne E-Mail und Passwort anmelden.',
} as const

export const FORGOT_PASSWORD_LABELS = {
  title: 'Passwort vergessen',
  subtitle: 'Wir senden Ihnen einen Link zum Zurücksetzen.',
  submit: 'Link anfordern',
  submitting: 'Wird gesendet...',
  // Deliberately identical whether the email exists or not (no enumeration).
  success:
    'Falls ein Konto mit dieser E-Mail existiert, haben wir einen Link zum Zurücksetzen gesendet. Prüfen Sie auch den Spam-Ordner.',
  backToLogin: 'Zurück zur Anmeldung',
} as const

export const RESET_PASSWORD_LABELS = {
  title: 'Neues Passwort setzen',
  subtitle: 'Wählen Sie ein neues Passwort für Ihr Konto.',
  newPassword: 'Neues Passwort',
  submit: 'Passwort speichern',
  submitting: 'Wird gespeichert...',
  missingToken: 'Dieser Link ist unvollständig. Öffnen Sie den Link aus der E-Mail erneut.',
  requestNew: 'Neuen Link anfordern',
} as const
