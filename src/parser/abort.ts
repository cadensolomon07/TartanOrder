/**
 * Settles with `promise`, or rejects with `signal.reason` as soon as `signal` aborts —
 * even if the underlying operation ignores the signal. Shared by the browser client and
 * the server route so both deadlines behave identically.
 */
export function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}
