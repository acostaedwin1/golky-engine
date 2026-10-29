import { describeError, type EngineError } from './errors.ts';

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * The return type of every engine operation. Nothing in the engine throws:
 * failures are values, so the host application sees them in the type system.
 */
export type Result<T, E = EngineError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/** Thrown only by `unwrap`, the explicit escape hatch for scripts and tests. */
export class EngineResultError extends Error {
  readonly error: EngineError;

  constructor(error: EngineError) {
    super(`golky-engine: ${describeError(error)}`);
    this.name = 'EngineResultError';
    this.error = error;
  }
}

/** Returns the value or throws `EngineResultError`. Prefer pattern-matching on `ok`. */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw new EngineResultError(result.error);
}

/** Applies `fn` to a successful value, passing errors through untouched. */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/**
 * Runs `ops` left to right, feeding each one the previous value, and stops at the
 * first error. Lets a host write a whole flow as one expression:
 *
 *   chain(t, (t) => confirmMatch(t, id, when), (t) => recordResult(t, id, result))
 */
export function chain<T, E = EngineError>(
  initial: T,
  ...ops: ReadonlyArray<(value: T) => Result<T, E>>
): Result<T, E> {
  let current = initial;
  for (const op of ops) {
    const next = op(current);
    if (!next.ok) return next;
    current = next.value;
  }
  return ok(current);
}
