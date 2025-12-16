import { ethers } from "ethers";

type ToolCallResult = { ok: boolean; result?: unknown; error?: string };

type AuthChallengeResponse = {
  ok: boolean;
  agentId?: string;
  agentAddress?: string;
  nonce?: string;
  expiresAt?: number;
  messageToSign?: string;
  error?: string;
};

type AuthVerifyResponse = {
  ok: boolean;
  token?: string;
  expiresAt?: number;
  scopes?: string[];
  error?: string;
};

type TokenCacheEntry = { token: string; expiresAt: number };
const tokenCache = new Map<string, TokenCacheEntry>(); // marketBaseUrl -> token

function isPresent(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getCachedToken(marketBaseUrl: string) {
  const cached = tokenCache.get(marketBaseUrl);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt - 10_000) {
    tokenCache.delete(marketBaseUrl);
    return null;
  }
  return cached.token;
}

async function fetchJson<T>(url: URL, init: RequestInit): Promise<{ res: Response; json: T | null }> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => null)) as T | null;
  return { res, json };
}

export class MarketClient {
  readonly baseUrl: string;
  readonly agentId: string;
  readonly agentPrivateKey?: string;

  constructor(opts: { baseUrl: string; agentId?: string; agentPrivateKey?: string }) {
    this.baseUrl = opts.baseUrl;
    this.agentId = isPresent(opts.agentId) ? opts.agentId : "demo-agent";
    this.agentPrivateKey = isPresent(opts.agentPrivateKey) ? opts.agentPrivateKey : undefined;
  }

  async discover() {
    const res = await fetch(new URL("/.well-known/universal-ai-market.json", this.baseUrl), { cache: "no-store" });
    if (!res.ok) throw new Error(`Discovery error: HTTP ${res.status}`);
    return res.json();
  }

  async getConfig() {
    const res = await fetch(new URL("/api/config", this.baseUrl), { cache: "no-store" });
    if (!res.ok) throw new Error(`Config error: HTTP ${res.status}`);
    return res.json();
  }

  async getTools() {
    const res = await fetch(new URL("/api/agent/tool", this.baseUrl), { cache: "no-store" });
    if (!res.ok) throw new Error(`Tools error: HTTP ${res.status}`);
    return res.json();
  }

  private async login(): Promise<string> {
    if (!this.agentPrivateKey) {
      throw new Error("Market requires auth. Set AGENT_PRIVATE_KEY in apps/agent/.env");
    }

    const wallet = new ethers.Wallet(this.agentPrivateKey);
    const agentAddress = wallet.address;

    const challengeUrl = new URL("/api/auth/challenge", this.baseUrl);
    const { res: cRes, json: cJson } = await fetchJson<AuthChallengeResponse>(challengeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: this.agentId, agentAddress }),
    });
    if (!cRes.ok || !cJson?.ok || !cJson.nonce || !cJson.messageToSign) {
      throw new Error(cJson?.error || `Auth challenge failed: HTTP ${cRes.status}`);
    }

    const signature = await wallet.signMessage(cJson.messageToSign);

    const verifyUrl = new URL("/api/auth/verify", this.baseUrl);
    const { res: vRes, json: vJson } = await fetchJson<AuthVerifyResponse>(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: this.agentId,
        agentAddress,
        nonce: cJson.nonce,
        signature,
      }),
    });

    if (!vRes.ok || !vJson?.ok || !vJson.token || !vJson.expiresAt) {
      throw new Error(vJson?.error || `Auth verify failed: HTTP ${vRes.status}`);
    }

    tokenCache.set(this.baseUrl, { token: vJson.token, expiresAt: vJson.expiresAt });
    return vJson.token;
  }

  private async getTokenOrNull() {
    return getCachedToken(this.baseUrl);
  }

  private async getTokenOrLogin() {
    const cached = await this.getTokenOrNull();
    if (cached) return cached;
    return this.login();
  }

  async callTool(name: string, args: unknown) {
    const firstToken = await this.getTokenOrNull();
    const first = await this.callToolOnce(name, args, firstToken);
    if (first.res.status !== 401) return first;

    const token = await this.getTokenOrLogin();
    return this.callToolOnce(name, args, token);
  }

  private async callToolOnce(name: string, args: unknown, token: string | null) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(new URL("/api/agent/tool", this.baseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify({ name, args }),
    });
    const json = (await res.json().catch(() => null)) as ToolCallResult | null;
    return { res, json };
  }

  async invokeTool(name: string, args: unknown) {
    const { res, json } = await this.callTool(name, args);
    if (!res.ok || !json?.ok) throw new Error(json?.error || `Tool ${name} failed`);
    return json.result;
  }

  async fetchSettlementStream(streamUrl: string, signal?: AbortSignal) {
    const url = new URL(streamUrl, this.baseUrl);

    const firstToken = await this.getTokenOrNull();
    const first = await fetch(url, {
      cache: "no-store",
      signal,
      headers: firstToken ? { Accept: "text/event-stream", Authorization: `Bearer ${firstToken}` } : { Accept: "text/event-stream" },
    });
    if (first.status !== 401) return first;

    const token = await this.getTokenOrLogin();
    return fetch(url, {
      cache: "no-store",
      signal,
      headers: { Accept: "text/event-stream", Authorization: `Bearer ${token}` },
    });
  }
}

