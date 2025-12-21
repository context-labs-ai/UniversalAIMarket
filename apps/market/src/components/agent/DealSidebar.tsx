"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { clsx } from "clsx";
import { useAgent } from "@/lib/agentContext";
import { AgentStatusBadge } from "./AgentStatusBadge";
import { AgentTimeline } from "./AgentTimeline";
import { DealList } from "./DealList";
import { BuyerAgentConfig } from "./BuyerAgentConfig";
import { SellerAgentConfig } from "./SellerAgentConfig";
import { getCurrentRole, type UserRole } from "@/lib/auth/dynamic";

type SidebarTab = "timeline" | "deals";
type SettingsSection = "general" | "buyer" | "seller";

const MIN_WIDTH = 320;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 380;

export function DealSidebar() {
  const [watchSessionId, setWatchSessionId] = useState("");
  const [activeTab, setActiveTab] = useState<SidebarTab>("timeline");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general");
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const isDraggingRef = useRef(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const [role, setRole] = useState<UserRole>("buyer");

  // 监听角色变化
  useEffect(() => {
    setRole(getCurrentRole());
    const handleRoleChange = () => {
      const newRole = getCurrentRole();
      setRole(newRole);
      if (newRole === "seller") {
        setSettingsSection("general");
      }
    };
    window.addEventListener("role-changed", handleRoleChange);
    return () => window.removeEventListener("role-changed", handleRoleChange);
  }, []);

  const isSeller = role === "seller";

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const {
    connectionStatus,
    isExpanded,
    toggleSidebar,
    connect,
    deal,
    dealItems,
    errorMessage,
    reset,
    demoMode,
    setDemoMode,
    checkoutMode,
    setCheckoutMode,
    agentEngine,
    setAgentEngine,
    agentUpstream,
    setAgentUpstream,
    scenario,
    setScenario,
    awaitingConfirm,
    confirmSettlement,
    watchSession,
  } = useAgent();

  const isDisconnected = connectionStatus === "disconnected";
  const pendingDealsCount = dealItems.filter(d => d.status === "pending").length;

  // Auto-switch to deals tab when first deal appears (only once)
  const hasAutoSwitched = useRef(false);
  useEffect(() => {
    if (dealItems.length > 0 && !hasAutoSwitched.current) {
      hasAutoSwitched.current = true;
      setActiveTab("deals");
    }
    // Reset flag when deals are cleared
    if (dealItems.length === 0) {
      hasAutoSwitched.current = false;
    }
  }, [dealItems.length]);

  return (
    <>
      {/* Toggle button when collapsed */}
      {!isExpanded && (
        <button
          onClick={toggleSidebar}
          className={clsx(
            "fixed right-0 top-1/2 -translate-y-1/2 z-40",
            "flex items-center justify-center w-8 h-24 rounded-l-xl",
            "bg-gradient-to-l from-[#0d0b09]/98 to-[#12100d]/95",
            "border border-r-0 border-[#d4a574]/20 backdrop-blur-xl",
            "text-[#d4a574]/70 hover:text-[#d4a574] hover:border-[#d4a574]/40",
            "shadow-lg shadow-black/20 transition-all duration-300",
            "hover:w-10 hover:shadow-[#d4a574]/10"
          )}
          title="打开 Agent 面板"
        >
          <div className="flex flex-col items-center gap-1.5">
            <AgentStatusBadge status={connectionStatus} compact />
            {pendingDealsCount > 0 && (
              <span className="text-[9px] font-medium text-[#c8d86a] bg-[#c8d86a]/10 px-1.5 py-0.5 rounded-full">
                {pendingDealsCount}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        style={{ width: `${width}px` }}
        className={clsx(
          "fixed right-0 top-0 z-50 flex h-full flex-col border-l border-white/10 bg-[#0a0c14]/95 backdrop-blur-xl transition-transform duration-300",
          isExpanded ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 h-full w-1 cursor-ew-resize hover:bg-indigo-500/50 active:bg-indigo-500/70 transition-colors"
        />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-white">Agent 状态</span>
            <AgentStatusBadge status={connectionStatus} />
          </div>
          <button
            onClick={toggleSidebar}
            className="rounded p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Settings Section Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setSettingsSection("general")}
            className={clsx(
              "flex-1 px-3 py-2 text-xs font-medium transition-colors",
              settingsSection === "general"
                ? "text-white border-b-2 border-indigo-500 bg-white/5"
                : "text-white/50 hover:text-white/70"
            )}
          >
            通用
          </button>
          {/* 买家 Agent 选项卡 - 仅买家模式显示 */}
          {!isSeller && (
            <button
              onClick={() => setSettingsSection("buyer")}
              className={clsx(
                "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                settingsSection === "buyer"
                  ? "text-white border-b-2 border-emerald-500 bg-white/5"
                  : "text-white/50 hover:text-white/70"
              )}
            >
              买家 Agent
            </button>
          )}
          {/* 卖家 Agent 选项卡 - 仅卖家模式显示 */}
          {isSeller && (
            <button
              onClick={() => setSettingsSection("seller")}
              className={clsx(
                "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                settingsSection === "seller"
                  ? "text-white border-b-2 border-amber-500 bg-white/5"
                  : "text-white/50 hover:text-white/70"
              )}
            >
              卖家 Agent
            </button>
          )}
        </div>

        {/* Settings Content */}
        <div className="border-b border-white/10 bg-white/5 px-4 py-3 space-y-3 max-h-[40vh] overflow-y-auto">
          {settingsSection === "buyer" && !isSeller ? (
            <BuyerAgentConfig />
          ) : settingsSection === "seller" && isSeller ? (
            <SellerAgentConfig />
          ) : (
          <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">运行模式</span>
            <div className="flex rounded-lg bg-black/30 p-0.5">
              <button
                onClick={() => setDemoMode("simulate")}
                disabled={!isDisconnected}
                className={clsx(
                  "px-3 py-1 text-xs rounded-md transition-all",
                  demoMode === "simulate"
                    ? "bg-amber-500/20 text-amber-400"
                    : "text-white/40 hover:text-white/60",
                  !isDisconnected && "opacity-50 cursor-not-allowed"
                )}
              >
                模拟
              </button>
              <button
                onClick={() => setDemoMode("testnet")}
                disabled={!isDisconnected}
                className={clsx(
                  "px-3 py-1 text-xs rounded-md transition-all",
                  demoMode === "testnet"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-white/40 hover:text-white/60",
                  !isDisconnected && "opacity-50 cursor-not-allowed"
                )}
              >
                Testnet
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">结算模式</span>
            <div className="flex rounded-lg bg-black/30 p-0.5">
              <button
                onClick={() => setCheckoutMode("auto")}
                disabled={!isDisconnected}
                className={clsx(
                  "px-3 py-1 text-xs rounded-md transition-all",
                  checkoutMode === "auto"
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "text-white/40 hover:text-white/60",
                  !isDisconnected && "opacity-50 cursor-not-allowed"
                )}
              >
                全自动
              </button>
              <button
                onClick={() => setCheckoutMode("confirm")}
                disabled={!isDisconnected}
                className={clsx(
                  "px-3 py-1 text-xs rounded-md transition-all",
                  checkoutMode === "confirm"
                    ? "bg-sky-500/20 text-sky-300"
                    : "text-white/40 hover:text-white/60",
                  !isDisconnected && "opacity-50 cursor-not-allowed"
                )}
              >
                手动确认
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">对话场景</span>
            <div className="flex rounded-lg bg-black/30 p-0.5">
              <button
                onClick={() => setScenario("single")}
                disabled={!isDisconnected}
                className={clsx(
                  "px-3 py-1 text-xs rounded-md transition-all",
                  scenario === "single"
                    ? "bg-white/10 text-white/80"
                    : "text-white/40 hover:text-white/60",
                  !isDisconnected && "opacity-50 cursor-not-allowed"
                )}
              >
                单卖家
              </button>
              <button
                onClick={() => setScenario("multi")}
                disabled={!isDisconnected}
                className={clsx(
                  "px-3 py-1 text-xs rounded-md transition-all",
                  scenario === "multi"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-white/40 hover:text-white/60",
                  !isDisconnected && "opacity-50 cursor-not-allowed"
                )}
              >
                多卖家
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">Agent 引擎</span>
            <div className="flex rounded-lg bg-black/30 p-0.5">
              <button
                onClick={() => setAgentEngine("builtin")}
                disabled={!isDisconnected}
                className={clsx(
                  "px-3 py-1 text-xs rounded-md transition-all",
                  agentEngine === "builtin"
                    ? "bg-blue-500/20 text-blue-300"
                    : "text-white/40 hover:text-white/60",
                  !isDisconnected && "opacity-50 cursor-not-allowed"
                )}
              >
                内置
              </button>
              <button
                onClick={() => setAgentEngine("proxy")}
                disabled={!isDisconnected}
                className={clsx(
                  "px-3 py-1 text-xs rounded-md transition-all",
                  agentEngine === "proxy"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-white/40 hover:text-white/60",
                  !isDisconnected && "opacity-50 cursor-not-allowed"
                )}
              >
                外部
              </button>
            </div>
          </div>

          {isDisconnected && agentEngine === "proxy" && (
            <div className="space-y-1">
              <div className="text-xs text-white/50">Agent API Endpoint</div>
              <input
                value={agentUpstream}
                onChange={(e) => setAgentUpstream(e.target.value)}
                placeholder="http://localhost:8080/api/agent/stream"
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white/80 outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <div className="text-[11px] text-white/35">使用同源 proxy，无需额外 CORS 配置</div>
            </div>
          )}

          {isDisconnected && agentEngine === "proxy" && (
            <div className="space-y-1">
              <div className="text-xs text-white/50">Session ID（终端启动后粘贴）</div>
              <div className="flex gap-2">
                <input
                  value={watchSessionId}
                  onChange={(e) => setWatchSessionId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="min-w-0 flex-1 rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white/80 outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <button
                  onClick={() => watchSession(watchSessionId)}
                  className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-xs text-white/80 hover:bg-white/15"
                >
                  观看
                </button>
              </div>
              <div className="text-[11px] text-white/35">会订阅该 Session 的总聊天室 + 时间线</div>
            </div>
          )}
          </>
          )}
        </div>

        {/* Tabs */}
        {!isDisconnected && (
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab("timeline")}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors",
                activeTab === "timeline"
                  ? "text-white border-b-2 border-indigo-500 bg-white/5"
                  : "text-white/50 hover:text-white/70"
              )}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              进度
            </button>
            <button
              onClick={() => setActiveTab("deals")}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors relative",
                activeTab === "deals"
                  ? "text-white border-b-2 border-sky-500 bg-white/5"
                  : "text-white/50 hover:text-white/70"
              )}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Deal 列表
              {pendingDealsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-sky-500 text-[10px] text-white flex items-center justify-center">
                  {pendingDealsCount > 9 ? "9+" : pendingDealsCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isDisconnected ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="rounded-full bg-white/5 p-4">
                <svg className="h-8 w-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-white/60">Agent 未启动</p>
                <p className="mt-1 text-xs text-white/40">
                  先配置上方选项，然后点击下方按钮启动
                </p>
              </div>
            </div>
          ) : activeTab === "timeline" ? (
            <div className="space-y-6">
              {/* Error message */}
              {errorMessage && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                  <p className="text-xs text-red-400">{errorMessage}</p>
                </div>
              )}

              {/* Timeline */}
              <AgentTimeline />

              {/* Deal info */}
              {deal && (
                <div>
                  <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-white/40">
                    当前交易详情
                  </h3>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-white/50">Deal ID</span>
                        <span className="font-mono text-white/80">
                          {deal.dealId.slice(0, 10)}...
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">Token ID</span>
                        <span className="text-white/80">#{deal.tokenId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">价格</span>
                        <span className="text-emerald-400">
                          {(Number(deal.price) / 1e6).toFixed(2)} USDC
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">截止时间</span>
                        <span className="text-white/80">
                          {new Date(Number(deal.deadline) * 1000).toLocaleString("zh-CN")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <DealList deals={dealItems} />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-4 py-3">
          {isDisconnected ? (
            <button
              onClick={() => connect()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600/80 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>启动 Agent</span>
            </button>
          ) : (
            <>
              {awaitingConfirm && (
                <button
                  onClick={confirmSettlement}
                  className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600/80 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>发起结算</span>
                </button>
              )}
              <button
                onClick={reset}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>重置</span>
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
