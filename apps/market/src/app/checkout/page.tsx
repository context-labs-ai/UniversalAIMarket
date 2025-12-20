"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cartStore";

type TimelineStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
  txHash?: string;
};

const INITIAL_STEPS: TimelineStep[] = [
  { id: "prepare", label: "准备交易", status: "pending" },
  { id: "approve", label: "授权 USDC", status: "pending" },
  { id: "deposit", label: "提交付款", status: "pending" },
  { id: "orchestrate", label: "ZetaChain 处理", status: "pending" },
  { id: "deliver", label: "NFT 交付", status: "pending" },
];

function CheckoutContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "testnet" ? "testnet" : "simulate";
  const { items, totalPrice, clearCart } = useCart();

  const [steps, setSteps] = useState<TimelineStep[]>(INITIAL_STEPS);
  const [logs, setLogs] = useState<{ role: string; content: string }[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function startSettlement() {
    if (items.length === 0) return;

    setIsRunning(true);
    setError(null);
    setSteps(INITIAL_STEPS);
    setLogs([]);

    setSteps((prev) =>
      prev.map((s) => (s.id === "prepare" ? { ...s, status: "running", detail: "生成 Deal..." } : s))
    );
    setLogs((prev) => [...prev, { role: "system", content: "开始准备跨链结算..." }]);

    await new Promise((r) => setTimeout(r, 500));

    const item = items[0];
    const fakeDeal = {
      dealId: "0x" + Math.random().toString(16).slice(2, 66).padEnd(64, "0"),
      buyer: "0x" + "1".repeat(40),
      sellerBase: "0x" + "2".repeat(40),
      polygonEscrow: "0x" + "3".repeat(40),
      nft: "0x" + "4".repeat(40),
      tokenId: String(item.tokenId),
      price: String(BigInt(Math.floor(parseFloat(item.priceUSDC) * 1e6))),
      deadline: String(Math.floor(Date.now() / 1000) + 3600),
    };

    setSteps((prev) =>
      prev.map((s) => (s.id === "prepare" ? { ...s, status: "done", detail: "Deal 已生成" } : s))
    );
    setLogs((prev) => [...prev, { role: "buyer", content: `Deal ID: ${fakeDeal.dealId.slice(0, 18)}...` }]);

    const encoded = btoa(JSON.stringify(fakeDeal))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const streamUrl = `/api/settle/stream?mode=${mode}&deal=${encoded}`;

    try {
      const response = await fetch(streamUrl);
      if (!response.ok) throw new Error("Failed to connect to settlement stream");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              handleSSEEvent(eventType, data);
            } catch {
              // ignore parse errors
            }
            eventType = "";
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Settlement failed");
      setIsRunning(false);
    }
  }

  function handleSSEEvent(event: string, data: unknown) {
    if (event === "step" && typeof data === "object" && data !== null) {
      const stepData = data as { id?: string; status?: string; detail?: string; txHash?: string };
      if (stepData.id) {
        setSteps((prev) =>
          prev.map((s) =>
            s.id === stepData.id
              ? {
                  ...s,
                  status: (stepData.status as TimelineStep["status"]) || s.status,
                  detail: stepData.detail || s.detail,
                  txHash: stepData.txHash || s.txHash,
                }
              : s
          )
        );
      }
    } else if (event === "log" && typeof data === "object" && data !== null) {
      const logData = data as { role?: string; content?: string };
      const content = logData.content;
      if (content) {
        setLogs((prev) => [...prev, { role: logData.role || "system", content }]);
      }
    } else if (event === "done") {
      setIsDone(true);
      setIsRunning(false);
      setLogs((prev) => [...prev, { role: "system", content: "✅ 结算完成！" }]);
    } else if (event === "error") {
      const errorMsg = typeof data === "string" ? data : "Unknown error";
      setError(errorMsg);
      setIsRunning(false);
      setLogs((prev) => [...prev, { role: "system", content: `❌ 错误: ${errorMsg}` }]);
    }
  }

  function getStatusIcon(status: TimelineStep["status"]) {
    switch (status) {
      case "done":
        return "✓";
      case "running":
        return "◌";
      case "error":
        return "✗";
      default:
        return "○";
    }
  }

  function getStatusColor(status: TimelineStep["status"]) {
    switch (status) {
      case "done":
        return "text-emerald-400 border-emerald-400/50";
      case "running":
        return "text-indigo-400 border-indigo-400/50 animate-pulse";
      case "error":
        return "text-red-400 border-red-400/50";
      default:
        return "text-white/30 border-white/20";
    }
  }

  if (items.length === 0 && !isDone) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <header>
          <Link href="/cart" className="text-xs text-white/50 hover:text-white/70">
            ← 返回购物车
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white/90">结算</h1>
        </header>
        <div className="mt-10 text-center text-sm text-white/50">购物车为空，无法结算</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <header>
        <Link href="/cart" className="text-xs text-white/50 hover:text-white/70">
          ← 返回购物车
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white/90">
          跨链结算 {mode === "simulate" ? "(模拟)" : "(测试网)"}
        </h1>
        <p className="mt-1 text-sm text-white/50">
          {totalPrice.toFixed(2)} USDC · {items.length} 件商品
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="glass-panel rounded-2xl p-5">
          <h2 className="text-sm font-medium text-white/80">结算进度</h2>
          <div className="mt-4 space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-medium ${getStatusColor(
                      step.status
                    )}`}
                  >
                    {getStatusIcon(step.status)}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`mt-1 h-8 w-0.5 ${
                        step.status === "done" ? "bg-emerald-400/50" : "bg-white/10"
                      }`}
                    />
                  )}
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="text-sm text-white/80">{step.label}</div>
                  {step.detail && <div className="mt-0.5 text-xs text-white/50">{step.detail}</div>}
                  {step.txHash && (
                    <div className="mt-1 text-xs text-indigo-300/70 font-mono truncate">
                      tx: {step.txHash.slice(0, 20)}...
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!isRunning && !isDone && (
            <button
              onClick={startSettlement}
              className="mt-6 w-full rounded-xl bg-indigo-500/20 px-4 py-3 text-sm font-medium text-indigo-200 transition-colors hover:bg-indigo-500/30"
            >
              开始结算
            </button>
          )}

          {isDone && (
            <div className="mt-6 space-y-3">
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-center text-sm text-emerald-200">
                🎉 结算成功完成！
              </div>
              <button
                onClick={() => {
                  clearCart();
                  window.location.href = "/dashboard";
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 transition-colors hover:bg-white/10"
              >
                返回市场
              </button>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-200">
              ❌ {error}
            </div>
          )}
        </section>

        <section className="glass-panel rounded-2xl p-5">
          <h2 className="text-sm font-medium text-white/80">实时日志</h2>
          <div className="mt-4 h-80 overflow-y-auto rounded-xl bg-black/30 p-3 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-white/30">等待开始...</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="mb-1">
                  <span
                    className={`${
                      log.role === "buyer"
                        ? "text-indigo-300"
                        : log.role === "seller"
                          ? "text-emerald-300"
                          : "text-white/50"
                    }`}
                  >
                    [{log.role}]
                  </span>{" "}
                  <span className="text-white/70">{log.content}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </section>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-5 py-10 text-white/50">加载中...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
