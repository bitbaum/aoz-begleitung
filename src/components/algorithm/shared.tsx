'use client'

import { RESIDENT_DIMENSIONS, RESIDENT_FACTORS } from '@/lib/config/resident-factors'
import {
  RESEARCH_SOURCES,
  EVIDENCE_STRENGTH_CONFIG,
  type EvidenceStrength,
} from '@/lib/config/algorithm-docs'

// =============================================================================
// Derived Constants from Config (SSOT)
// =============================================================================

export const FACTOR_COUNT = Object.values(RESIDENT_FACTORS).filter((f) => f.weight > 0).length
export const DIMENSION_COUNT = RESIDENT_DIMENSIONS.length
export const SOURCE_COUNT = RESEARCH_SOURCES.length

// =============================================================================
// Utility Functions
// =============================================================================

export function getFactorsByDimension(dimensionId: string) {
  return Object.values(RESIDENT_FACTORS)
    .filter((f) => f.dimension === dimensionId && f.weight > 0)
    .sort((a, b) => b.weight - a.weight)
}

export function getDimensionRationale(
  dimensionId: string,
  factorCount: number,
  strongEvidenceCount: number,
): string {
  const rationales: Record<string, string> = {
    lifestyle:
      "Höchstes Gewicht: Schlafrhythmus und Sauberkeit haben die stärkste experimentelle Evidenz als Konfliktauslöser (RCT-Studien, n=3'098). v2.0: erhöht von 30% auf 35%.",
    social:
      'Kommunikation (Sprache) und Privatsphäre sind durch BFH-HSLU 2024 (1\'000 Familien) als "kritisch" bestätigt. Stabile Gewichtung bei 25%.',
    practical:
      'Rauchen ist nicht-verhandelbar (Gesundheitsrecht), andere Faktoren haben geringere Konfliktevidenz. v2.0: reduziert von 25% auf 20%.',
    requirements:
      'Binäre Anforderungen (Rollstuhl, Einzelzimmer) – kein Kompromiss möglich. Blockieren statt gewichten.',
  }
  return (
    rationales[dimensionId] ||
    `${factorCount} Faktoren, davon ${strongEvidenceCount} mit starker Evidenz.`
  )
}

// =============================================================================
// Shared Components
// =============================================================================

export function EvidenceStrengthBadge({ strength }: { strength: EvidenceStrength }) {
  const config = EVIDENCE_STRENGTH_CONFIG[strength]
  const colorClasses: Record<string, string> = {
    green: 'bg-status-success/15 text-status-success-text',
    yellow: 'bg-status-warning/15 text-status-warning-text',
    gray: 'bg-ui-subtle text-ui-muted',
  }
  return <span className={`chip ${colorClasses[config.color]}`}>{config.label}</span>
}

export function EvidenceStrengthBar({ strength }: { strength: EvidenceStrength }) {
  const barWidths: Record<EvidenceStrength, string> = {
    strong: 'w-full',
    moderate: 'w-2/3',
    preliminary: 'w-1/3',
  }
  const barColors: Record<EvidenceStrength, string> = {
    strong: 'bg-status-success',
    moderate: 'bg-status-warning',
    preliminary: 'bg-ui-muted',
  }
  return (
    <div className="meter">
      <div className={`meter-fill ${barColors[strength]} ${barWidths[strength]}`} />
    </div>
  )
}

export function FactStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className="bg-ui-inverse/10 rounded-lg p-4">
      <div className="flex items-center gap-2 text-ui-inverse/70 mb-1">{icon}</div>
      <div className="text-2xl md:text-3xl font-bold">{value}</div>
      <div className="text-sm text-ui-inverse/80">{label}</div>
    </div>
  )
}

export function ProcessStep({
  number,
  title,
  description,
  icon,
}: {
  number: number
  title: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <div className="text-center">
      <div className="icon-container-lg mb-4 bg-brand-primary/10 text-brand-primary ring-0">
        {icon}
      </div>
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="avatar-sm h-6 w-6 text-2xs">{number}</span>
        <h3 className="font-semibold text-ui-text">{title}</h3>
      </div>
      <p className="text-sm text-ui-muted">{description}</p>
    </div>
  )
}

export function DimensionCard({
  name,
  weight,
  color,
  description,
  factorCount,
}: {
  name: string
  weight: number
  color: 'purple' | 'blue' | 'green' | 'orange'
  description: string
  factorCount: number
}) {
  const colorClasses = {
    purple: 'bg-brand-secondary/8 border-brand-secondary/25 text-brand-secondary',
    blue: 'bg-status-info/8 border-status-info/25 text-status-info-text',
    green: 'bg-status-success/10 border-status-success/25 text-status-success-text',
    orange: 'bg-status-warning/10 border-status-warning/25 text-status-warning-text',
  }

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl font-bold">{weight}%</span>
        <span className="text-xs opacity-70">{factorCount} Faktoren</span>
      </div>
      <h3 className="font-semibold mb-1">{name}</h3>
      <p className="text-sm opacity-80">{description}</p>
    </div>
  )
}

export function ScoreLevel({
  score,
  label,
  color,
  action,
}: {
  score: string
  label: string
  color: 'green' | 'emerald' | 'yellow' | 'orange' | 'red'
  action: string
}) {
  const colorClasses = {
    green: 'bg-score-excellent',
    emerald: 'bg-score-good',
    yellow: 'bg-score-medium',
    orange: 'bg-score-low',
    red: 'bg-score-critical',
  }

  const bgClasses = {
    green: 'bg-score-excellent/8 border-score-excellent/25',
    emerald: 'bg-score-good/8 border-score-good/25',
    yellow: 'bg-score-medium/8 border-score-medium/25',
    orange: 'bg-score-low/8 border-score-low/25',
    red: 'bg-score-critical/8 border-score-critical/25',
  }

  return (
    <div className={`rounded-lg border p-3 text-center ${bgClasses[color]}`}>
      <div className={`w-full h-2 rounded-sm ${colorClasses[color]} mb-2`} />
      <div className="font-bold text-ui-text">{score}</div>
      <div className="text-sm font-medium text-ui-muted">{label}</div>
      <div className="text-xs text-ui-muted mt-1">{action}</div>
    </div>
  )
}
