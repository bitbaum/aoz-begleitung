/**
 * The rule book, rendered as one document rather than two lists.
 *
 * Each AOZ rule appears with whatever this house decided underneath it. That
 * nesting is the point: a resident can always see which AOZ rule a house rule
 * sits under, and which topics are still open for the house to decide. Staff
 * and residents render the same component, so they are never looking at
 * different versions of the rules.
 */

import { Card } from '@/components/ui'
import {
  RULE_CATEGORY_ICONS,
  RULE_CATEGORY_LABELS,
  RULE_DELEGATION_DESCRIPTIONS,
  RULE_DELEGATION_LABELS,
} from '@/lib/config/house-rules'
import type { RuleBook, RuleLike } from '@/lib/governance/rules'
import { BRAND } from '@/lib/config/brand'

interface RuleBookViewProps {
  ruleBook: RuleBook
  /** Rule ids this viewer has not yet confirmed reading. */
  outstandingRuleIds?: string[]
  /** Rendered under each rule — e.g. an acknowledge button or staff actions. */
  renderRuleActions?: (rule: RuleLike) => React.ReactNode
  /** Rendered under an AOZ topic the house may still legislate on. */
  renderOpenTopicAction?: (orgRule: RuleLike) => React.ReactNode
}

const DELEGATION_BADGE_CLASS: Record<string, string> = {
  FIXED: 'bg-status-error/10 text-status-error-text',
  UNIT_MAY_STRENGTHEN: 'bg-status-warning/15 text-status-warning-text',
  UNIT_DECIDES: 'bg-status-success/15 text-status-success-text',
}

export function RuleBookView({
  ruleBook,
  outstandingRuleIds = [],
  renderRuleActions,
  renderOpenTopicAction,
}: RuleBookViewProps) {
  const outstanding = new Set(outstandingRuleIds)

  return (
    <div className="space-y-8">
      {ruleBook.sections.map((section) => (
        <section key={section.category} aria-labelledby={`rules-${section.category}`}>
          <h2
            id={`rules-${section.category}`}
            className="mb-3 flex items-center gap-2 text-lg font-semibold text-ui-text"
          >
            <span aria-hidden="true">{RULE_CATEGORY_ICONS[section.category]}</span>
            {RULE_CATEGORY_LABELS[section.category]}
          </h2>

          <div className="space-y-4">
            {section.entries.map((entry) => (
              <Card key={entry.orgRule.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-ui-text">{entry.orgRule.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-ui-muted">{entry.orgRule.body}</p>
                  </div>
                  <span
                    className={`badge shrink-0 ${DELEGATION_BADGE_CLASS[entry.orgRule.delegation]}`}
                    title={RULE_DELEGATION_DESCRIPTIONS[entry.orgRule.delegation]}
                  >
                    {RULE_DELEGATION_LABELS[entry.orgRule.delegation]}
                  </span>
                </div>

                {outstanding.has(entry.orgRule.id) && <UnreadMarker />}
                {renderRuleActions?.(entry.orgRule)}

                {entry.unitRules.length > 0 && (
                  <ul className="mt-4 space-y-3 border-l-2 border-brand-primary/30 pl-4">
                    {entry.unitRules.map((rule) => (
                      <li key={rule.id}>
                        <p className="text-sm font-medium text-ui-text">
                          {rule.title}
                          <span className="ml-2 badge bg-brand-primary/10 text-brand-primary">
                            Hausregel
                          </span>
                        </p>
                        <p className="mt-1 text-sm leading-6 text-ui-muted">{rule.body}</p>
                        {outstanding.has(rule.id) && <UnreadMarker />}
                        {renderRuleActions?.(rule)}
                      </li>
                    ))}
                  </ul>
                )}

                {entry.houseMayDecide && entry.unitRules.length === 0 && (
                  <div className="mt-4 rounded-md bg-ui-subtle p-3">
                    <p className="text-sm text-ui-muted">
                      {entry.orgRule.delegation === 'UNIT_DECIDES'
                        ? 'Dieses Thema ist noch offen — das Haus kann selbst festlegen, wie es hier gilt.'
                        : 'Das Haus kann hier eine strengere Regel beschliessen.'}
                    </p>
                    {renderOpenTopicAction?.(entry.orgRule)}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>
      ))}

      {ruleBook.orphanedUnitRules.length > 0 && (
        <section aria-labelledby="rules-orphaned">
          {/* Surfaced rather than hidden: people are still being held to these,
              so they must remain readable even though their AOZ topic is gone. */}
          <h2 id="rules-orphaned" className="mb-3 text-lg font-semibold text-ui-text">
            Weitere Hausregeln
          </h2>
          <Card>
            <p className="mb-3 text-sm text-ui-muted">
              Diese Hausregeln gehören zu einem {BRAND.orgName}-Thema, das nicht mehr gültig ist.
              Die Betreuung sollte sie überprüfen.
            </p>
            <ul className="space-y-3">
              {ruleBook.orphanedUnitRules.map((rule) => (
                <li key={rule.id}>
                  <p className="text-sm font-medium text-ui-text">{rule.title}</p>
                  <p className="mt-1 text-sm leading-6 text-ui-muted">{rule.body}</p>
                  {renderRuleActions?.(rule)}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {ruleBook.sections.length === 0 && (
        <Card>
          <p className="text-sm text-ui-muted">
            Es sind noch keine Regeln erfasst. Die Betreuung kann den {BRAND.orgName}-Regelkatalog
            laden.
          </p>
        </Card>
      )}
    </div>
  )
}

function UnreadMarker() {
  return (
    <p className="mt-2 text-sm font-medium text-status-warning-text">
      Neu für Sie — bitte lesen und bestätigen
    </p>
  )
}
