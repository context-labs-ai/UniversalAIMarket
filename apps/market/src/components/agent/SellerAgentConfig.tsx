"use client";

import { useState, useCallback, useEffect } from "react";
import { clsx } from "clsx";
import { ethers } from "ethers";
import { useAgent, type QwenModel } from "@/lib/agentContext";

const QWEN_MODELS: { value: QwenModel; label: string; description: string }[] = [
  { value: "qwen-turbo", label: "Qwen Turbo", description: "快速" },
  { value: "qwen-plus", label: "Qwen Plus", description: "均衡" },
  { value: "qwen-max", label: "Qwen Max", description: "强大" },
  { value: "qwen3-max", label: "Qwen3 Max", description: "最新" },
];

const DEFAULT_LLM_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

/**
 * SellerAgentConfig - 卖家 Agent 配置界面
 */
export function SellerAgentConfig() {
  const { llmConfig, setLLMConfig, connectionStatus } = useAgent();

  // 卖家配置 (简化版，主要是 LLM 配置)
  const [walletAddress, setWalletAddress] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [minPrice, setMinPrice] = useState("0.5");
  const [strategy, setStrategy] = useState("尽量守住底价，适当让步但不超过 20%。");
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  // LLM 配置
  const [llmModel, setLlmModel] = useState<QwenModel>(llmConfig?.model || "qwen-max");
  const [llmApiKey, setLlmApiKey] = useState(llmConfig?.apiKey || "");
  const [llmBaseUrl, setLlmBaseUrl] = useState(llmConfig?.baseUrl || DEFAULT_LLM_BASE_URL);
  const [showLlmApiKey, setShowLlmApiKey] = useState(false);
  const [llmExpanded, setLlmExpanded] = useState(true);

  const isDisconnected = connectionStatus === "disconnected";

  // 同步 LLM 配置
  useEffect(() => {
    if (llmConfig) {
      setLlmModel(llmConfig.model);
      setLlmApiKey(llmConfig.apiKey);
      setLlmBaseUrl(llmConfig.baseUrl);
    }
  }, [llmConfig]);

  // 验证私钥并生成地址
  const handlePrivateKeyChange = useCallback((key: string) => {
    setPrivateKey(key);
    setError(null);

    if (!key.trim()) {
      setWalletAddress("");
      return;
    }

    try {
      const normalizedKey = key.startsWith("0x") ? key : `0x${key}`;
      const wallet = new ethers.Wallet(normalizedKey);
      setWalletAddress(wallet.address);
    } catch {
      setWalletAddress("");
      setError("私钥格式无效");
    }
  }, []);

  // 生成随机钱包
  const handleGenerateWallet = useCallback(() => {
    const wallet = ethers.Wallet.createRandom();
    setPrivateKey(wallet.privateKey);
    setWalletAddress(wallet.address);
    setError(null);
  }, []);

  // 保存配置
  const handleSaveConfig = useCallback(() => {
    // 保存 LLM 配置
    if (llmApiKey.trim()) {
      setLLMConfig({
        model: llmModel,
        apiKey: llmApiKey.trim(),
        baseUrl: llmBaseUrl.trim() || DEFAULT_LLM_BASE_URL,
        isConfigured: true,
      });
    }

    setIsConfigured(true);
    setError(null);
  }, [llmModel, llmApiKey, llmBaseUrl, setLLMConfig]);

  // 清除配置
  const handleClearConfig = useCallback(() => {
    setLLMConfig(null);
    setPrivateKey("");
    setWalletAddress("");
    setMinPrice("0.5");
    setStrategy("尽量守住底价，适当让步但不超过 20%。");
    setLlmModel("qwen-max");
    setLlmApiKey("");
    setLlmBaseUrl(DEFAULT_LLM_BASE_URL);
    setIsConfigured(false);
    setError(null);
  }, [setLLMConfig]);

  return (
    <div className="space-y-4">
      {/* Qwen 品牌头部 */}
      <div className="flex items-center gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-[#f59e0b] to-[#d97706] shadow-lg">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">卖家 Agent</span>
            <span className="px-1.5 py-0.5 text-[9px] rounded bg-[#f59e0b]/20 text-[#fbbf24] border border-[#f59e0b]/30">
              Powered by Qwen
            </span>
          </div>
          <p className="text-[10px] text-white/40 mt-0.5">
            阿里云通义千问大模型
          </p>
        </div>
      </div>

      {isConfigured ? (
        // 已配置状态 - 显示摘要
        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs font-medium text-emerald-400">卖家 Agent 已配置</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            {walletAddress && (
              <div className="flex justify-between">
                <span className="text-white/50">钱包</span>
                <span className="font-mono text-white/80">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-white/50">底价</span>
              <span className="text-amber-400">{minPrice} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">模型</span>
              <span className="text-[#fbbf24]">{llmConfig?.model || "未配置"}</span>
            </div>
          </div>

          <button
            onClick={handleClearConfig}
            disabled={!isDisconnected}
            className={clsx(
              "w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              isDisconnected
                ? "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                : "bg-white/5 text-white/30 cursor-not-allowed"
            )}
          >
            清除配置
          </button>
        </div>
      ) : (
        // 配置表单
        <div className="space-y-3">
          {/* Qwen LLM 配置 - 放在最上面 */}
          <div className="rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setLlmExpanded(!llmExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-white/70 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#f59e0b]" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                <span>Qwen 大模型配置</span>
                {llmConfig?.isConfigured && (
                  <span className="px-1.5 py-0.5 text-[9px] rounded bg-emerald-500/20 text-emerald-400">
                    已配置
                  </span>
                )}
              </div>
              <svg
                className={clsx("w-4 h-4 transition-transform", llmExpanded && "rotate-180")}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {llmExpanded && (
              <div className="px-3 pb-3 space-y-3 border-t border-[#f59e0b]/20">
                {/* 模型选择 */}
                <div className="space-y-1 pt-3">
                  <span className="text-xs text-white/50">模型</span>
                  <select
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value as QwenModel)}
                    disabled={!isDisconnected}
                    className={clsx(
                      "w-full rounded-lg bg-[#1a1a2e] border border-white/10 px-3 py-2 text-xs text-white/80 outline-none focus:ring-2 focus:ring-[#f59e0b]/40",
                      !isDisconnected && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {QWEN_MODELS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-[#1a1a2e] text-white">
                        {opt.label} ({opt.description})
                      </option>
                    ))}
                  </select>
                </div>

                {/* API Key */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">DashScope API Key</span>
                    <a
                      href="https://dashscope.console.aliyun.com/apiKey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#f59e0b] hover:text-[#fbbf24]"
                    >
                      获取密钥
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showLlmApiKey ? "text" : "password"}
                      value={llmApiKey}
                      onChange={(e) => setLlmApiKey(e.target.value)}
                      disabled={!isDisconnected}
                      placeholder="sk-..."
                      className={clsx(
                        "w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 pr-10 text-xs text-white/80 outline-none focus:ring-2 focus:ring-[#f59e0b]/40 font-mono",
                        !isDisconnected && "opacity-50 cursor-not-allowed"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLlmApiKey(!showLlmApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                    >
                      {showLlmApiKey ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* API Endpoint */}
                <div className="space-y-1">
                  <span className="text-xs text-white/50">API 端点 (可选)</span>
                  <input
                    type="text"
                    value={llmBaseUrl}
                    onChange={(e) => setLlmBaseUrl(e.target.value)}
                    disabled={!isDisconnected}
                    placeholder={DEFAULT_LLM_BASE_URL}
                    className={clsx(
                      "w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white/80 outline-none focus:ring-2 focus:ring-[#f59e0b]/40 font-mono",
                      !isDisconnected && "opacity-50 cursor-not-allowed"
                    )}
                  />
                  <div className="text-[10px] text-white/30">
                    默认：DashScope API
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 测试网警告 */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-xs font-medium text-amber-400">仅限测试网</p>
                <p className="text-[11px] text-amber-400/70 mt-0.5">
                  私钥仅存储在浏览器内存中，请使用测试网钱包。
                </p>
              </div>
            </div>
          </div>

          {/* 私钥输入 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">私钥 (可选)</span>
              <button
                onClick={handleGenerateWallet}
                disabled={!isDisconnected}
                className="text-[11px] text-amber-400 hover:text-amber-300 disabled:text-white/30"
              >
                生成新钱包
              </button>
            </div>
            <div className="relative">
              <input
                type={showPrivateKey ? "text" : "password"}
                value={privateKey}
                onChange={(e) => handlePrivateKeyChange(e.target.value)}
                disabled={!isDisconnected}
                placeholder="0x..."
                className={clsx(
                  "w-full rounded-lg bg-black/30 border px-3 py-2 pr-10 text-xs text-white/80 outline-none focus:ring-2 focus:ring-amber-500/40 font-mono",
                  error ? "border-red-500/50" : "border-white/10",
                  !isDisconnected && "opacity-50 cursor-not-allowed"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
              >
                {showPrivateKey ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {walletAddress && (
              <div className="text-[11px] text-white/40 font-mono">
                地址: {walletAddress}
              </div>
            )}
          </div>

          {/* 底价 */}
          <div className="space-y-1">
            <span className="text-xs text-white/50">底价 (USDC)</span>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              disabled={!isDisconnected}
              min="0.01"
              step="0.01"
              className={clsx(
                "w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white/80 outline-none focus:ring-2 focus:ring-amber-500/40",
                !isDisconnected && "opacity-50 cursor-not-allowed"
              )}
            />
          </div>

          {/* 谈判策略 */}
          <div className="space-y-1">
            <span className="text-xs text-white/50">谈判策略</span>
            <textarea
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              disabled={!isDisconnected}
              placeholder="例如：尽量守住底价..."
              rows={2}
              className={clsx(
                "w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white/80 outline-none focus:ring-2 focus:ring-amber-500/40 resize-none",
                !isDisconnected && "opacity-50 cursor-not-allowed"
              )}
            />
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* 保存按钮 */}
          <button
            onClick={handleSaveConfig}
            disabled={!isDisconnected}
            className={clsx(
              "w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              isDisconnected
                ? "bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white hover:opacity-90"
                : "bg-white/5 text-white/30 cursor-not-allowed"
            )}
          >
            保存配置
          </button>
        </div>
      )}
    </div>
  );
}
