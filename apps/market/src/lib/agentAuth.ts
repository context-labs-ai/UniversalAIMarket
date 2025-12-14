import { ethers } from "ethers";

type Challenge = {
  agentId: string;
  agentAddress: string;
  nonce: string;
  expiresAt: number;
  messageToSign: string;
};

type Session = {
  token: string;
  agentId: string;
  agentAddress: string;
  expiresAt: number;
  scopes: string[];
};

const challenges = new Map<string, Challenge>(); // nonce -> challenge
const sessions = new Map<string, Session>(); // token -> session

function now() {
  return Date.now();
}

function normalizeAddress(address: string) {
  return ethers.getAddress(address);
}

export function createChallenge(opts: {
  agentId: string;
  agentAddress: string;
  origin: string;
  ttlMs?: number;
}) {
  const ttlMs = opts.ttlMs ?? 5 * 60_000;
  const nonce = crypto.randomUUID();
  const expiresAt = now() + ttlMs;
  const agentAddress = normalizeAddress(opts.agentAddress);

  const messageToSign = [
    "Universal AI Market — Agent Login",
    `origin: ${opts.origin}`,
    `agentId: ${opts.agentId}`,
    `agentAddress: ${agentAddress}`,
    `nonce: ${nonce}`,
    `expiresAt: ${expiresAt}`,
  ].join("\n");

  const challenge: Challenge = {
    agentId: opts.agentId,
    agentAddress,
    nonce,
    expiresAt,
    messageToSign,
  };

  challenges.set(nonce, challenge);
  return challenge;
}

export function verifyChallenge(opts: {
  agentId: string;
  agentAddress: string;
  nonce: string;
  signature: string;
}) {
  const challenge = challenges.get(opts.nonce);
  if (!challenge) throw new Error("Unknown nonce");
  if (now() > challenge.expiresAt) {
    challenges.delete(opts.nonce);
    throw new Error("Challenge expired");
  }

  const agentAddress = normalizeAddress(opts.agentAddress);
  if (challenge.agentId !== opts.agentId) throw new Error("agentId mismatch");
  if (challenge.agentAddress !== agentAddress) throw new Error("agentAddress mismatch");

  const recovered = ethers.verifyMessage(challenge.messageToSign, opts.signature);
  if (normalizeAddress(recovered) !== agentAddress) throw new Error("Invalid signature");

  challenges.delete(opts.nonce);
  return { agentId: challenge.agentId, agentAddress: challenge.agentAddress };
}

export function createSession(opts: { agentId: string; agentAddress: string; ttlMs?: number }) {
  const ttlMs = opts.ttlMs ?? 60 * 60_000;
  const token = crypto.randomUUID();
  const expiresAt = now() + ttlMs;
  const session: Session = {
    token,
    agentId: opts.agentId,
    agentAddress: normalizeAddress(opts.agentAddress),
    expiresAt,
    scopes: ["catalog:read", "deal:write", "settle:write", "chat:write"],
  };
  sessions.set(token, session);
  return session;
}

export function getSessionFromRequest(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  const session = sessions.get(token);
  if (!session) return null;
  if (now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function isAuthRequired() {
  return String(process.env.AGENT_AUTH_REQUIRED || "0").trim() === "1";
}

