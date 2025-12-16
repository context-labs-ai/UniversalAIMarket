import type { Response } from "express";
import { randomUUID } from "crypto";
import type { SseEventName } from "./sse.js";
import { initSse, sendSseComment } from "./sse.js";

function encodeSseEvent(event: SseEventName, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

type RunSession = {
  id: string;
  createdAt: number;
  events: string[];
  clients: Set<Response>;
  keepAliveTimers: Map<Response, NodeJS.Timeout>;
  done: boolean;
};

const sessions = new Map<string, RunSession>();

export function createRunSession() {
  const id = randomUUID();
  const session: RunSession = {
    id,
    createdAt: Date.now(),
    events: [],
    clients: new Set(),
    keepAliveTimers: new Map(),
    done: false,
  };
  sessions.set(id, session);
  return session;
}

export function getRunSession(sessionId: string) {
  return sessions.get(sessionId) ?? null;
}

export function markRunDone(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.done = true;
  for (const res of session.clients) {
    try {
      res.end();
    } catch {
      // ignore
    }
    const timer = session.keepAliveTimers.get(res);
    if (timer) clearInterval(timer);
  }
  session.clients.clear();
  session.keepAliveTimers.clear();
}

export function emitRunEvent(sessionId: string, event: SseEventName, data: unknown) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const encoded = encodeSseEvent(event, data);
  session.events.push(encoded);
  if (session.events.length > 2000) session.events.splice(0, session.events.length - 2000);

  for (const res of session.clients) {
    try {
      res.write(encoded);
    } catch {
      // ignore
    }
  }
}

export function attachRunStream(sessionId: string, res: Response) {
  const session = sessions.get(sessionId);
  if (!session) return false;

  initSse(res);
  session.clients.add(res);

  // Backlog replay
  for (const chunk of session.events) {
    res.write(chunk);
  }

  // Keepalive
  const keepAlive = setInterval(() => {
    try {
      sendSseComment(res, "keepalive");
    } catch {
      // ignore
    }
  }, 15000);
  session.keepAliveTimers.set(res, keepAlive);

  res.on("close", () => {
    session.clients.delete(res);
    const timer = session.keepAliveTimers.get(res);
    if (timer) clearInterval(timer);
    session.keepAliveTimers.delete(res);
  });

  if (session.done) {
    res.end();
  }

  return true;
}

