/**
 * What a listing says about authorisation — every kind × every stored value.
 *
 * Observed live on 2026-10-01: a CHF 70'000 job saved with the `NONE` default
 * rendered «Keine Bewilligung nötig» AND «Unbezahlte Freiwilligenarbeit —
 * offen für alle.» on the staff page. Both sentences are false of a job, and
 * the first is a legal claim about the reader's situation.
 */

import {
  OPPORTUNITY_KINDS,
  PERMIT_REQUIREMENT_LABELS,
  PERMIT_REQUIREMENTS,
  PERMIT_UNSTATED_LABEL,
  isWorkKind,
  permitStatement,
} from '@/lib/config/opportunities'
import { createTranslator } from '@/lib/i18n'
import { permitStatementLabel } from '@/lib/i18n/opportunity-labels'

const CASES = OPPORTUNITY_KINDS.flatMap((kind) =>
  PERMIT_REQUIREMENTS.map((permit) => [kind, permit] as const),
)

const NO_PERMIT_CLAIM = PERMIT_REQUIREMENT_LABELS.NONE
const UNPAID_CLAIM = /unbezahlt|freiwillig|offen für alle/i

describe('permitStatement', () => {
  it.each(CASES)('%s with %s', (kind, permit) => {
    const statement = permitStatement(kind, permit)
    const work = isWorkKind(kind)
    const text = `${statement.label} ${statement.hint}`

    if (work && permit === 'NONE') {
      // Unstated: a warning that asks someone to act, never a reassurance.
      expect(statement.id).toBe('UNSTATED')
      expect(statement.label).toBe(PERMIT_UNSTATED_LABEL)
      expect(statement.hint).toContain('Veröffentlichen')
      expect(statement.badge).toBe('chip-warning')
      expect(statement.needsAction).toBe(true)
    } else {
      expect(statement.id).toBe(permit)
      expect(statement.label).toBe(PERMIT_REQUIREMENT_LABELS[permit])
      expect(statement.needsAction).toBe(false)
    }

    // The two sentences a job must never carry, whatever is stored.
    if (work) {
      expect(statement.label).not.toBe(NO_PERMIT_CLAIM)
      expect(text).not.toMatch(UNPAID_CLAIM)
    }
  })

  it('says "unpaid, open to all" only on an unpaid kind with no permit route', () => {
    const carriers = CASES.filter(([kind, permit]) =>
      UNPAID_CLAIM.test(permitStatement(kind, permit).hint),
    )
    expect(carriers).toEqual(
      OPPORTUNITY_KINDS.filter((kind) => !isWorkKind(kind)).map((kind) => [kind, 'NONE']),
    )
  })
})

describe('the portal reads the same statement', () => {
  const t = createTranslator('de')

  it.each(CASES)('%s with %s renders the staff label in German', (kind, permit) => {
    expect(permitStatementLabel(t, kind, permit)).toBe(permitStatement(kind, permit).label)
  })
})
