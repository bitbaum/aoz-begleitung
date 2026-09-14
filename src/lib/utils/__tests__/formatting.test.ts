import {
  formatDate,
  formatDateNumeric,
  formatDateISOCell,
  formatDateTime,
  formatRelativeDate,
  getDateDaysAgo,
  getScoreLevel,
  getScoreLabel,
  getScoreColorClass,
  getScoreBgClass,
  getScoreBadgeClass,
  getHarmonyStatus,
  getHarmonyColorClass,
  getSeverityBorderClass,
  getSeverityDotClass,
  getSeverityBgClass,
  getSeverityRadioClass,
  getOccupancyColorClass,
  getStatusBadgeClass,
  getHealthLevel,
  getHealthColorClass,
  getTrendColorClass,
  getConflictIndicatorClass,
} from '../formatting'

// =============================================================================
// Date formatting
// =============================================================================

describe('formatDate', () => {
  it('formats Date object', () => {
    const result = formatDate(new Date('2024-06-15'))
    expect(typeof result).toBe('string')
    expect(result).toContain('2024')
  })

  it('formats date string', () => {
    const result = formatDate('2024-06-15')
    expect(typeof result).toBe('string')
  })
})

describe('formatDateNumeric', () => {
  // Pinned literally: this one export replaced six local copies (emails,
  // governance, opportunities), two of which used Intl's `dateStyle: 'medium'`
  // and four the explicit 2-digit options. Both produce dd.MM.yyyy for
  // de-CH, and a call site must print exactly what it printed before.
  it('zero-pads day and month', () => {
    expect(formatDateNumeric(new Date(2026, 0, 5))).toBe('05.01.2026')
    expect(formatDateNumeric(new Date(2026, 11, 31))).toBe('31.12.2026')
  })

  it('matches the Intl medium style the deleted copies used', () => {
    const d = new Date(2025, 9, 1)
    expect(formatDateNumeric(d)).toBe(
      new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium' }).format(d),
    )
  })
})

describe('formatDateISOCell', () => {
  it('formats a Date or a date string, and empties anything else', () => {
    expect(formatDateISOCell(new Date('2026-05-27T10:00:00Z'))).toBe('2026-05-27')
    expect(formatDateISOCell('2026-05-27T10:00:00Z')).toBe('2026-05-27')
    expect(formatDateISOCell('')).toBe('')
    expect(formatDateISOCell(null)).toBe('')
    expect(formatDateISOCell(undefined)).toBe('')
    expect(formatDateISOCell(42)).toBe('')
  })
})

describe('formatDateTime', () => {
  it('includes time in output', () => {
    const result = formatDateTime(new Date('2024-06-15T14:30:00'))
    expect(typeof result).toBe('string')
    // Should contain date part
    expect(result).toContain('2024')
  })
})

describe('formatRelativeDate', () => {
  it('returns "Heute" for today', () => {
    expect(formatRelativeDate(new Date())).toBe('Heute')
  })

  it('returns "Gestern" for yesterday', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(formatRelativeDate(yesterday)).toBe('Gestern')
  })

  it('returns "Vor X Tagen" for recent dates', () => {
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    expect(formatRelativeDate(threeDaysAgo)).toBe('Vor 3 Tagen')
  })

  it('returns "Vor X Wochen" for dates within a month', () => {
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    expect(formatRelativeDate(twoWeeksAgo)).toBe('Vor 2 Wochen')
  })

  it('returns formatted date for old dates', () => {
    const oldDate = new Date('2023-01-15')
    const result = formatRelativeDate(oldDate)
    expect(result).toContain('2023')
  })
})

describe('getDateDaysAgo', () => {
  it('returns a date in the past', () => {
    const result = getDateDaysAgo(30)
    const now = new Date()
    expect(result.getTime()).toBeLessThan(now.getTime())
  })

  it('returns approximately N days ago', () => {
    const result = getDateDaysAgo(7)
    const now = new Date()
    const diffDays = Math.round((now.getTime() - result.getTime()) / (1000 * 60 * 60 * 24))
    expect(diffDays).toBe(7)
  })
})

// =============================================================================
// Score formatting
// =============================================================================

describe('getScoreLevel', () => {
  it('returns excellent for >= 80', () => {
    expect(getScoreLevel(80)).toBe('excellent')
    expect(getScoreLevel(100)).toBe('excellent')
  })

  it('returns good for >= 60', () => {
    expect(getScoreLevel(60)).toBe('good')
    expect(getScoreLevel(79)).toBe('good')
  })

  it('returns moderate for >= 40', () => {
    expect(getScoreLevel(40)).toBe('moderate')
    expect(getScoreLevel(59)).toBe('moderate')
  })

  it('returns low for >= 20', () => {
    expect(getScoreLevel(20)).toBe('low')
    expect(getScoreLevel(39)).toBe('low')
  })

  it('returns critical for < 20', () => {
    expect(getScoreLevel(0)).toBe('critical')
    expect(getScoreLevel(19)).toBe('critical')
  })
})

describe('getScoreLabel', () => {
  it('returns German labels', () => {
    expect(getScoreLabel(90)).toBe('Sehr gut')
    expect(getScoreLabel(70)).toBe('Gut')
    expect(getScoreLabel(50)).toBe('Mittel')
    expect(getScoreLabel(30)).toBe('Niedrig')
    expect(getScoreLabel(10)).toBe('Kritisch')
  })
})

describe('getScoreColorClass', () => {
  it('returns correct Tailwind classes', () => {
    expect(getScoreColorClass(90)).toContain('text-score-excellent-text')
    expect(getScoreColorClass(10)).toContain('text-score-critical-text')
  })
})

describe('getScoreBgClass', () => {
  it('returns background classes', () => {
    expect(getScoreBgClass(90)).toContain('bg-score-excellent')
    expect(getScoreBgClass(10)).toContain('bg-score-critical')
  })
})

describe('getScoreBadgeClass', () => {
  it('returns badge classes', () => {
    expect(getScoreBadgeClass(90)).toContain('bg-score-excellent')
    expect(getScoreBadgeClass(10)).toContain('bg-score-critical')
  })
})

// =============================================================================
// Harmony status
// =============================================================================

describe('getHarmonyStatus', () => {
  it('returns excellent for high compatibility + low conflicts', () => {
    expect(getHarmonyStatus(90, 0)).toBe('excellent')
  })

  it('penalizes for conflicts', () => {
    // 90 - 3*10 = 60 → good
    expect(getHarmonyStatus(90, 3)).toBe('good')
  })

  it('returns critical for low compatibility + many conflicts', () => {
    expect(getHarmonyStatus(20, 3)).toBe('critical')
  })
})

describe('getHarmonyColorClass', () => {
  it('returns correct classes for each level', () => {
    expect(getHarmonyColorClass('excellent')).toContain('score-excellent')
    expect(getHarmonyColorClass('critical')).toContain('score-critical')
  })
})

// =============================================================================
// Severity colors
// =============================================================================

describe('getSeverityBorderClass', () => {
  it('maps severity levels', () => {
    expect(getSeverityBorderClass('LOW')).toContain('severity-low')
    expect(getSeverityBorderClass('CRITICAL')).toContain('severity-critical')
  })

  it('defaults to LOW for unknown severity', () => {
    expect(getSeverityBorderClass('UNKNOWN')).toContain('severity-low')
  })
})

describe('getSeverityDotClass', () => {
  it('maps severity levels', () => {
    expect(getSeverityDotClass('HIGH')).toContain('severity-high')
    expect(getSeverityDotClass('MEDIUM')).toContain('severity-medium')
  })
})

describe('getSeverityBgClass', () => {
  it('maps severity levels to bg classes', () => {
    expect(getSeverityBgClass('CRITICAL')).toContain('status-error')
    expect(getSeverityBgClass('LOW')).toContain('ui-subtle')
  })
})

describe('getSeverityRadioClass', () => {
  it('maps severity levels to radio styles', () => {
    expect(getSeverityRadioClass('HIGH')).toContain('score-low')
    expect(getSeverityRadioClass('CRITICAL')).toContain('status-error')
  })
})

// =============================================================================
// Occupancy colors
// =============================================================================

describe('getOccupancyColorClass', () => {
  it('returns status-error for >= 90%', () => {
    expect(getOccupancyColorClass(95)).toBe('bg-status-error')
  })

  it('returns status-warning for >= 70%', () => {
    expect(getOccupancyColorClass(75)).toBe('bg-status-warning')
  })

  it('returns status-success for < 70%', () => {
    expect(getOccupancyColorClass(50)).toBe('bg-status-success')
  })
})

// =============================================================================
// Status badges
// =============================================================================

describe('getStatusBadgeClass', () => {
  it('returns active badge for ACTIVE/AVAILABLE/PLACED', () => {
    expect(getStatusBadgeClass('ACTIVE')).toBe('badge-active')
    expect(getStatusBadgeClass('AVAILABLE')).toBe('badge-active')
    expect(getStatusBadgeClass('PLACED')).toBe('badge-active')
  })

  it('returns pending badge for PENDING/FULL', () => {
    expect(getStatusBadgeClass('PENDING')).toBe('badge-pending')
    expect(getStatusBadgeClass('FULL')).toBe('badge-pending')
  })

  it('returns ended badge for ENDED/CLOSED/TRANSFERRED', () => {
    expect(getStatusBadgeClass('ENDED')).toBe('badge-ended')
    expect(getStatusBadgeClass('CLOSED')).toBe('badge-ended')
    expect(getStatusBadgeClass('TRANSFERRED')).toBe('badge-ended')
  })

  it('returns alert badge for MAINTENANCE/ALERT', () => {
    expect(getStatusBadgeClass('MAINTENANCE')).toBe('badge-alert')
    expect(getStatusBadgeClass('ALERT')).toBe('badge-alert')
  })

  it('defaults to badge-ended for unknown status', () => {
    expect(getStatusBadgeClass('UNKNOWN')).toBe('badge-ended')
  })
})

// =============================================================================
// Health levels
// =============================================================================

describe('getHealthLevel', () => {
  it('returns correct levels', () => {
    expect(getHealthLevel(85)).toBe('excellent')
    expect(getHealthLevel(65)).toBe('good')
    expect(getHealthLevel(45)).toBe('moderate')
    expect(getHealthLevel(25)).toBe('critical')
  })
})

describe('getHealthColorClass', () => {
  it('returns color classes', () => {
    expect(getHealthColorClass(90)).toContain('score-excellent')
    expect(getHealthColorClass(30)).toContain('score-critical')
  })
})

// =============================================================================
// Trend colors
// =============================================================================

describe('getTrendColorClass', () => {
  it('returns green for good', () => {
    expect(getTrendColorClass('good')).toContain('status-success-text')
  })

  it('returns orange for warning', () => {
    expect(getTrendColorClass('warning')).toContain('status-warning-text')
  })

  it('returns muted color for neutral', () => {
    expect(getTrendColorClass('neutral')).toContain('ui-muted')
  })
})

// =============================================================================
// Conflict indicators
// =============================================================================

describe('getConflictIndicatorClass', () => {
  it('returns severity-critical for 3+ conflicts', () => {
    expect(getConflictIndicatorClass(3)).toBe('bg-severity-critical')
    expect(getConflictIndicatorClass(5)).toBe('bg-severity-critical')
  })

  it('returns severity-high for 2 conflicts', () => {
    expect(getConflictIndicatorClass(2)).toBe('bg-severity-high')
  })

  it('returns severity-medium for 1 conflict', () => {
    expect(getConflictIndicatorClass(1)).toBe('bg-severity-medium')
  })

  it('returns status-success for 0 conflicts', () => {
    expect(getConflictIndicatorClass(0)).toBe('bg-status-success')
  })
})
