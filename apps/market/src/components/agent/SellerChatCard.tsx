"use client";

import { clsx } from "clsx";
import type { SellerChat, ChatRole } from "@/lib/agentContext";

interface SellerChatCardProps {
  chat: SellerChat;
}

const ROLE_CONFIG: Record<ChatRole, { bgColor: string; textColor: string; align: "left" | "right" }> = {
  buyer: { bgColor: "bg-indigo-500/20", textColor: "text-indigo-300", align: "right" },
  seller: { bgColor: "bg-emerald-500/20", textColor: "text-emerald-300", align: "left" },
  system: { bgColor: "bg-gray-500/20", textColor: "text-gray-300", align: "left" },
  tool: { bgColor: "bg-amber-500/10", textColor: "text-amber-300", align: "left" },
};

const STATUS_CONFIG = {
  negotiating: { label: "砍价中...", bgColor: "bg-amber-500/20", textColor: "text-amber-400" },
  agreed: { label: "待结算", bgColor: "bg-blue-500/20", textColor: "text-blue-400" },
  settled: { label: "已成交", bgColor: "bg-emerald-500/20", textColor: "text-emerald-400" },
  failed: { label: "未成交", bgColor: "bg-gray-500/20", textColor: "text-gray-400" },
  cancelled: { label: "交易取消", bgColor: "bg-red-500/20", textColor: "text-red-400" },
};

export function SellerChatCard({ chat }: SellerChatCardProps) {
  const statusConfig = STATUS_CONFIG[chat.status];

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-white/80 truncate">
            {chat.storeName}
          </span>
          <span className="text-[10px] text-white/40 truncate">
            {chat.productName}
          </span>
        </div>
        <span className={clsx(
          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
          statusConfig.bgColor,
          statusConfig.textColor
        )}>
          {statusConfig.label}
        </span>
      </div>

      {/* Messages */}
      <div className="px-3 py-2 space-y-2 max-h-[200px] overflow-y-auto">
        {chat.messages.length === 0 ? (
          <p className="text-xs text-white/30 text-center py-2">等待对话开始...</p>
        ) : (
          chat.messages.map((message) => {
            const config = ROLE_CONFIG[message.role];
            const isBuyer = message.role === "buyer";

            return (
              <div
                key={message.id}
                className={clsx("flex w-full", isBuyer ? "justify-end" : "justify-start")}
              >
                <div className={clsx("max-w-[90%] rounded px-2 py-1", config.bgColor)}>
                  <span className={clsx("text-[10px] font-medium", config.textColor)}>
                    {message.speaker}
                  </span>
                  <p className="text-xs text-white/80 whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer - Final Price */}
      {chat.status !== "negotiating" && (
        <div className="px-3 py-2 border-t border-white/10 bg-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40">
              {chat.status === "cancelled" ? "超出预算" : "最终价格"}
            </span>
            <span className={clsx(
              "text-xs font-medium",
              chat.status === "settled" ? "text-emerald-400" :
              chat.status === "agreed" ? "text-blue-400" :
              chat.status === "cancelled" ? "text-red-400" : "text-gray-400"
            )}>
              {chat.priceUSDC} USDC
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
