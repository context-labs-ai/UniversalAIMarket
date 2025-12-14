type Deferred = {
  resolve: () => void;
  reject: (err: Error) => void;
  promise: Promise<void>;
};

function makeDeferred(): Deferred {
  let resolve!: () => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { resolve, reject, promise };
}

const sessions = new Map<string, Deferred>();

export function ensureSession(sessionId: string) {
  if (!sessions.has(sessionId)) sessions.set(sessionId, makeDeferred());
}

export async function waitForConfirm(sessionId: string, signal?: AbortSignal) {
  ensureSession(sessionId);
  const deferred = sessions.get(sessionId)!;
  if (signal?.aborted) throw new Error("aborted");
  const onAbort = () => deferred.reject(new Error("aborted"));
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    await deferred.promise;
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

export function confirm(sessionId: string) {
  ensureSession(sessionId);
  sessions.get(sessionId)!.resolve();
  sessions.delete(sessionId);
}

export function clear(sessionId: string) {
  sessions.delete(sessionId);
}

