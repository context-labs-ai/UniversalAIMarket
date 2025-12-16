"use client";

import { clsx } from "clsx";
import { useAgent } from "@/lib/agentContext";

export function AgentConnectButton() {
  const { connectionStatus, connect, toggleSidebar, isExpanded } = useAgent();

  const isConnected = connectionStatus !== "disconnected";
  const isConnecting = connectionStatus === "discovering" || connectionStatus === "authenticating";
  const isRunning = connectionStatus === "running" || isConnecting;

  const handleClick = () => {
    // 无论是否连接，点击都打开/关闭侧边栏，让用户先配置再启动
    toggleSidebar();
  };

  return (
    <button
      onClick={handleClick}
      disabled={isConnecting}
      className={clsx(
        "glass-panel relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
        isConnected
          ? "text-emerald-400 hover:text-emerald-300"
          : "text-white/80 hover:text-white",
        isConnecting && "cursor-wait"
      )}
    >
      {/* Status indicator */}
      <span className="relative flex h-2 w-2">
        {isRunning && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
        )}
        <span
          className={clsx(
            "relative inline-flex h-2 w-2 rounded-full",
            connectionStatus === "disconnected" && "bg-gray-500",
            connectionStatus === "discovering" && "bg-yellow-500",
            connectionStatus === "authenticating" && "bg-yellow-500",
            connectionStatus === "connected" && "bg-emerald-500",
            connectionStatus === "running" && "bg-blue-500",
            connectionStatus === "completed" && "bg-emerald-500",
            connectionStatus === "error" && "bg-red-500"
          )}
        />
      </span>

      {/* Label */}
      <span className="hidden sm:inline">
        {connectionStatus === "disconnected" && "Agent"}
        {connectionStatus === "discovering" && "发现服务..."}
        {connectionStatus === "authenticating" && "认证中..."}
        {connectionStatus === "connected" && "Agent 状态"}
        {connectionStatus === "running" && "Agent 运行中"}
        {connectionStatus === "completed" && "查看结果"}
        {connectionStatus === "error" && "发生错误"}
      </span>

      {/* Sidebar toggle indicator */}
      {isConnected && (
        <svg
          className={clsx(
            "h-4 w-4 transition-transform",
            isExpanded && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={isExpanded ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"}
          />
        </svg>
      )}
    </button>
  );
}
