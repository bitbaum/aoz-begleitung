/**
 * The words of the PUBLIC chrome — everything around a public page's own copy —
 * in each public language.
 *
 * The landing copy was translated (`marketing.<lang>.ts`) while everything
 * around it stayed German, so `/fr/willkommen` opened with "Zum Inhalt
 * springen" and closed on "Weitere Seiten". The chrome is part of the page a
 * reader sees; it is translated with it, from one table per language, so the
 * compiler refuses a language that names some of the chrome and not the rest.
 *
 * The pages behind the legal links are German. The LINKS are still labelled in
 * the reader's language: a French reader looking for "Mentions légales" must be
 * able to find it, and the page then says what it says.
 */
import type { PublicLocaleId } from '@/lib/config/public-locales'

export interface PublicChromeCopy {
  /** The way back to the landing page from an account page. */
  backToHome: string
  /** Accessible name of the row of legal links. */
  legalLabel: string
  aiLink: string
  privacy: string
  impressum: string
}

export const PUBLIC_CHROME: Record<PublicLocaleId, PublicChromeCopy> = {
  de: {
    backToHome: 'Zurück zur Startseite',
    legalLabel: 'Rechtliches',
    aiLink: 'KI und Datenschutz',
    privacy: 'Datenschutz',
    impressum: 'Impressum',
  },
  en: {
    backToHome: 'Back to the home page',
    legalLabel: 'Legal',
    aiLink: 'AI and privacy',
    privacy: 'Privacy',
    impressum: 'Legal notice',
  },
  fr: {
    backToHome: 'Retour à la page d’accueil',
    legalLabel: 'Informations légales',
    aiLink: 'IA et protection des données',
    privacy: 'Protection des données',
    impressum: 'Mentions légales',
  },
}
