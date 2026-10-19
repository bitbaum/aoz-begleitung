/**
 * Shapes of the apartment config that scripts/db/seed-real.ts and
 * scripts/db/seed-placeholders.ts read.
 *
 * The VALUES are not in this repository. The repo is public, and a real flat's
 * address and who sleeps in which room are personal data. They live in a
 * gitignored local file (see ./load.ts); `apartments.example.json` beside this
 * file shows the shape with invented values.
 */

export interface RealRoomSeed {
  code: string
  label: string
  beds: number
}

export interface RealResidentSeed {
  displayName: string
  /** Room code from `rooms` this person sleeps in. */
  room: string
}

export interface RealUnitSeed {
  code: string
  address: string
  totalBeds: number
  totalRooms: number
  sharedRooms: number
  privateRooms: number
  sharedBathrooms: number
  privateBathrooms: number
  sharedKitchen: boolean
  privateKitchen: boolean
}

export interface RealApartment {
  unit: RealUnitSeed
  rooms: RealRoomSeed[]
  residents: RealResidentSeed[]
}

export interface PlaceholderApartment extends RealApartment {
  /**
   * Marks every resident as a claimable placeholder rather than a real
   * client. Drives `Resident.isPlaceholder`, which keeps these rows out of
   * every pilot KPI until a real person claims the code.
   */
  placeholder: true
}

export interface ApartmentsConfig {
  /** Flats with real people in them, seeded by seed-real.ts. */
  real: RealApartment[]
  /** Real AOZ flats seeded with claimable placeholder profiles, by seed-placeholders.ts. */
  placeholders: PlaceholderApartment[]
}
