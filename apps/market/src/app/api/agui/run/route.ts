export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPresent(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export async function POST(req: Request) {
  const upstream =
    (isPresent(process.env.AGUI_UPSTREAM_URL) ? process.env.AGUI_UPSTREAM_URL : null) ??
    "http://localhost:8080/api/agui/run";

  const body = await req.text();
  const res = await fetch(upstream, {
    method: "POST",
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "application/json",
      Accept: "text/event-stream",
    },
    body,
    signal: req.signal,
  });

  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

