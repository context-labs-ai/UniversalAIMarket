import { isAuthRequired } from "@/lib/agentAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = process.env.MARKET_PUBLIC_BASE_URL?.trim() || url.origin;

  return Response.json({
    name: "Universal AI Market",
    kind: "agent_friendly_market",
    version: "0.1.0",
    origin,
    auth: {
      required: isAuthRequired(),
      scheme: "eip191_challenge",
      challengeEndpoint: new URL("/api/auth/challenge", origin).toString(),
      verifyEndpoint: new URL("/api/auth/verify", origin).toString(),
    },
    endpoints: {
      config: new URL("/api/config", origin).toString(),
      tools: new URL("/api/agent/tool", origin).toString(),
      settlementStream: new URL("/api/settle/stream", origin).toString(),
    },
    toolProtocol: {
      request: { name: "string", args: "object" },
      response: { ok: "boolean", result: "any", error: "string" },
    },
    notes: [
      "This is a hackathon MVP discovery document.",
      "Use challenge + signature to prove agent identity, then call tools to browse/prepare/settle.",
    ],
  });
}

