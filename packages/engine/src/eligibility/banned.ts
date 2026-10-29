import { err, ok, type Result } from '../result.ts';

export interface PersonIdentity {
  readonly document?: string;
  readonly email?: string;
  readonly phone?: string;
}

export interface BannedPerson extends PersonIdentity {
  readonly reason?: string;
}

const normalizers = {
  document: (v: string) => v.trim().toUpperCase(),
  email: (v: string) => v.trim().toLowerCase(),
  phone: (v: string) => v.replace(/\D/g, ''),
} as const;

const KEYS = ['document', 'email', 'phone'] as const;

/**
 * Checks a person against a ban list by document, then email, then phone, the
 * way production does when a player is registered. Comparison ignores case and
 * surrounding whitespace, and phones are compared digit by digit.
 */
export function checkBanned(person: PersonIdentity, banned: readonly BannedPerson[]): Result<void> {
  for (const key of KEYS) {
    const raw = person[key];
    if (typeof raw !== 'string') continue;
    const value = normalizers[key](raw);
    if (value === '') continue;
    for (const entry of banned) {
      const candidate = entry[key];
      if (typeof candidate === 'string' && normalizers[key](candidate) === value) {
        return err({ code: 'PERSON_BANNED', matchedBy: key });
      }
    }
  }
  return ok(undefined);
}
