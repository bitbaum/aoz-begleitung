'use client'

import { AlertTriangle, XCircle, Scale, Layers, History, Grid3X3, Database } from 'lucide-react'
import { RESIDENT_DIMENSIONS, RESIDENT_FACTORS } from '@/lib/config/resident-factors'
import {
  FACTOR_SCIENCE,
  RULE_DOCUMENTATION,
  EVIDENCE_STRENGTH_CONFIG,
  ALGORITHM_VERSIONS,
} from '@/lib/config/algorithm-docs'
import {
  getFactorsByDimension,
  getDimensionRationale,
  EvidenceStrengthBadge,
  EvidenceStrengthBar,
} from './shared'
import { formatCalendarDateLong } from '@/lib/utils/formatting'
import { TECHNICAL_TAB_LABELS } from '@/lib/constants'

export function TechnicalTab() {
  return (
    <div className="space-y-6">
      {/* Scoring Rules */}
      <section className="card">
        <h2 className="text-xl font-semibold text-ui-text mb-4 flex items-center gap-2">
          <Scale className="w-5 h-5 text-brand-primary" />
          {TECHNICAL_TAB_LABELS.scoringRulesTitle}
        </h2>

        <div className="space-y-4">
          {RULE_DOCUMENTATION.map((rule) => (
            <div key={rule.rule} className="border border-ui-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium text-ui-text">{rule.name}</h4>
                <code className="text-xs bg-ui-subtle px-2 py-0.5 rounded">{rule.rule}</code>
              </div>
              <p className="text-sm text-ui-muted mb-2">{rule.description}</p>
              <p className="text-sm text-ui-muted italic">
                {TECHNICAL_TAB_LABELS.examplePrefix} {rule.example}
              </p>
              <p className="text-xs text-ui-muted mt-2">
                {TECHNICAL_TAB_LABELS.logicPrefix} {rule.scoringLogic}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Weight Derivation */}
      <section className="card">
        <h2 className="text-xl font-semibold text-ui-text mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-brand-primary" />
          {TECHNICAL_TAB_LABELS.weightDerivationTitle}
        </h2>

        <p className="text-ui-muted mb-4">{TECHNICAL_TAB_LABELS.weightDerivationDesc}</p>

        {/* Mobile: stacked cards; Desktop: table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ui-border">
                <th scope="col" className="text-left py-2 pr-3 font-medium text-ui-muted">
                  {TECHNICAL_TAB_LABELS.colDimension}
                </th>
                <th scope="col" className="text-left py-2 pr-3 font-medium text-ui-muted">
                  {TECHNICAL_TAB_LABELS.colWeight}
                </th>
                <th scope="col" className="text-left py-2 font-medium text-ui-muted">
                  {TECHNICAL_TAB_LABELS.colRationale}
                </th>
              </tr>
            </thead>
            <tbody>
              {RESIDENT_DIMENSIONS.map((dim) => {
                const factors = getFactorsByDimension(dim.id)
                const strongCount = factors.filter(
                  (f) => FACTOR_SCIENCE[f.id]?.evidenceStrength === 'strong',
                ).length
                return (
                  <tr key={dim.id} className="border-b border-ui-border">
                    <td className="py-3 pr-3 font-medium text-ui-text">{dim.label}</td>
                    <td className="py-3 pr-3">
                      <span className="font-bold text-ui-muted">
                        {Math.round(dim.weight * 100)}%
                      </span>
                    </td>
                    <td className="py-3 text-ui-muted">
                      {getDimensionRationale(dim.id, factors.length, strongCount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {RESIDENT_DIMENSIONS.map((dim) => {
            const factors = getFactorsByDimension(dim.id)
            const strongCount = factors.filter(
              (f) => FACTOR_SCIENCE[f.id]?.evidenceStrength === 'strong',
            ).length
            return (
              <div key={dim.id} className="border border-ui-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-ui-text">{dim.label}</span>
                  <span className="font-bold text-ui-muted">{Math.round(dim.weight * 100)}%</span>
                </div>
                <p className="text-sm text-ui-muted">
                  {getDimensionRationale(dim.id, factors.length, strongCount)}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Blocking */}
      <section className="card">
        <h2 className="text-xl font-semibold text-ui-text mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-status-error-text" />
          {TECHNICAL_TAB_LABELS.blockingTitle}
        </h2>

        <p className="text-ui-muted mb-4">
          {TECHNICAL_TAB_LABELS.blockingDescPrefix}{' '}
          <strong>{TECHNICAL_TAB_LABELS.blockingDescBold}</strong>:
        </p>

        <div className="bg-status-error/8 border border-status-error/25 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-status-error mt-0.5 shrink-0" />
            <div>
              <span className="font-medium text-status-error-text">
                {TECHNICAL_TAB_LABELS.hardRequirementsLabel}
              </span>{' '}
              <span className="text-status-error-text">
                {TECHNICAL_TAB_LABELS.hardRequirementsDesc}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-status-error mt-0.5 shrink-0" />
            <div>
              <span className="font-medium text-status-error-text">
                {TECHNICAL_TAB_LABELS.extremeDifferencesLabel}
              </span>{' '}
              <span className="text-status-error-text">
                {TECHNICAL_TAB_LABELS.extremeDifferencesDesc}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-status-error mt-0.5 shrink-0" />
            <div>
              <span className="font-medium text-status-error-text">
                {TECHNICAL_TAB_LABELS.incompatibleBehaviorLabel}
              </span>{' '}
              <span className="text-status-error-text">
                {TECHNICAL_TAB_LABELS.incompatibleBehaviorDesc}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Confidence Matrix */}
      <section className="card">
        <h2 className="text-xl font-semibold text-ui-text mb-4 flex items-center gap-2">
          <Grid3X3 className="w-5 h-5 text-brand-primary" />
          {TECHNICAL_TAB_LABELS.confidenceMatrixTitle}
        </h2>

        <p className="text-ui-muted mb-4">{TECHNICAL_TAB_LABELS.confidenceMatrixDesc}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(FACTOR_SCIENCE).map(([factorId, science]) => {
            const factor = RESIDENT_FACTORS[factorId]
            if (!factor) return null
            const config = EVIDENCE_STRENGTH_CONFIG[science.evidenceStrength]
            const colorClasses: Record<string, string> = {
              green: 'border-status-success/30 bg-status-success/8',
              yellow: 'border-status-warning/30 bg-status-warning/8',
              gray: 'border-ui-border-strong bg-ui-subtle',
            }
            return (
              <div key={factorId} className={`border rounded-lg p-3 ${colorClasses[config.color]}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ui-text truncate">{factor.label}</span>
                  <EvidenceStrengthBadge strength={science.evidenceStrength} />
                </div>
                <div className="mt-1.5">
                  <EvidenceStrengthBar strength={science.evidenceStrength} />
                </div>
                <p className="text-xs text-ui-muted mt-1">
                  {Math.round(factor.weight * 100)}
                  {TECHNICAL_TAB_LABELS.weightSuffix}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Algorithm Version History */}
      <section className="card">
        <h2 className="text-xl font-semibold text-ui-text mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-brand-primary" />
          {TECHNICAL_TAB_LABELS.versionHistoryTitle}
        </h2>

        <div className="space-y-6">
          {ALGORITHM_VERSIONS.map((version, versionIndex) => (
            <div key={version.version} className="relative">
              {/* Timeline connector */}
              {versionIndex < ALGORITHM_VERSIONS.length - 1 && (
                <div className="absolute top-10 left-4 w-0.5 h-full bg-ui-border -z-10" />
              )}

              <div className="flex items-start gap-4">
                {/* Version badge */}
                <div
                  className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold ${
                    versionIndex === 0
                      ? 'bg-brand-primary text-ui-on-accent'
                      : 'bg-ui-border text-ui-muted'
                  }`}
                >
                  {version.version}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h4 className="font-semibold text-ui-text">
                      {TECHNICAL_TAB_LABELS.versionPrefix} {version.version}
                    </h4>
                    <span className="text-xs text-ui-muted">
                      {formatCalendarDateLong(version.date)}
                    </span>
                    {versionIndex === 0 && (
                      <span className="chip bg-brand-primary/10 text-brand-primary">
                        {TECHNICAL_TAB_LABELS.currentBadge}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1">
                    {version.changes.map((change, i) => (
                      <li key={i} className="text-sm text-ui-muted flex items-start gap-2">
                        <span className="text-ui-muted mt-0.5 shrink-0">-</span>
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Config Location */}
      <section className="card bg-ui-subtle">
        <h3 className="font-semibold text-ui-text mb-3 flex items-center gap-2">
          <Database className="w-5 h-5 text-ui-muted" />
          {TECHNICAL_TAB_LABELS.configTitle}
        </h3>
        <p className="text-sm text-ui-muted mb-3">{TECHNICAL_TAB_LABELS.configDesc}</p>
        <div className="font-mono text-xs text-ui-muted space-y-1">
          <p>{TECHNICAL_TAB_LABELS.configFile1}</p>
          <p>{TECHNICAL_TAB_LABELS.configFile2}</p>
          <p>{TECHNICAL_TAB_LABELS.configFile3}</p>
        </div>
      </section>
    </div>
  )
}
