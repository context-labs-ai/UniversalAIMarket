import { resolveConfirm } from "@/lib/agentSessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return new Response("Invalid body", { status: 400 });
  }

  const obj = body as Record<string, unknown>;
  const sessionId = typeof obj.sessionId === "string" ? obj.sessionId : "";
  const action = typeof obj.action === "string" ? obj.action : "";
  const upstream = typeof obj.upstream === "string" ? obj.upstream : "";

  if (!sessionId) return new Response("Missing sessionId", { status: 400 });

  // If an upstream Agent endpoint is provided, proxy the action to that service.
  // This keeps the browser request same-origin (no CORS) while still supporting external agent servers.
  if (upstream) {
    let upstreamUrl: URL;
    try {
      upstreamUrl = new URL(upstream);
    } catch {
      return new Response("Invalid upstream", { status: 400 });
    }

    upstreamUrl.search = "";
    upstreamUrl.pathname = "/api/agent/action";

    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action }),
      signal: req.signal,
    });

    const contentType = res.headers.get("content-type") || "application/json; charset=utf-8";
    const payload = await res.text();
    return new Response(payload, { status: res.status, headers: { "Content-Type": contentType } });
  }

  if (action === "confirm_settlement") {
    const ok = resolveConfirm(sessionId);
    return Response.json({ ok });
  }

  return new Response("Unknown action", { status: 400 });
}
