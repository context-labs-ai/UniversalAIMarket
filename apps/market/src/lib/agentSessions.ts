type AgentSession = {
  resolveConfirm: () => void;
};

const sessions = new Map<string, AgentSession>();

export function waitForConfirm(sessionId: string) {
  let resolveConfirm: (() => void) | null = null;
  const promise = new Promise<void>((resolve) => {
    resolveConfirm = resolve;
  });

  sessions.set(sessionId, {
    resolveConfirm: () => resolveConfirm?.(),
  });

  return promise;
}

export function resolveConfirm(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.resolveConfirm();
  return true;
}

export function clearSession(sessionId: string) {
  sessions.delete(sessionId);
}

