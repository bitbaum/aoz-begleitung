'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './Button'

type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'aoz-theme'

const modes: ThemeMode[] = ['system', 'light', 'dark']

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.dataset.theme = mode
  }
}

/** The button's accessible name for each CURRENT mode. */
export type ThemeToggleLabels = Record<ThemeMode, string>

const GERMAN_LABELS: ThemeToggleLabels = {
  system: 'Systemdesign wechseln',
  light: 'Helles Design wechseln',
  dark: 'Dunkles Design wechseln',
}

/**
 * `labels` lets a page in another language name the button in that language;
 * the staff side and the portal chrome are German and pass nothing.
 */
export function ThemeToggle({
  className = '',
  labels = GERMAN_LABELS,
}: {
  className?: string
  labels?: ThemeToggleLabels
}) {
  const [mode, setMode] = useState<ThemeMode>('system')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    const initial = stored && modes.includes(stored) ? stored : 'system'
    setMode(initial)
    applyTheme(initial)
  }, [])

  const nextMode = () => {
    const next = modes[(modes.indexOf(mode) + 1) % modes.length]
    setMode(next)
    window.localStorage.setItem(STORAGE_KEY, next)
    applyTheme(next)
  }

  const Icon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor
  const label = labels[mode]

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={nextMode}
      className={className}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Button>
  )
}
