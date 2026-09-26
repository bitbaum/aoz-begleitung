/**
 * Whose turn it is on a scheduled chore.
 *
 * DERIVED, NEVER STORED. The turn is a pure function of the task's rotation
 * order and how many times the task has been completed. Nothing to keep in
 * sync, so the turn can never drift from the completion log — the log stays the
 * single source of truth for what actually happened.
 *
 * WHY A ROTATION AT ALL, when an honor system already allocates these tasks
 * perfectly well: the rota's value is not allocative, it is de-escalatory. With
 * one, the demand comes from the plan rather than from your housemate. What a
 * rota actually minimises is having to ask — and asking is the expensive part,
 * because in a house nobody chose and nobody can leave, one badly-received ask
 * is what a staff mediation hour gets spent on.
 *
 * A TURN IS A DEFAULT, NOT A LOCK. Anyone may complete any task at any time;
 * doing it early is allowed and the balance credits whoever did it. Swapping is
 * a first-class move rather than a violation, because voluntary trade is how
 * you approximate envy-freeness without ever asking anyone to rank chores.
 */

/**
 * The resident whose turn it currently is, or `null` when the task has no
 * rotation (every as-needed task, and any scheduled task the house has not
 * ordered yet — an empty rotation is a legitimate "we don't do turns here").
 *
 * Completions advance the turn regardless of who performed them: if one housemate does
 * another's turn, the work is done and the rota moves on. Anything else would
 * make covering for someone cost you your own place in the queue.
 */
export function currentTurnResidentId(
  rotationResidentIds: string[],
  completionCount: number,
): string | null {
  if (rotationResidentIds.length === 0) return null

  // Negative counts cannot occur from a real query, but guard rather than
  // return a nonsense index if a caller ever passes one.
  const completed = Math.max(0, Math.trunc(completionCount))
  return rotationResidentIds[completed % rotationResidentIds.length]
}

/** Convenience for the resident-facing UI: is this my turn right now? */
export function isResidentsTurn(
  rotationResidentIds: string[],
  completionCount: number,
  residentId: string,
): boolean {
  return currentTurnResidentId(rotationResidentIds, completionCount) === residentId
}
