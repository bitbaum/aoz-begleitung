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
import { BRAND, type BrandId } from '@/lib/config/brand'
import type { PublicLocaleId } from '@/lib/config/public-locales'
import { BLOG_LABELS } from './blog'

export interface PublicChromeCopy {
  /** The skip link, first thing a keyboard reaches. */
  skipLink: string
  /** Accessible name of the main navigation. */
  navLabel: string
  /** The phone menu button. */
  menu: string
  /** The header's sign-in action. */
  toLogin: string
  /** The brand's register line beside the wordmark and in the footer. */
  tagline: string
  /** Accessible name of the footer link list. */
  footerLabel: string
  /** The small line in the footer, and the blog's name. */
  blogTitle: string
  nav: { blog: string; roadmap: string; changelog: string }
  /** The theme button's accessible name, per CURRENT mode. */
  theme: { system: string; light: string; dark: string }
  /** The way back to the landing page from an account page. */
  backToHome: string
  /** Accessible name of the row of legal links. */
  legalLabel: string
  aiLink: string
  privacy: string
  impressum: string
}

/**
 * The brand's tagline in each language. Per brand as well as per language, for
 * the same reason the tagline is a brand field at all: an organisation's
 * integration platform is not a shared flat's "living together".
 */
const TAGLINE: Record<Exclude<PublicLocaleId, 'de'>, Record<BrandId, string>> = {
  en: { aoz: 'Integration platform', wg: 'Living together' },
  fr: { aoz: 'Plateforme d’intégration', wg: 'Vivre ensemble' },
}

export const PUBLIC_CHROME: Record<PublicLocaleId, PublicChromeCopy> = {
  de: {
    skipLink: 'Zum Inhalt springen',
    navLabel: 'Navigation',
    menu: 'Menü',
    toLogin: BLOG_LABELS.toApp,
    tagline: BRAND.tagline,
    footerLabel: 'Weitere Seiten',
    blogTitle: BLOG_LABELS.title,
    nav: { blog: 'Blog', roadmap: 'Roadmap', changelog: 'Changelog' },
    theme: {
      system: 'Systemdesign wechseln',
      light: 'Helles Design wechseln',
      dark: 'Dunkles Design wechseln',
    },
    backToHome: 'Zurück zur Startseite',
    legalLabel: 'Rechtliches',
    aiLink: 'KI und Datenschutz',
    privacy: 'Datenschutz',
    impressum: 'Impressum',
  },
  en: {
    skipLink: 'Skip to content',
    navLabel: 'Navigation',
    menu: 'Menu',
    toLogin: 'Sign in',
    tagline: TAGLINE.en[BRAND.id],
    footerLabel: 'More pages',
    blogTitle: 'Engineering blog',
    nav: { blog: 'Blog', roadmap: 'Roadmap', changelog: 'Changelog' },
    theme: {
      system: 'Change theme (now: system)',
      light: 'Change theme (now: light)',
      dark: 'Change theme (now: dark)',
    },
    backToHome: 'Back to the home page',
    legalLabel: 'Legal',
    aiLink: 'AI and privacy',
    privacy: 'Privacy',
    impressum: 'Legal notice',
  },
  fr: {
    skipLink: 'Aller au contenu',
    navLabel: 'Navigation',
    menu: 'Menu',
    toLogin: 'Se connecter',
    tagline: TAGLINE.fr[BRAND.id],
    footerLabel: 'Autres pages',
    blogTitle: 'Blog technique',
    nav: { blog: 'Blog', roadmap: 'Feuille de route', changelog: 'Nouveautés' },
    theme: {
      system: 'Changer de thème (actuel : système)',
      light: 'Changer de thème (actuel : clair)',
      dark: 'Changer de thème (actuel : sombre)',
    },
    backToHome: 'Retour à la page d’accueil',
    legalLabel: 'Informations légales',
    aiLink: 'IA et protection des données',
    privacy: 'Protection des données',
    impressum: 'Mentions légales',
  },
}
