import { createHash } from 'crypto'

/**
 * Login codes that were published and can therefore never be a credential.
 *
 * A login code is a bearer credential: typing it opens that identity's
 * session. Some codes ended up in this PUBLIC repository — seed defaults in
 * `.env.example` and the docs, demo codes, a code quoted in a comment — and
 * the documentation said which live accounts carried them, the system
 * administrator's included. Anyone who read the repository could sign in.
 *
 * Deleting the text does not help: it stays in the history. So the codes are
 * refused at every place a code is accepted as proof (login, claim, register),
 * whatever the database says. An account that carried one signs in with its
 * e-mail and password, or is issued a new code; nothing else about it changes.
 *
 * Stored as SHA-256 so this file does not publish them a second time. To burn
 * another code: `printf %s 'THE-CODE' | sha256sum`.
 */
const PUBLISHED_CODE_HASHES: ReadonlySet<string> = new Set([
  'dafa028200d749bc77501aa5d224cacb916441a3b7290892fdfda90fc3a4a55b',
  'b4a26abb7b7a60ff11849d5be446e96e2e53dbaf0cc579942f00b3cd6f16a503',
  '3811cc70398bf8aacedb34191220dbc726dc74e1452687b7caf9b6a4a608a6c6',
  '3ef72038072b4e9bb5821b51ed8d1145ae0a295f286dd96cf35eb5742f61568f',
  'efe5e3ac760bc1ee312d758038189ab2868d881420e821953350c887c3a2ee91',
])

/** True when this exact code was published and must not open anything. */
export function isPublishedCode(code: string): boolean {
  const hash = createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
  return PUBLISHED_CODE_HASHES.has(hash)
}
