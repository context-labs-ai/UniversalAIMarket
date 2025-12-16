import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

function isPresent(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type RunBody = {
  mode?: "simulate" | "testnet";
  checkoutMode?: "auto" | "confirm";
  scenario?: "single" | "multi";
  goal?: string;
  buyerNote?: string;
};

type SseEvent = { event: string; data: string };

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const val = argv[i + 1];
    if (val && !val.startsWith("--")) {
      out[key] = val;
      i++;
    } else {
      out[key] = "true";
    }
  }
  return out;
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const json = await res.json().catch(() => null);
  if (!json || typeof json !== "object") throw new Error("Invalid JSON response");
  return json as Record<string, unknown>;
}

async function readSse(
  url: string,
  onEvent: (evt: SseEvent) => Promise<void> | void
) {
  const res = await fetch(url, { headers: { Accept: "text/event-stream" } });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`SSE HTTP ${res.status}: ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const idx = buffer.indexOf("\n\n");
      if (idx === -1) break;
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const lines = chunk.split("\n").map((l) => l.replace(/\r$/, ""));
      let event = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice("event:".length).trim();
        if (line.startsWith("data:")) data += line.slice("data:".length).trim();
      }
      if (data) await onEvent({ event, data });
    }
  }
}

function extractPriceUSDC(text: string): string | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*USDC/i);
  return m ? m[1] : null;
}

async function run() {
  const [cmd] = process.argv.slice(2);
  const args = parseArgs(process.argv.slice(3));

  if (cmd !== "run" && cmd !== "chat") {
    // eslint-disable-next-line no-console
    console.log(
      [
        "Usage:",
        "  pnpm -C apps/agent cli run  --goal \"...\" --mode simulate --checkout confirm --scenario multi --hub http://localhost:8080",
        "  pnpm -C apps/agent cli chat --mode simulate --checkout confirm --scenario multi --hub http://localhost:8080",
        "",
        "Options:",
        "  --hub        Hub base URL (default: http://localhost:8080)",
        "  --goal       Shopping goal text",
        "  --buyerNote  Extra buyer note",
        "  --mode       simulate | testnet (default: simulate)",
        "  --checkout   confirm | auto (default: confirm)",
        "  --scenario   single | multi (default: multi)",
      ].join("\n")
    );
    process.exitCode = 1;
    return;
  }

  const hub = isPresent(args.hub) ? args.hub : "http://localhost:8080";
  const mode = args.mode === "testnet" ? "testnet" : "simulate";
  const checkoutMode = args.checkout === "auto" ? "auto" : "confirm";
  const scenario = args.scenario === "single" ? "single" : "multi";
  const goal = isPresent(args.goal) ? args.goal : "帮我在这个 AI 电商里找一个 100 USDC 以内的酷炫商品并购买。";
  const buyerNote = isPresent(args.buyerNote) ? args.buyerNote : "";

  const body: RunBody = { mode, checkoutMode, scenario, goal, buyerNote };

  const hubBase = hub.replace(/\/$/, "");

  const startRun = async (override: Partial<RunBody>) => {
    const started = await fetchJson(`${hubBase}/api/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, ...override }),
    });
    const sessionId = typeof started.sessionId === "string" ? started.sessionId : "";
    if (!sessionId) throw new Error("Missing sessionId");
    return sessionId;
  };

  const watchRunToDone = async (sessionId: string) => {
    let finalPriceUSDC: string | null = null;
    let dealPriceUSDC: string | null = null;
    let awaitingConfirm = false;
    let sawTerminalEvent = false;

    await readSse(`${hubBase}/api/agent/stream?sessionId=${encodeURIComponent(sessionId)}`, async ({ event, data }) => {
      if (event === "timeline_step") {
        try {
          const step = JSON.parse(data) as { id?: string; status?: string; detail?: string };
          if (step?.id === "negotiate" && step?.status === "done" && typeof step.detail === "string") {
            const p = extractPriceUSDC(step.detail);
            if (p) finalPriceUSDC = p;
          }
        } catch {
          // ignore
        }
        return;
      }

      if (event === "error") {
        sawTerminalEvent = true;
        try {
          const err = JSON.parse(data) as { message?: string };
          // eslint-disable-next-line no-console
          console.log(`[error] ${err?.message ?? data}`);
        } catch {
          // eslint-disable-next-line no-console
          console.log(`[error] ${data}`);
        }
        return;
      }

      if (event === "state") {
        try {
          const st = JSON.parse(data) as { awaitingConfirm?: boolean; deal?: any };
          awaitingConfirm = Boolean(st.awaitingConfirm);
          if (st.deal && typeof st.deal === "object") {
            const priceRaw = (st.deal as any).price;
            if (typeof priceRaw === "string") {
              // price is micro USDC string, convert to display if looks numeric
              const n = Number(priceRaw);
              if (Number.isFinite(n)) dealPriceUSDC = (n / 1e6).toFixed(2).replace(/\.00$/, "");
            }
          }
        } catch {
          // ignore
        }

        if (awaitingConfirm) {
          const rl = createInterface({ input, output });
          const ans = "";
          try {
            const a = (await rl.question("需要确认结算吗？(y/N) ")).trim().toLowerCase();
            if (a === "y" || a === "yes") {
              await fetchJson(`${hubBase}/api/agent/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, action: "confirm_settlement" }),
              });
              // eslint-disable-next-line no-console
              console.log("[cli] 已确认，继续结算…");
            } else {
              // eslint-disable-next-line no-console
              console.log("[cli] 未确认，Agent 将继续等待（你可以稍后再次运行并确认）。");
            }
          } finally {
            rl.close();
          }
        }
        return;
      }

      if (event === "done") {
        sawTerminalEvent = true;
        // eslint-disable-next-line no-console
        console.log(
          `[result] 成交价：${dealPriceUSDC ?? finalPriceUSDC ?? "未知"} USDC（sessionId=${sessionId}）`
        );
        return;
      }
    });

    if (!sawTerminalEvent) {
      // eslint-disable-next-line no-console
      console.log(`[warn] session 已结束但未收到 done/error（sessionId=${sessionId}）`);
    }
  };

  if (cmd === "run") {
    const sessionId = await startRun({});
    // eslint-disable-next-line no-console
    console.log(`[hub] started session: ${sessionId}`);
    // eslint-disable-next-line no-console
    console.log("Open the market UI and watch this session:");
    // eslint-disable-next-line no-console
    console.log(`- Market: http://localhost:3001 (Agent sidebar -> Session ID -> 观看)`);
    // eslint-disable-next-line no-console
    console.log(`- Session ID: ${sessionId}`);
    return;
  }

  // cmd === "chat": interactive loop (each user message triggers one run; watch until done and print price)
  const rl = createInterface({ input, output });
  // eslint-disable-next-line no-console
  console.log("Buyer CLI Chat (输入 /exit 退出). 直接输入：去这个市场买什么（例如：帮我买一个 100 USDC 内的酷炫商品）");

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const line = (await rl.question("> ")).trim();
      if (!line) continue;
      if (line === "/exit" || line === "/quit") break;

      try {
        // eslint-disable-next-line no-console
        console.log(`[cli] 指令：${line}`);
        const sessionId = await startRun({ goal: line });
        // eslint-disable-next-line no-console
        console.log(`[hub] started session: ${sessionId}`);
        // eslint-disable-next-line no-console
        console.log("去网页观战：http://localhost:3001（Agent 控制台里粘贴 Session ID -> 观看）");
        await watchRunToDone(sessionId);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err instanceof Error ? err.message : err);
      }
    }
  } finally {
    rl.close();
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
