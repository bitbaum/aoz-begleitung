/**
 * Who is still in AOZ's care.
 *
 * A resident is `ACTIVE` before a placement and `PLACED` after one; both are
 * people this product accompanies. Housing is one part of a person's
 * situation, not a gate on the others — a query that means "everyone we
 * support" and says `ACTIVE` alone silently drops everybody who has been
 * housed. That happened to the Einsatzplatz picker: placed clients could not
 * be put forward for a job. One definition, so it cannot happen per query.
 */
export const IN_CARE_RESIDENT_STATUSES = ['ACTIVE', 'PLACED'] as const
