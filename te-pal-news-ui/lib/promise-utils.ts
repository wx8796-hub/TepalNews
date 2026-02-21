/**
 * Race a promise against a timeout. Rejects with a plain object (no stack)
 * if the promise does not settle within `ms` milliseconds.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject({ message: `${label} timeout (${ms}ms)` }),
        ms
      )
    ),
  ])
}
