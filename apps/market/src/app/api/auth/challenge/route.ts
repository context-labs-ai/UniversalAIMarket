import { z } from "zod";
import { createChallenge } from "@/lib/agentAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  agentId: z.string().min(1).max(128),
  agentAddress: z.string().min(1).max(128),
});

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  try {
    const challenge = createChallenge({
      agentId: parsed.data.agentId,
      agentAddress: parsed.data.agentAddress,
      origin,
    });
    return Response.json({
      ok: true,
      agentId: challenge.agentId,
      agentAddress: challenge.agentAddress,
      nonce: challenge.nonce,
      expiresAt: challenge.expiresAt,
      messageToSign: challenge.messageToSign,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create challenge";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

