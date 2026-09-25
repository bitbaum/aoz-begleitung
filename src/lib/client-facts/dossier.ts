/**
 * A client's own admin facts, as their care team sees them on the dossier.
 *
 * ⚠️ THIS CLOSES A HOLE IN THE FEATURE IT BELONGS TO. `/approvals` queries
 * `status = 'PENDING'`, and nothing else on the staff side read these tables —
 * so the moment a Betreuerin pressed "Gesehen", the insurance disappeared from
 * every staff surface. She could never afterwards look up which insurance a
 * client has, or who their dentist is, which is the entire reason the client
 * recorded it.
 *
 * Written and then read by nobody: the exact class this feature was built to
 * end, reproduced inside it. Found by walking the product as the Jobcoach rather than
 * by reading the code.
 *
 * Visibility is the SAME per-kind rule as the queue (`mayReadFact`), applied
 * before the query rather than in the markup — a kind this viewer may not read
 * is a query never issued, so the rows never enter the payload.
 */

import { desc, eq } from 'drizzle-orm'

import { clientHealthContact, clientInsurance, clientPermit, db } from '@/lib/db'

import { mayReadFact, type FactViewer } from './policy'

export interface DossierInsurance {
  id: string
  insurerName: string
  policyNumber: string | null
  validUntil: Date | null
  status: string
  staffNote: string | null
}

export interface DossierHealthContact {
  id: string
  name: string
  profession: string
  phone: string | null
  address: string | null
  note: string | null
  status: string
}

export interface DossierPermit {
  id: string
  type: string
  validUntil: Date | null
  status: string
}

export interface ClientFactsForDossier {
  /** Null means "you may not see this kind", which is not the same as "empty". */
  insurances: DossierInsurance[] | null
  contacts: DossierHealthContact[] | null
  permit: DossierPermit | null
  /** False when the viewer may read no kind at all — render nothing. */
  anyVisible: boolean
}

/**
 * Everything this viewer may see about this client, at every status.
 *
 * Deliberately NOT filtered to CONFIRMED. A pending entry is still the client's
 * best information and is often the one staff most need — somebody who has just
 * changed insurer has entered the new one and nobody has looked at it yet. The
 * status is shown instead, so a reader knows what they are looking at.
 */
export async function clientFactsForDossier(
  residentId: string,
  viewer: FactViewer,
): Promise<ClientFactsForDossier> {
  const mayInsurance = mayReadFact('INSURANCE', viewer)
  const mayContacts = mayReadFact('HEALTH_CONTACT', viewer)
  const mayPermit = mayReadFact('PERMIT', viewer)

  const [insurances, contacts, permit] = await Promise.all([
    mayInsurance
      ? db.query.clientInsurance.findMany({
          where: eq(clientInsurance.residentId, residentId),
          columns: {
            id: true,
            insurerName: true,
            policyNumber: true,
            validUntil: true,
            status: true,
            staffNote: true,
          },
          orderBy: [desc(clientInsurance.createdAt)],
        })
      : Promise.resolve(null),
    mayContacts
      ? db.query.clientHealthContact.findMany({
          where: eq(clientHealthContact.residentId, residentId),
          columns: {
            id: true,
            name: true,
            profession: true,
            phone: true,
            address: true,
            note: true,
            status: true,
          },
          orderBy: [desc(clientHealthContact.createdAt)],
        })
      : Promise.resolve(null),
    mayPermit
      ? db.query.clientPermit.findFirst({
          where: eq(clientPermit.residentId, residentId),
          columns: { id: true, type: true, validUntil: true, status: true },
        })
      : Promise.resolve(null),
  ])

  return {
    insurances,
    contacts,
    permit: permit ?? null,
    anyVisible: mayInsurance || mayContacts || mayPermit,
  }
}
