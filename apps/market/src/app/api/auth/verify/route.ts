import { z } from "zod";
import { createSession, verifyChallenge } from "@/lib/agentAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  agentId: z.string().min(1).max(128),
  agentAddress: z.string().min(1).max(128),
  nonce: z.string().min(1).max(128),
  signature: z.string().min(1).max(2048),
});

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  try {
    const verified = verifyChallenge(parsed.data);
    const session = createSession({ agentId: verified.agentId, agentAddress: verified.agentAddress });
    return Response.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      scopes: session.scopes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verify failed";
    return Response.json({ ok: false, error: message }, { status: 401 });
  }
}

