"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

// ============ Chain Logos ============

function BaseLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H0C2.35281 87.8625 26.0432 110.034 54.921 110.034Z" fill="white"/>
    </svg>
  );
}

function ZetaChainLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill="#005741"/>
      <path d="M22.5 9H12.5L9.5 12H19.5L22.5 9Z" fill="#00D395"/>
      <path d="M9.5 23H19.5L22.5 20H12.5L9.5 23Z" fill="#00D395"/>
      <path d="M22.5 9L9.5 23" stroke="#00D395" strokeWidth="2.5"/>
    </svg>
  );
}

function PolygonLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 38 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M29.238 10.193C28.526 9.78 27.611 9.78 26.797 10.193L21.165 13.433L17.363 15.538L11.832 18.778C11.12 19.191 10.205 19.191 9.391 18.778L5.082 16.261C4.37 15.848 3.862 15.023 3.862 14.095V9.163C3.862 8.338 4.268 7.513 5.082 7.001L9.289 4.586C10.001 4.173 10.916 4.173 11.73 4.586L15.937 7.103C16.649 7.516 17.157 8.341 17.157 9.268V12.508L20.959 10.3V6.958C20.959 6.133 20.553 5.308 19.739 4.795L11.832 0.175C11.12 -0.238 10.205 -0.238 9.391 0.175L1.281 4.898C0.467 5.311 0.061 6.136 0.061 6.958V16.365C0.061 17.19 0.467 18.015 1.281 18.528L9.391 23.148C10.103 23.561 11.018 23.561 11.832 23.148L17.363 20.01L21.165 17.803L26.696 14.665C27.408 14.252 28.323 14.252 29.137 14.665L33.344 17.08C34.056 17.493 34.564 18.318 34.564 19.245V24.178C34.564 25.003 34.158 25.828 33.344 26.34L29.238 28.756C28.526 29.169 27.611 29.169 26.797 28.756L22.59 26.34C21.878 25.927 21.37 25.102 21.37 24.175V21.037L17.568 23.245V26.485C17.568 27.31 17.974 28.135 18.788 28.648L26.898 33.268C27.61 33.681 28.525 33.681 29.339 33.268L37.449 28.648C38.161 28.235 38.669 27.41 38.669 26.483V17.075C38.669 16.25 38.263 15.425 37.449 14.913L29.238 10.193Z" fill="#8247E5"/>
    </svg>
  );
}

function EthereumLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill="#627EEA"/>
      <path d="M16.498 4V12.87L23.995 16.22L16.498 4Z" fill="white" fillOpacity="0.6"/>
      <path d="M16.498 4L9 16.22L16.498 12.87V4Z" fill="white"/>
      <path d="M16.498 21.968V27.995L24 17.616L16.498 21.968Z" fill="white" fillOpacity="0.6"/>
      <path d="M16.498 27.995V21.967L9 17.616L16.498 27.995Z" fill="white"/>
      <path d="M16.498 20.573L23.995 16.22L16.498 12.872V20.573Z" fill="white" fillOpacity="0.2"/>
      <path d="M9 16.22L16.498 20.573V12.872L9 16.22Z" fill="white" fillOpacity="0.6"/>
    </svg>
  );
}

function BSCLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill="#F3BA2F"/>
      <path d="M12.116 14.404L16 10.52L19.886 14.406L22.146 12.146L16 6L9.856 12.144L12.116 14.404Z" fill="white"/>
      <path d="M6 16L8.26 13.74L10.52 16L8.26 18.26L6 16Z" fill="white"/>
      <path d="M12.116 17.596L16 21.48L19.886 17.594L22.147 19.853L16 26L9.855 19.855L12.116 17.596Z" fill="white"/>
      <path d="M21.48 16L23.74 13.74L26 16L23.74 18.26L21.48 16Z" fill="white"/>
      <path d="M18.292 16L16 13.708L14.404 15.304L14.208 15.5L13.708 16L16 18.292L18.292 16Z" fill="white"/>
    </svg>
  );
}

function SolanaLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill="black"/>
      <path d="M9.925 20.275C10.05 20.15 10.225 20.075 10.412 20.075H25.087C25.4 20.075 25.562 20.45 25.337 20.675L22.075 23.937C21.95 24.062 21.775 24.137 21.587 24.137H6.912C6.6 24.137 6.437 23.762 6.662 23.537L9.925 20.275Z" fill="url(#solana1)"/>
      <path d="M9.925 8.063C10.056 7.938 10.231 7.863 10.412 7.863H25.087C25.4 7.863 25.562 8.238 25.337 8.463L22.075 11.725C21.95 11.85 21.775 11.925 21.587 11.925H6.912C6.6 11.925 6.437 11.55 6.662 11.325L9.925 8.063Z" fill="url(#solana2)"/>
      <path d="M22.075 14.125C21.95 14 21.775 13.925 21.587 13.925H6.912C6.6 13.925 6.437 14.3 6.662 14.525L9.925 17.787C10.05 17.912 10.225 17.987 10.412 17.987H25.087C25.4 17.987 25.562 17.612 25.337 17.387L22.075 14.125Z" fill="url(#solana3)"/>
      <defs>
        <linearGradient id="solana1" x1="23.5" y1="5.5" x2="8.5" y2="26.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFA3"/>
          <stop offset="1" stopColor="#DC1FFF"/>
        </linearGradient>
        <linearGradient id="solana2" x1="23.5" y1="5.5" x2="8.5" y2="26.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFA3"/>
          <stop offset="1" stopColor="#DC1FFF"/>
        </linearGradient>
        <linearGradient id="solana3" x1="23.5" y1="5.5" x2="8.5" y2="26.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFA3"/>
          <stop offset="1" stopColor="#DC1FFF"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function USDCLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill="#2775CA"/>
      <path d="M20.5 18.5C20.5 16.25 19.125 15.375 16.375 15.0625C14.375 14.8125 14 14.25 14 13.375C14 12.5 14.625 11.9375 15.875 11.9375C17 11.9375 17.625 12.3125 17.875 13.1875C17.9375 13.375 18.125 13.5 18.3125 13.5H19.25C19.5 13.5 19.6875 13.3125 19.6875 13.0625V13C19.4375 11.6875 18.375 10.6875 17 10.5V9.25C17 9 16.8125 8.8125 16.5 8.75H15.5625C15.3125 8.75 15.125 8.9375 15.0625 9.1875V10.4375C13.25 10.6875 12.125 11.875 12.125 13.4375C12.125 15.5625 13.4375 16.5 16.1875 16.8125C18.0625 17.125 18.625 17.5625 18.625 18.5625C18.625 19.5625 17.75 20.25 16.5 20.25C14.8125 20.25 14.25 19.5 14.0625 18.625C14 18.4375 13.8125 18.3125 13.625 18.3125H12.625C12.375 18.3125 12.1875 18.5 12.1875 18.75V18.8125C12.4375 20.3125 13.4375 21.3125 15.125 21.5625V22.8125C15.125 23.0625 15.3125 23.25 15.5625 23.3125H16.5C16.75 23.3125 16.9375 23.125 17 22.875V21.5625C18.8125 21.25 20.5 20.125 20.5 18.5Z" fill="white"/>
      <path d="M12.75 24.1875C8.4375 22.6875 6.25 17.875 7.8125 13.625C8.6875 11.25 10.5625 9.4375 12.9375 8.5625C13.1875 8.4375 13.3125 8.25 13.3125 7.9375V7.125C13.3125 6.875 13.1875 6.6875 12.9375 6.625C12.875 6.625 12.75 6.625 12.6875 6.6875C7.4375 8.25 4.5 13.75 6.0625 19C7 22 9.3125 24.3125 12.3125 25.25C12.5625 25.375 12.8125 25.25 12.875 25C12.9375 24.9375 12.9375 24.875 12.9375 24.75V23.9375C12.9375 23.75 12.8125 23.5 12.5625 23.4375L12.75 24.1875Z" fill="white"/>
      <path d="M19.3125 6.6875C19.0625 6.5625 18.8125 6.6875 18.75 6.9375C18.6875 7 18.6875 7.0625 18.6875 7.1875V8C18.6875 8.25 18.8125 8.4375 19.0625 8.5625C23.375 10.0625 25.5625 14.875 24 19.125C23.125 21.5 21.25 23.3125 18.875 24.1875C18.625 24.3125 18.5 24.5 18.5 24.8125V25.625C18.5 25.875 18.625 26.0625 18.875 26.125C18.9375 26.125 19.0625 26.125 19.125 26.0625C24.375 24.5 27.3125 19 25.75 13.75C24.8125 10.6875 22.4375 8.375 19.3125 7.4375V6.6875Z" fill="white"/>
    </svg>
  );
}

function PackageLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill="#FF6B35"/>
      <path d="M16 7L24 11.5V20.5L16 25L8 20.5V11.5L16 7Z" stroke="white" strokeWidth="1.5" fill="none"/>
      <path d="M16 16L24 11.5M16 16L8 11.5M16 16V25" stroke="white" strokeWidth="1.5"/>
      <path d="M12 9.25L20 13.75" stroke="white" strokeWidth="1.5"/>
    </svg>
  );
}

// ============ Scenario Configurations ============

type ChainConfig = {
  id: string;
  name: string;
  role: string;
  color: string;
  Logo: React.ComponentType<{ className?: string }>;
};

type FlowStep = {
  id: number;
  from: string;
  to: string;
  label: string;
  desc: string;
  color: string;
};

type Result = {
  chain: string;
  text: string;
};

type Scenario = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  chains: ChainConfig[];
  steps: FlowStep[];
  results: Result[];
};

const scenarios: Scenario[] = [
  {
    id: "nft-trade",
    title: "虚拟商品 NFT 跨链交易",
    subtitle: "当前已实现",
    badge: "Live",
    badgeColor: "#00D395",
    chains: [
      { id: "base", name: "Base", role: "买家付款链", color: "#0052FF", Logo: BaseLogo },
      { id: "zeta", name: "ZetaChain", role: "编排层", color: "#00D395", Logo: ZetaChainLogo },
      { id: "polygon", name: "Polygon", role: "NFT 所在链", color: "#8247E5", Logo: PolygonLogo },
    ],
    steps: [
      { id: 1, from: "base", to: "zeta", label: "depositAndCall()", desc: "USDC + Deal 信息", color: "#0052FF" },
      { id: 2, from: "zeta", to: "zeta", label: "UniversalMarket.onCall()", desc: "验证 Deal & 金额", color: "#00D395" },
      { id: 3, from: "zeta", to: "base", label: "gateway.withdraw()", desc: "USDC → 卖家", color: "#00D395" },
      { id: 4, from: "zeta", to: "polygon", label: "gateway.call()", desc: "触发 Escrow.release", color: "#00D395" },
      { id: 5, from: "polygon", to: "polygon", label: "NFT 释放", desc: "转给买家地址", color: "#8247E5" },
    ],
    results: [
      { chain: "base", text: "卖家收到 USDC" },
      { chain: "zeta", text: "交易完成" },
      { chain: "polygon", text: "买家收到 NFT" },
    ],
  },
  {
    id: "physical-goods",
    title: "实体商品交易",
    subtitle: "跨链托管 + 物流回执",
    badge: "Coming Soon",
    badgeColor: "#FF9C40",
    chains: [
      { id: "base", name: "Base", role: "买家付款链", color: "#0052FF", Logo: BaseLogo },
      { id: "zeta", name: "ZetaChain", role: "托管/编排层", color: "#00D395", Logo: ZetaChainLogo },
      { id: "polygon", name: "Polygon", role: "订单凭证链", color: "#8247E5", Logo: PolygonLogo },
    ],
    steps: [
      { id: 1, from: "base", to: "zeta", label: "depositAndCall()", desc: "USDC + 订单/收货条件", color: "#0052FF" },
      { id: 2, from: "zeta", to: "zeta", label: "UniversalMarket.onCall()", desc: "创建 escrow & SLA", color: "#00D395" },
      { id: 3, from: "zeta", to: "polygon", label: "gateway.call()", desc: "mint 订单凭证", color: "#00D395" },
      { id: 4, from: "polygon", to: "polygon", label: "Receipt.update()", desc: "物流/签收回执", color: "#8247E5" },
      { id: 5, from: "zeta", to: "base", label: "gateway.withdraw()", desc: "确认放款 / 超时退款", color: "#00D395" },
    ],
    results: [
      { chain: "base", text: "商家收款或退款" },
      { chain: "zeta", text: "订单结算完成" },
      { chain: "polygon", text: "买家持有收据 NFT" },
    ],
  },
  {
    id: "multi-chain",
    title: "已连接 EVM 链上的 Universal NFT",
    subtitle: "需采用 Universal NFT 标准或升级现有 ERC-721",
    badge: "Planned",
    badgeColor: "#627EEA",
    chains: [
      { id: "eth", name: "Ethereum", role: "高价值 NFT", color: "#627EEA", Logo: EthereumLogo },
      { id: "zeta", name: "ZetaChain", role: "编排层", color: "#00D395", Logo: ZetaChainLogo },
      { id: "bsc", name: "BNB Chain", role: "GameFi NFT", color: "#F3BA2F", Logo: BSCLogo },
    ],
    steps: [
      { id: 1, from: "eth", to: "zeta", label: "depositAndCall()", desc: "ETH + Deal 信息", color: "#627EEA" },
      { id: 2, from: "zeta", to: "zeta", label: "UniversalMarket.onCall()", desc: "跨链路由决策", color: "#00D395" },
      { id: 3, from: "zeta", to: "eth", label: "gateway.withdraw()", desc: "ETH → 卖家", color: "#00D395" },
      { id: 4, from: "zeta", to: "bsc", label: "gateway.call()", desc: "释放 BNB 链 NFT", color: "#00D395" },
      { id: 5, from: "bsc", to: "bsc", label: "NFT 交付", desc: "GameFi 资产到账", color: "#F3BA2F" },
    ],
    results: [
      { chain: "eth", text: "卖家收到 ETH" },
      { chain: "zeta", text: "跨链完成" },
      { chain: "bsc", text: "买家收到 NFT" },
    ],
  },
  {
    id: "cross-swap",
    title: "跨链结算：买家 USDC → 卖家 ETH",
    subtitle: "USDC 付款，ETH 到账",
    badge: "Planned",
    badgeColor: "#9945FF",
    chains: [
      { id: "base", name: "Base", role: "源链 USDC", color: "#0052FF", Logo: USDCLogo },
      { id: "zeta", name: "ZetaChain", role: "DEX 路由", color: "#00D395", Logo: ZetaChainLogo },
      { id: "eth", name: "Ethereum", role: "卖家收款链", color: "#627EEA", Logo: EthereumLogo },
    ],
    steps: [
      { id: 1, from: "base", to: "zeta", label: "depositAndCall()", desc: "买家 Base USDC", color: "#0052FF" },
      { id: 2, from: "zeta", to: "zeta", label: "Swap USDC → ETH", desc: "ZetaChain DEX", color: "#00D395" },
      { id: 3, from: "zeta", to: "eth", label: "gateway.withdraw()", desc: "ETH → 卖家地址", color: "#00D395" },
      { id: 4, from: "eth", to: "eth", label: "ETH 到账", desc: "卖家收款完成", color: "#627EEA" },
    ],
    results: [
      { chain: "base", text: "买家付款完成" },
      { chain: "zeta", text: "兑换与路由完成" },
      { chain: "eth", text: "卖家收到 ETH" },
    ],
  },
];

// ============ Flow Visualization Component ============

function FlowVisualization({ scenario }: { scenario: Scenario }) {
  const [activeStep, setActiveStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    setActiveStep(0);
    setIsAutoPlaying(true);
  }, [scenario.id]);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % (scenario.steps.length + 2));
    }, 2000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, scenario.steps.length]);

  const getChainX = (chainId: string) => {
    const index = scenario.chains.findIndex((c) => c.id === chainId);
    return 100 + index * 200;
  };

  return (
    <div className="relative w-full">
      {/* Chain Headers */}
      <div className="flex justify-between mb-6 px-4">
        {scenario.chains.map((chain, index) => {
          const Logo = chain.Logo;
          return (
            <motion.div
              key={chain.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4, ease: easeOut }}
              className="flex flex-col items-center text-center flex-1"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2 border border-white/10"
                style={{
                  background: `linear-gradient(135deg, ${chain.color}22, ${chain.color}44)`,
                  boxShadow: `0 0 24px ${chain.color}33`
                }}
              >
                <Logo className="w-7 h-7" />
              </div>
              <div className="font-medium text-white/90 text-sm">{chain.name}</div>
              <div className="text-[10px] text-white/50 mt-0.5">{chain.role}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Flow Visualization */}
      <div className="relative h-[320px] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
        {/* Background Grid */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '32px 32px',
          }}
        />

        {/* SVG Flow Lines */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 320">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Vertical Chain Lines */}
          {scenario.chains.map((chain, i) => (
            <motion.line
              key={chain.id}
              x1={100 + i * 200}
              y1={15}
              x2={100 + i * 200}
              y2={305}
              stroke={chain.color}
              strokeWidth={2}
              strokeOpacity={0.25}
              strokeDasharray="6 6"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: i * 0.15 }}
            />
          ))}

          {/* Flow Arrows */}
          {scenario.steps.map((step, i) => {
            const fromX = getChainX(step.from);
            const toX = getChainX(step.to);
            const stepHeight = 280 / scenario.steps.length;
            const y = 30 + i * stepHeight + stepHeight / 2;
            const isActive = activeStep === i + 1;
            const isPast = activeStep > i + 1;

            if (fromX === toX) {
              return (
                <motion.g key={step.id}>
                  <motion.circle
                    cx={fromX}
                    cy={y}
                    r={isActive ? 10 : 6}
                    fill={step.color}
                    fillOpacity={isActive ? 0.8 : isPast ? 0.5 : 0.2}
                    filter={isActive ? "url(#glow)" : undefined}
                    animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 0.6, repeat: isActive ? Infinity : 0 }}
                  />
                </motion.g>
              );
            }

            return (
              <motion.g key={step.id}>
                <motion.path
                  d={`M ${fromX} ${y} Q ${(fromX + toX) / 2} ${y - 15} ${toX} ${y}`}
                  fill="none"
                  stroke={step.color}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  strokeOpacity={isActive ? 1 : isPast ? 0.6 : 0.2}
                  filter={isActive ? "url(#glow)" : undefined}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: isActive || isPast ? 1 : 0 }}
                  transition={{ duration: 0.6 }}
                />
                <motion.polygon
                  points={toX > fromX
                    ? `${toX - 6},${y - 4} ${toX},${y} ${toX - 6},${y + 4}`
                    : `${toX + 6},${y - 4} ${toX},${y} ${toX + 6},${y + 4}`
                  }
                  fill={step.color}
                  fillOpacity={isActive || isPast ? 1 : 0.2}
                />
                {isActive && (
                  <motion.circle
                    cx={fromX}
                    cy={y}
                    r={4}
                    fill={step.color}
                    filter="url(#glow)"
                    initial={{ cx: fromX, opacity: 0 }}
                    animate={{ cx: [fromX, toX], opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.5 }}
                  />
                )}
              </motion.g>
            );
          })}
        </svg>

        {/* Step Labels */}
        <div className="absolute inset-0 pointer-events-none">
          {scenario.steps.map((step, i) => {
            const fromX = getChainX(step.from);
            const toX = getChainX(step.to);
            const centerX = (fromX + toX) / 2;
            const stepHeight = 280 / scenario.steps.length;
            const y = 30 + i * stepHeight + stepHeight / 2;
            const isActive = activeStep === i + 1;

            return (
              <motion.div
                key={step.id}
                className="absolute transform -translate-x-1/2 pointer-events-auto cursor-pointer"
                style={{
                  left: `${(centerX / 600) * 100}%`,
                  top: `${((y - 28) / 320) * 100}%`
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: isActive ? 1 : 0.4 }}
                whileHover={{ opacity: 1, scale: 1.03 }}
                onClick={() => {
                  setIsAutoPlaying(false);
                  setActiveStep(i + 1);
                }}
              >
                <div
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white/5 text-white/60 border border-white/10'
                  }`}
                >
                  {step.label}
                </div>
                <div className="text-[9px] text-white/40 text-center mt-0.5">
                  {step.desc}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Results Row */}
        <motion.div
          className="absolute bottom-3 left-0 right-0 flex justify-between px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: activeStep > scenario.steps.length ? 1 : 0.25 }}
          transition={{ duration: 0.4 }}
        >
          {scenario.results.map((result, i) => {
            const chain = scenario.chains.find(c => c.id === result.chain);
            const Logo = chain?.Logo;
            return (
              <motion.div
                key={result.chain}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15"
                initial={{ y: 15, opacity: 0 }}
                animate={{
                  y: activeStep > scenario.steps.length ? 0 : 15,
                  opacity: activeStep > scenario.steps.length ? 1 : 0
                }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
              >
                {Logo && <Logo className="w-3.5 h-3.5" />}
                <span className="text-[10px] font-medium text-white/85">{result.text}</span>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-3 mt-4">
        <button
          onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
          className="p-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-colors ${
            isAutoPlaying
              ? 'bg-[var(--landing-accent)]/20 text-[var(--landing-accent)] border border-[var(--landing-accent)]/30'
              : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
          }`}
        >
          {isAutoPlaying ? '⏸ 暂停' : '▶ 播放'}
        </button>

        <button
          onClick={() => setActiveStep((prev) => Math.min(scenario.steps.length + 1, prev + 1))}
          className="p-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="flex gap-1 ml-3">
          {[0, ...scenario.steps.map((_, i) => i + 1), scenario.steps.length + 1].map((step) => (
            <button
              key={step}
              onClick={() => {
                setIsAutoPlaying(false);
                setActiveStep(step);
              }}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                activeStep === step
                  ? 'bg-[var(--landing-accent)] w-4'
                  : 'bg-white/25 hover:bg-white/45'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ Main Carousel Component ============

export function CrossChainFlow() {
  const [currentScenario, setCurrentScenario] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const goToScenario = (index: number) => {
    setCurrentScenario(Math.max(0, Math.min(scenarios.length - 1, index)));
  };

  return (
    <div className="relative w-full">
      {/* Scenario Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => goToScenario(currentScenario - 1)}
          disabled={currentScenario === 0}
          className="p-2 rounded-full bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            <span
              className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: `${scenarios[currentScenario].badgeColor}22`,
                color: scenarios[currentScenario].badgeColor,
                border: `1px solid ${scenarios[currentScenario].badgeColor}44`
              }}
            >
              {scenarios[currentScenario].badge}
            </span>
          </div>
          <h3 className="text-xl font-semibold text-white">
            {scenarios[currentScenario].title}
          </h3>
          <p className="text-sm text-white/50">
            {scenarios[currentScenario].subtitle}
          </p>
        </div>

        <button
          onClick={() => goToScenario(currentScenario + 1)}
          disabled={currentScenario === scenarios.length - 1}
          className="p-2 rounded-full bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Scenario Indicator Dots */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {scenarios.map((scenario, i) => (
          <button
            key={scenario.id}
            onClick={() => goToScenario(i)}
            className={`transition-all rounded-full ${
              currentScenario === i
                ? 'w-8 h-2 bg-[var(--landing-accent)]'
                : 'w-2 h-2 bg-white/25 hover:bg-white/45'
            }`}
          />
        ))}
      </div>

      {/* Flow Visualization */}
      <div ref={containerRef} className="overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={scenarios[currentScenario].id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: easeOut }}
          >
            <FlowVisualization scenario={scenarios[currentScenario]} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Scenario Quick Nav */}
      <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
        {scenarios.map((scenario, i) => (
          <button
            key={scenario.id}
            onClick={() => goToScenario(i)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              currentScenario === i
                ? 'bg-white/15 text-white border border-white/25'
                : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/75'
            }`}
          >
            {scenario.title}
          </button>
        ))}
      </div>
    </div>
  );
}
