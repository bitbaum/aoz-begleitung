import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { availableLocales, getDictionary, type LocaleId } from '@/lib/i18n'
import { de, type MessageKey } from '@/lib/i18n/dictionaries/de'
import { SURVEY_TEMPLATES } from '@/lib/config/survey-templates'

/**
 * AOZ addresses its clients with "Sie" — never "du" — in every language.
 *
 * Owner decision, 2026-10-02. The portal had been written in the informal
 * register on purpose (a flat-share app saying "du" is warm), and it read as
 * an institution talking down to the adults it houses. One stray "du" in a
 * page of "Sie" is worse than either register alone: it reads as a slip, or
 * as a judgement about the person reading it.
 *
 * Nothing else catches it. A "du" type-checks, lints, renders and passes
 * every other test, so this one scans the text a client actually reads:
 *
 *   1. every OFFERED dictionary, with the informal forms of its own language;
 *   2. the survey template, in every locale it carries;
 *   3. the German client-facing sources outside the dictionaries.
 *
 * Imperatives ("Melde", "Schreib", "Réessaie") are not caught by a word list
 * and were converted by hand; the pronouns and possessives below are what a
 * du-form sentence almost always also contains, which is why they are the
 * signal.
 */

/**
 * Informal pronouns and possessives per language. Case-sensitive on purpose:
 * German "Sie/Ihr" are the formal forms, and a lower-case "ihr" (you-plural)
 * cannot be told from "her/their" by a regex, so it is not listed.
 */
const INFORMAL: Partial<Record<LocaleId, RegExp>> = {
  de: /(?<![\p{L}])(du|Du|dich|Dich|dir|Dir|dein\p{L}*|Dein\p{L}*|euch|Euch|euer|Euer|eure\p{L}*|Eure\p{L}*)(?![\p{L}])/u,
  fr: /(?<![\p{L}])(tu|Tu|toi|Toi|ton|Ton|ta|Ta|tes|Tes|te|t’|t')(?![\p{L}])|-tu(?![\p{L}])|-toi(?![\p{L}])/u,
  ru: /(?<![\p{L}])(ты|Ты|тебя|Тебя|тебе|Тебе|тобой|твой|Твой|твоя|Твоя|твоё|Твоё|твое|твои|Твои|твоего|твоей|твоему|твоим|твоих|твою|твоём)(?![\p{L}])/u,
  uk: /(?<![\p{L}])(ти|Ти|тебе|Тебе|тобі|Тобі|тобою|твій|Твій|твоя|Твоя|твоє|Твоє|твої|Твої|твого|твоєї|твоїй|твоєму|твоїм|твоїх|твою)(?![\p{L}])/u,
  // Not offered yet (incomplete dictionaries), and written in the informal
  // register. Listed so that the day one of them is finished and offered,
  // this gate turns red until its register is fixed too.
  tr: /(?<![\p{L}])(sen|Sen|seni|sana|Sana|senin|Senin|sende)(?![\p{L}])/u,
  fa: /(?<![\p{L}])(تو)(?![\p{L}])/u,
  sq: /(?<![\p{L}])(ti|Ti|yt|jote|tënd|tënde)(?![\p{L}])/u,
}

/**
 * Offered languages that have no T/V distinction a word list could check, each
 * with the reason. A new offered locale must land in INFORMAL or here.
 */
const NO_TV_DISTINCTION: Partial<Record<LocaleId, string>> = {
  en: 'English has a single "you".',
  ar: 'Arabic UI copy uses the singular "you" for everyone; the plural of respect is not a convention a resident would expect from an app.',
  so: 'Somali has no formal second person.',
  ti: 'Tigrinya marks respect with the plural; not offered, and nobody on the team can check it.',
}

/**
 * Strings that keep "du" deliberately, each with the reason. Matched as a
 * substring of the offending literal, scoped to one file.
 */
const ALLOWED: { file: string; contains: string; reason: string }[] = [
  // The self-serve household door only opens on a WG deployment, where the
  // reader is setting up their own shared flat — not an AOZ client.
  {
    file: 'src/lib/constants/labels/auth.ts',
    contains: 'lade deine Mitbewohner',
    reason: 'WG only',
  },
  {
    file: 'src/lib/constants/labels/auth.ts',
    contains: 'so heisst eure Wohnung',
    reason: 'WG only',
  },
  { file: 'src/lib/constants/labels/auth.ts', contains: 'Dein Name (optional)', reason: 'WG only' },
  {
    file: 'src/lib/constants/labels/auth.ts',
    contains: 'Kannst du leer lassen',
    reason: 'WG only',
  },
  { file: 'src/lib/constants/labels/auth.ts', contains: 'du bist angemeldet', reason: 'WG only' },
  {
    file: 'src/lib/constants/labels/auth.ts',
    contains: 'Dein persönlicher Code',
    reason: 'WG only',
  },
  { file: 'src/lib/constants/labels/auth.ts', contains: 'Notiere ihn dir', reason: 'WG only' },
  {
    file: 'src/lib/constants/error-messages.ts',
    contains: 'gib deiner Wohnung',
    reason: 'WG only',
  },
]

/** German sources a client reads, outside the dictionaries. Dirs are walked. */
const CLIENT_GERMAN_SOURCES = [
  'src/lib/constants/labels/portal.ts',
  'src/lib/constants/labels/complaints.ts',
  'src/lib/constants/labels/auth.ts',
  'src/lib/constants/labels/ui.ts',
  'src/lib/constants/error-messages.ts',
  'src/lib/config/brand.ts',
  'src/lib/config/care.ts',
  'src/lib/config/learning.ts',
  'src/lib/config/household-tasks.ts',
  'src/lib/config/organization.ts',
  'src/lib/config/resident-factors.ts',
  'src/lib/config/opportunities.ts',
  'src/lib/opportunities/pipeline.ts',
  'src/lib/validation/governance.ts',
  'src/lib/email/templates.ts',
  'src/components/governance',
  'src/components/portal',
  'src/app/portal',
]

const ROOT = process.cwd()

function walk(path: string): string[] {
  const abs = join(ROOT, path)
  if (statSync(abs).isFile()) return [path]
  return readdirSync(abs).flatMap((entry) => {
    if (entry === '__tests__') return []
    const child = join(path, entry)
    if (statSync(join(ROOT, child)).isDirectory()) return walk(child)
    return /\.(ts|tsx)$/.test(entry) ? [child] : []
  })
}

/**
 * The text a reader can see: string literals and JSX text. Comments are
 * stripped first — they are English and may quote the old copy.
 */
function visibleText(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
  const literals = [
    ...code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g),
  ].map((m) => m[1] ?? m[2] ?? m[3] ?? '')
  const jsxText = [...code.matchAll(/>([^<>{}]*[\p{L}][^<>{}]*)</gu)].map((m) => m[1])
  return [...literals, ...jsxText]
}

function informalInSource(file: string, source: string): string[] {
  const pattern = INFORMAL.de!
  return visibleText(source)
    .filter((text) => pattern.test(text))
    .filter((text) => !ALLOWED.some((a) => a.file === file && text.includes(a.contains)))
    .map((text) => `${file}: "${text.trim().slice(0, 100)}"`)
}

describe('clients are addressed formally (Sie / vous / Вы / Ви)', () => {
  it('every offered locale is either checked or explains why it cannot be', () => {
    const unaccounted = availableLocales()
      .map((l) => l.id)
      .filter((id) => !INFORMAL[id] && !NO_TV_DISTINCTION[id])
    expect(unaccounted).toEqual([])
  })

  it.each(
    availableLocales()
      .filter((l) => INFORMAL[l.id])
      .map((l) => l.id),
  )('the %s dictionary has no informal pronoun', (locale) => {
    const dictionary = getDictionary(locale)
    const pattern = INFORMAL[locale]!
    const offenders = (Object.keys(de) as MessageKey[])
      .filter((key) => {
        const value = dictionary[key]
        return value !== undefined && pattern.test(value)
      })
      .map((key) => `${locale}:${key}: "${dictionary[key]}"`)
    expect(offenders).toEqual([])
  })

  it('the survey templates ask formally in every language', () => {
    const offenders: string[] = []
    const visit = (node: unknown, path: string) => {
      if (!node || typeof node !== 'object') return
      for (const [k, v] of Object.entries(node)) {
        const pattern = INFORMAL[k as LocaleId]
        if (typeof v === 'string' && pattern?.test(v)) offenders.push(`${path}.${k}: "${v}"`)
        else visit(v, `${path}.${k}`)
      }
    }
    SURVEY_TEMPLATES.forEach((t) => visit(t, t.id))
    expect(offenders).toEqual([])
  })

  it('German client-facing sources outside the dictionaries say Sie', () => {
    const offenders = CLIENT_GERMAN_SOURCES.flatMap(walk).flatMap((file) =>
      informalInSource(relative(ROOT, join(ROOT, file)), readFileSync(join(ROOT, file), 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('every exception still matches something — a stale one hides nothing but itself', () => {
    const stale = ALLOWED.filter(
      (a) => !readFileSync(join(ROOT, a.file), 'utf8').includes(a.contains),
    )
    expect(stale).toEqual([])
  })
})
