/**
 * Loads the apartment config the real-data seed scripts need, from a file that
 * is NEVER committed.
 *
 * The repo is public. A real flat's address, its unit code and which resident
 * sleeps in which room are personal data, so they live outside git:
 *
 *   1. `REAL_APARTMENTS_FILE=/path/to/apartments.json`, or
 *   2. `scripts/db/real/apartments.local.json` (gitignored).
 *
 * `apartments.example.json` beside this file shows the shape with invented
 * values; copy it and fill in the real ones. Login codes never go in that
 * file either: they are generated at seed time and printed once.
 */

import { existsSync, readFileSync } from 'fs'
import { isAbsolute, join, relative, resolve } from 'path'

import { z } from 'zod'

import type { ApartmentsConfig } from './types'

export const DEFAULT_APARTMENTS_FILE = join(__dirname, 'apartments.local.json')
export const EXAMPLE_APARTMENTS_FILE = join(__dirname, 'apartments.example.json')

const roomSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  beds: z.number().int().positive(),
})

const residentSchema = z.object({
  displayName: z.string().min(1),
  room: z.string().min(1),
})

const unitSchema = z.object({
  code: z.string().min(1),
  address: z.string().min(1),
  totalBeds: z.number().int().nonnegative(),
  totalRooms: z.number().int().nonnegative(),
  sharedRooms: z.number().int().nonnegative(),
  privateRooms: z.number().int().nonnegative(),
  sharedBathrooms: z.number().int().nonnegative(),
  privateBathrooms: z.number().int().nonnegative(),
  sharedKitchen: z.boolean(),
  privateKitchen: z.boolean(),
})

const apartmentSchema = z
  .object({
    unit: unitSchema,
    rooms: z.array(roomSchema).min(1),
    residents: z.array(residentSchema),
  })
  .superRefine((apartment, ctx) => {
    const beds = new Map(apartment.rooms.map((room) => [room.code, room.beds]))
    for (const person of apartment.residents) {
      const left = beds.get(person.room)
      if (left === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: `${apartment.unit.code}: resident "${person.displayName}" is in unknown room "${person.room}"`,
        })
      } else if (left === 0) {
        ctx.addIssue({
          code: 'custom',
          message: `${apartment.unit.code}: room "${person.room}" has more residents than beds`,
        })
      } else {
        beds.set(person.room, left - 1)
      }
    }
  })

export const apartmentsConfigSchema = z.object({
  real: z.array(apartmentSchema).default([]),
  placeholders: z.array(apartmentSchema).default([]),
})

/** Parse a config object. Exported so the example file can be tested. */
export function parseApartmentsConfig(raw: unknown, source = 'apartment config'): ApartmentsConfig {
  const parsed = apartmentsConfigSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`${source} is not valid:\n${issues}`)
  }
  return {
    real: parsed.data.real,
    placeholders: parsed.data.placeholders.map((apartment) => ({
      ...apartment,
      placeholder: true as const,
    })),
  }
}

function configPath(): string {
  const fromEnv = process.env.REAL_APARTMENTS_FILE?.trim()
  if (!fromEnv) return DEFAULT_APARTMENTS_FILE
  return isAbsolute(fromEnv) ? fromEnv : resolve(process.cwd(), fromEnv)
}

/**
 * Read the local config, or exit with a message that says exactly where to put
 * it. A seed script has nothing useful to do without it.
 */
export function loadApartmentsConfig(): ApartmentsConfig {
  const path = configPath()
  if (!existsSync(path)) {
    const shown = relative(process.cwd(), path) || path
    const example = relative(process.cwd(), EXAMPLE_APARTMENTS_FILE)
    console.error(
      [
        `✋ No apartment config at ${shown}.`,
        '',
        'The real apartments (addresses, rooms, who lives where) are personal data and are',
        'not in this public repository. Put them in a local file:',
        '',
        `  cp ${example} scripts/db/real/apartments.local.json   # gitignored`,
        '  # then replace the invented values with the real ones',
        '',
        'or point REAL_APARTMENTS_FILE at a file kept anywhere else.',
      ].join('\n'),
    )
    process.exit(1)
  }

  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`could not read ${path} as JSON: ${(error as Error).message}`)
  }
  return parseApartmentsConfig(raw, path)
}
