"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Bot,
  ChevronDown,
  Globe,
  Handshake,
  Route,
  Scan,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Terminal,
  Volume2,
  VolumeX,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CrossChainFlow } from "./CrossChainFlow";
import { ExplosiveTitle, type ExplosiveTitleHandle } from "./ExplosiveTitle";
import { Logo } from "@/components/Logo";

// Section 配置
const sections = [
  { id: "intro", label: "开场" },
  { id: "hero", label: "主页" },
  { id: "why-agentic", label: "趋势" },
  { id: "why-web3", label: "Web3" },
  { id: "zetachain", label: "ZetaChain" },
  { id: "comparison", label: "对比" },
  { id: "cross-chain", label: "技术" },
  { id: "protocol", label: "协议" },
  { id: "flow", label: "流程" },
  { id: "cta", label: "开始" },
];

// PageDots 导航组件
function PageDots({
  activeSection,
  onNavigate,
  visible,
}: {
  activeSection: string;
  onNavigate: (id: string) => void;
  visible: boolean;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          className="page-dots"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`page-dot ${activeSection === section.id ? "active" : ""}`}
              onClick={() => onNavigate(section.id)}
              aria-label={`跳转到${section.label}`}
            >
              <span className="page-dot-tooltip">{section.label}</span>
            </button>
          ))}
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];
const easeInOut: [number, number, number, number] = [0.42, 0, 0.58, 1];

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const fadeUpVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOut },
  },
};

const stats = [
  { label: "发现", value: "Agent 可读清单" },
  { label: "鉴权", value: "EIP-191 签名" },
  { label: "协商", value: "多智能体博弈" },
  { label: "结算", value: "ZetaChain 跨链" },
];

// Agentic 趋势拐点
const tippingPoints = [
  {
    title: "技术拐点",
    desc: "模型的结构化输出与工具调用更可靠，能把「建议」变成「可执行的动作序列」。",
    icon: Bot,
  },
  {
    title: "体验拐点",
    desc: "用户越来越愿意把任务型动作外包给系统：补货、比条款、下单、对账、售后。",
    icon: ShoppingBag,
  },
  {
    title: "成本拐点",
    desc: "自动化会放大「纠纷/风控/对账」的成本；如果承诺不可验证、状态不可追溯，规模越大越痛。",
    icon: ShieldCheck,
  },
  {
    title: "结算拐点",
    desc: "当交易跨主体/跨地区/跨平台时，结算与分账的摩擦会吞噬掉自动化带来的效率红利。",
    icon: Wallet,
  },
];

// Web3 适配场景
const web3Scenarios = [
  {
    title: "跨主体/跨平台",
    desc: "买家、卖家、agent、履约方不属于同一平台，难以共同信任同一个中心化记账方。",
  },
  {
    title: "跨境/稳定币结算",
    desc: "需要更快的清结算与更清晰的分账规则，尤其是多方分润。",
  },
  {
    title: "链上资产交付",
    desc: "交付物本身在链上（NFT、链上权限、凭证/收益权），结算与交付天然耦合。",
  },
  {
    title: "多方托管与条件付款",
    desc: "需要 escrow（里程碑、验收、可撤销、超时自动退款），且希望规则透明可验证。",
  },
];

// ZetaChain 优势
const zetaAdvantages = [
  {
    title: "Universal App 抽象",
    desc: "把跨链消息/资产交互作为应用原生能力，让合约能用更统一的方式编排多链动作。",
    icon: Globe,
  },
  {
    title: "Gas/执行体验",
    desc: "把「去目标链还得准备目标链 gas」的摩擦尽可能抽象掉，更利于 agent 自动执行。",
    icon: Sparkles,
  },
  {
    title: "产品一致性",
    desc: "把跨链编排收敛到一个「执行平面」，减少「每条链一套逻辑」的碎片化。",
    icon: Route,
  },
];

const endpoints = [
  {
    method: "GET",
    path: "/.well-known/universal-ai-market.json",
    desc: "智能体发现清单",
    methodColor: "bg-emerald-500/20 text-emerald-400",
  },
  {
    method: "POST",
    path: "/api/auth/challenge",
    desc: "EIP-191 挑战",
    methodColor: "bg-blue-500/20 text-blue-400",
  },
  {
    method: "POST",
    path: "/api/auth/verify",
    desc: "签名验证",
    methodColor: "bg-blue-500/20 text-blue-400",
  },
  {
    method: "GET/POST",
    path: "/api/agent/tool",
    desc: "工具调用",
    methodColor: "bg-amber-500/20 text-amber-400",
  },
  {
    method: "SSE",
    path: "/api/settle/stream",
    desc: "结算流",
    methodColor: "bg-purple-500/20 text-purple-400",
  },
];

const steps = [
  {
    step: "01",
    title: "发现",
    desc: "获取市场清单与能力集。",
    icon: Scan,
  },
  {
    step: "02",
    title: "鉴权",
    desc: "签一次挑战消息，即可安全交易。",
    icon: ShieldCheck,
  },
  {
    step: "03",
    title: "协商",
    desc: "买卖智能体持续报价直至满足意图。",
    icon: Handshake,
  },
  {
    step: "04",
    title: "结算",
    desc: "跨链路由资产并托管，回执透明。",
    icon: Route,
  },
];

const comparisons = [
  {
    title: "传统电商",
    desc: "以「人」为中心：页面、搜索、营销转化",
    bullets: [
      "用户逐一比价、沟通、下单",
      "依赖中心化平台记账与仲裁",
      "跨境/跨平台结算摩擦大",
      "自动化难以验证与追溯",
    ],
    tone: "border-[#b9bbad]/30 text-[#d5d8cc]",
    icon: "old",
  },
  {
    title: "Agentic 电商",
    desc: "以「agent 的执行」为中心：协议、工具、结算",
    bullets: [
      "智能体代理协商、比价、执行",
      "开放结算层，无需信任中心化平台",
      "跨链原子化结算，一次意图全搞定",
      "全程可验证、可追溯、可审计",
    ],
    tone: "border-[#a8b060]/30 text-[#c5d080]",
    icon: "new",
  },
];

export function LandingPage() {
  const [introReady, setIntroReady] = useState(false);
  const [introDismissed, setIntroDismissed] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [waitingForTop, setWaitingForTop] = useState(false);
  const [activeSection, setActiveSection] = useState("intro");
  const [showIntroFx, setShowIntroFx] = useState(true);
  const titleRef = useRef<ExplosiveTitleHandle | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const hasCheckedScroll = useRef(false);
  const lastIntroReplayAt = useRef(0);
  const audioArmedRef = useRef(false);
  const hideIntroTimerRef = useRef<number | null>(null);
  const pendingHideRef = useRef(false);
  const hasLeftIntroRef = useRef(false);

  const getScrollOffset = useCallback(() => {
    const containerTop = containerRef.current?.scrollTop ?? 0;
    return Math.max(window.scrollY, containerTop);
  }, []);

  const clearIntroHideTimer = useCallback(() => {
    if (hideIntroTimerRef.current !== null) {
      window.clearTimeout(hideIntroTimerRef.current);
      hideIntroTimerRef.current = null;
    }
    pendingHideRef.current = false;
  }, []);

  // IntersectionObserver 检测当前可见区块
  useEffect(() => {
    if (!introDismissed) return;

    const observerOptions = {
      root: containerRef.current,
      rootMargin: "-20% 0px -60% 0px",
      threshold: 0,
    };

    const observerCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [introDismissed]);

  // 导航到指定区块
  const navigateToSection = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element && containerRef.current) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const scrollToSection = useCallback((id: string) => {
    const container = containerRef.current;
    const el = document.getElementById(id);
    if (!container || !el) return;
    container.scrollTo({ top: el.offsetTop, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (activeSection === "intro") setShowIntroFx(true);
  }, [activeSection]);

  // Check initial scroll position on mount
  useEffect(() => {
    if (hasCheckedScroll.current) return;
    hasCheckedScroll.current = true;

    // If scrolled down on load, wait for user to scroll to top.
    // Double-rAF to allow the browser to restore scroll position after refresh.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (getScrollOffset() > 50) setWaitingForTop(true);
      });
    });
  }, [getScrollOffset]);

  // When waiting for top and user scrolls to top, allow animation to start
  useEffect(() => {
    if (!waitingForTop) return;

    const handleScroll = () => {
      if (getScrollOffset() <= 10) {
        setWaitingForTop(false);
        setIntroReady(false);
        setIntroDismissed(false);
        setShowIntroFx(true);
        hasLeftIntroRef.current = false;
        clearIntroHideTimer();
        titleRef.current?.reset();
      }
    };

    const container = containerRef.current;
    window.addEventListener("scroll", handleScroll, { passive: true });
    container?.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      container?.removeEventListener("scroll", handleScroll);
    };
  }, [clearIntroHideTimer, getScrollOffset, waitingForTop]);

  // Replay intro when user scrolls back to the very top after dismissing (same page load).
  useEffect(() => {
    if (waitingForTop) return;

    const handleScroll = () => {
      if (!introDismissed) return;
      const offset = getScrollOffset();
      if (offset > 10) {
        if (!hasLeftIntroRef.current) {
          hasLeftIntroRef.current = true;
        }
        if (pendingHideRef.current) {
          pendingHideRef.current = false;
          setShowIntroFx(false);
        }
        return;
      }

      if (!hasLeftIntroRef.current) return;

      const now = performance.now();
      if (now - lastIntroReplayAt.current < 800) return;
      lastIntroReplayAt.current = now;

      setIntroDismissed(false);
      setIntroReady(false);
      setShowIntroFx(true);
      clearIntroHideTimer();
      hasLeftIntroRef.current = false;
      titleRef.current?.reset();
    };

    const container = containerRef.current;
    window.addEventListener("scroll", handleScroll, { passive: true });
    container?.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      container?.removeEventListener("scroll", handleScroll);
    };
  }, [clearIntroHideTimer, getScrollOffset, introDismissed, waitingForTop]);

  const armAudio = useCallback(async () => {
    if (!soundEnabled) return;
    if (audioArmedRef.current) return;

    const success = await titleRef.current?.enableAudio();
    if (success) {
      titleRef.current?.setMuted(false);
      audioArmedRef.current = true;
    }
  }, [soundEnabled]);

  // Autoplay audio is blocked until a user gesture; default is "on" and we arm on first gesture.
  useEffect(() => {
    if (!soundEnabled) return;
    if (audioArmedRef.current) return;

    const handleGesture = () => {
      void armAudio();
    };

    window.addEventListener("pointerdown", handleGesture, { once: true, passive: true });
    window.addEventListener("keydown", handleGesture, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handleGesture);
      window.removeEventListener("keydown", handleGesture);
    };
  }, [armAudio, soundEnabled]);

  const toggleSound = useCallback(async () => {
    if (soundEnabled) {
      titleRef.current?.setMuted(true);
      setSoundEnabled(false);
      return;
    }

    // Click is a user gesture, so enabling audio here should succeed.
    setSoundEnabled(true);
    await armAudio();
  }, [armAudio, soundEnabled]);

  const triggerExit = useCallback(() => {
    if (!introReady || introDismissed || waitingForTop) return;
    clearIntroHideTimer();
    hasLeftIntroRef.current = false;
    setIntroDismissed(true);
    titleRef.current?.disperse();

    // Allow className to flip to `snap-container` before scrolling the container.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToSection("hero");
      });
    });

    // Hide the intro canvas after the disperse finishes so it won't remain as a background.
    hideIntroTimerRef.current = window.setTimeout(() => {
      if (getScrollOffset() > 10) {
        setShowIntroFx(false);
      } else {
        pendingHideRef.current = true;
      }
    }, 1300);
  }, [clearIntroHideTimer, getScrollOffset, introReady, introDismissed, scrollToSection, waitingForTop]);

  // Lock scroll during intro animation
  useEffect(() => {
    if (waitingForTop) {
      document.body.style.overflow = "";
      return;
    }

    if (introDismissed) {
      // Unlock scroll
      document.body.style.overflow = "";
      return;
    }

    // Lock scroll during animation
    document.body.style.overflow = "hidden";

    const handleWheel = (event: WheelEvent) => {
      // Always prevent scroll during intro
      event.preventDefault();
      // Trigger exit only when animation is ready
      if (introReady && event.deltaY > 0) {
        triggerExit();
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchStartY.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      // Prevent touch scroll during intro
      if (!introDismissed) {
        event.preventDefault();
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (!introReady) return;
      const startY = touchStartY.current;
      const endY = event.changedTouches[0]?.clientY ?? null;
      if (startY !== null && endY !== null && startY - endY > 40) {
        triggerExit();
      }
      touchStartY.current = null;
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [introReady, introDismissed, waitingForTop, triggerExit]);

  // Remove scroll-back-to-top reset to prevent animation replay
  // Animation only plays once per page load

  return (
    <div
      ref={containerRef}
      className={`landing-theme relative bg-[var(--landing-bg)] text-[var(--landing-text)] selection:bg-[rgba(185,187,173,0.45)] selection:text-[#0a0908] ${introDismissed ? "snap-container" : "overflow-hidden"
        }`}
    >
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="landing-grid absolute inset-0" />
        <div className="landing-noise absolute inset-0" />
        {/* Warm luxury orbs - Amber + Cream + Gold */}
        <div
          className="landing-orb absolute -top-40 -left-32 h-[420px] w-[420px] rounded-full animate-float-slow"
          style={{
            background: "radial-gradient(circle at 30% 30%, rgba(212, 165, 116, 0.5), transparent 60%)",
          }}
        />
        <div
          className="landing-orb absolute bottom-[-20%] right-[-10%] h-[520px] w-[520px] rounded-full animate-float-slower"
          style={{
            background: "radial-gradient(circle at 40% 40%, rgba(201, 149, 108, 0.4), transparent 65%)",
          }}
        />
        <div
          className="landing-orb absolute top-[15%] right-[20%] h-[260px] w-[260px] rounded-full"
          style={{
            background: "radial-gradient(circle at 40% 40%, rgba(232, 213, 163, 0.35), transparent 60%)",
          }}
        />
      </div>

      <PageDots
        activeSection={activeSection}
        onNavigate={navigateToSection}
        visible={introDismissed}
      />

      {showIntroFx ? (
        <ExplosiveTitle ref={titleRef} onComplete={() => setIntroReady(true)} skip={waitingForTop} />
      ) : null}

      {/* Sound Toggle Button */}
      <motion.button
        type="button"
        onClick={toggleSound}
        aria-label={soundEnabled ? "关闭音效" : "开启音效"}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/70 backdrop-blur-md transition-all hover:border-white/40 hover:bg-black/60 hover:text-white"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {soundEnabled ? (
          <Volume2 className="h-5 w-5" />
        ) : (
          <VolumeX className="h-5 w-5" />
        )}
      </motion.button>

      <section id="intro" className="snap-section relative z-10 flex min-h-screen items-end justify-center px-6 pb-10 text-center">
        {introReady && !introDismissed && !waitingForTop ? (
          <motion.div
            className="flex flex-col items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            <motion.div
              className="text-[11px] uppercase tracking-[0.35em] text-white/50"
              animate={{ opacity: [0.35, 0.7, 0.35] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: easeInOut }}
            >
              向下探索
            </motion.div>
            <motion.button
              type="button"
              onClick={triggerExit}
              aria-label="向下滚动"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 p-3 text-white/70 backdrop-blur transition hover:border-white/40 hover:text-white"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: easeInOut }}
            >
              <ChevronDown className="h-5 w-5" />
            </motion.button>
          </motion.div>
        ) : null}
      </section>

      {/* 主页：概括性介绍 */}
      <motion.section
        id="hero"
        className="snap-section relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-6 px-6 py-16 text-center"
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
      >
        <div className="flex flex-col items-center relative z-20">
          {/* 1. Logo Glow Anchor */}
          <motion.div variants={fadeUpVariants} className="mb-10 relative">
            <div className="absolute inset-0 bg-amber-500/20 blur-[60px] rounded-full animate-pulse-slow" />
            <Logo size={140} animated />
          </motion.div>

          {/* 2. Massive Title */}
          <motion.h2
            variants={fadeUpVariants}
            className="font-display text-4xl leading-[1.05] md:text-5xl lg:text-6xl tracking-tight text-center max-w-4xl mx-auto"
          >
            <span className="block text-white">AI 智能体的</span>
            <span className="block bg-gradient-to-r from-[#d4a574] via-[#e8d5a3] to-[#c8d86a] bg-clip-text text-transparent pb-3">
              跨链原生市场
            </span>
          </motion.h2>

          <motion.p
            variants={fadeUpVariants}
            className="mx-auto mt-6 max-w-2xl text-lg text-[var(--landing-muted)] leading-relaxed text-center"
          >
            <span className="text-white/90">买家 Agent</span> 发现商品、协商条款；
            <span className="text-white/90">卖家 Agent</span> 自动报价、管理库存。
            <br className="hidden md:block" />
            双向 Agent 友好，跨链完成<span className="text-white/90">可验证的交易与结算</span>。
          </motion.p>

          {/* 4. Agent Connection Visual (Subtle -> Clearer) */}
          <motion.div
            variants={fadeUpVariants}
            className="mt-10 flex items-center gap-4 text-xs font-mono uppercase tracking-widest"
          >
            <span className="text-indigo-300 drop-shadow-[0_0_8px_rgba(165,180,252,0.5)]">Buyer Agent</span>
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
            <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse shadow-[0_0_10px_white]" />
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
            <span className="text-emerald-300 drop-shadow-[0_0_8px_rgba(110,231,183,0.5)]">Seller Agent</span>
          </motion.div>

          {/* 5. Primary Actions */}
          <motion.div variants={fadeUpVariants} className="mt-10 flex flex-col items-center justify-center gap-5 sm:flex-row">
            <Link
              href="/dashboard"
              className="group relative inline-flex h-14 items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-10 text-sm font-bold text-black transition-all hover:bg-gray-200 hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              <span className="relative z-10 flex items-center gap-2">
                进入市场 <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <Link
              href="/.well-known/universal-ai-market.json"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-white/10 px-8 text-sm font-semibold text-white/40 transition-colors hover:border-white/20 hover:text-white/60 hover:bg-white/5 backdrop-blur-md"
            >
              智能体清单 <Terminal className="h-4 w-4" />
            </Link>
          </motion.div>

          {/* 6. Bottom HUD / Stats Grid */}
          <motion.div
            variants={fadeUpVariants}
            className="mt-20 w-full max-w-4xl"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md shadow-2xl shadow-black/50">
              {stats.map((stat, i) => (
                <div key={stat.label} className="bg-[#0a0908]/80 p-6 flex flex-col items-center text-center gap-2 hover:bg-[#0a0908]/60 transition-colors">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--landing-accent)] opacity-70">
                    {stat.label}
                  </div>
                  <div className="text-sm font-medium text-white/90">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Powered by ZetaChain (Small footer) */}
          <motion.div
            variants={fadeUpVariants}
            className="mt-8 flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#00DC82] font-mono shadow-[#00DC82]/20 drop-shadow-lg"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Powered by ZetaChain
          </motion.div>
        </div>
      </motion.section>

      {/* 为什么 Agentic Ecommerce 是趋势 */}
      <section id="why-agentic" className="snap-section relative mx-auto max-w-7xl px-6 py-24">
        {/* Ambient Background Glow */}
        <div className="absolute left-1/2 top-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 opacity-20 blur-[120px] bg-[radial-gradient(circle,rgba(212,165,116,0.3)_0%,transparent_70%)] pointer-events-none" />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="text-center relative z-10"
        >
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-sm"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--landing-accent)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--landing-accent)]"></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--landing-accent)]">
              为什么现在
            </span>
          </motion.div>

          <motion.h2
            variants={fadeUpVariants}
            className="mt-8 font-display text-3xl leading-tight md:text-4xl lg:text-5xl"
          >
            AI Agent 正在从<br className="md:hidden" />
            「<span className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">会说话</span>」
            变成
            「<span className="bg-gradient-to-r from-[#d4a574] to-[#f3eacb] bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(212,165,116,0.4)]">能执行</span>」
          </motion.h2>

          <motion.p
            variants={fadeUpVariants}
            className="mx-auto mt-8 max-w-3xl text-lg text-[var(--landing-muted)] leading-relaxed"
          >
            购物有两种主模式——<span className="text-white font-medium border-b border-white/20 pb-0.5">体验型</span>（逛/刷/被种草）和<span className="text-white font-medium border-b border-white/20 pb-0.5">任务型</span>（把事办了）。
            <br />
            我们在优化后者：补货、比条款、下单、对账、售后。
          </motion.p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="relative mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          {tippingPoints.map((point, index) => {
            const Icon = point.icon;
            return (
              <motion.div
                key={point.title}
                variants={fadeUpVariants}
                whileHover={{ y: -8 }}
                className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-8 backdrop-blur-md transition-all duration-500 hover:border-white/20 hover:bg-white/[0.09] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]"
              >
                {/* Hover Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--landing-accent)]/10 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                {/* Icon Box */}
                <div className="relative z-10 mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:bg-[var(--landing-accent)]/20 group-hover:border-[var(--landing-accent)]/30">
                  <Icon className="h-7 w-7 text-[var(--landing-accent)] transition-colors duration-300 group-hover:text-[#f3eacb]" />
                </div>

                {/* Title */}
                <h3 className="relative z-10 text-xl font-bold text-white transition-colors duration-300 group-hover:text-[var(--landing-accent-light)]">
                  {point.title}
                </h3>

                {/* Desc */}
                <p className="relative z-10 mt-4 text-sm leading-relaxed text-white/60 transition-colors duration-300 group-hover:text-white/90">
                  {point.desc}
                </p>

                {/* Subtle Back Number */}
                <div className="absolute -right-4 -top-8 rotate-12 font-display text-[140px] font-bold leading-none text-white/[0.02] transition-transform duration-700 group-hover:rotate-[20deg] group-hover:scale-110 select-none pointer-events-none">
                  0{index + 1}
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mt-16 flex justify-center"
        >
          <div className="relative overflow-hidden rounded-full border border-white/10 bg-white/5 px-8 py-3 backdrop-blur-md">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
            <p className="relative text-sm text-[var(--landing-muted)]">
              <span className="text-white/80 font-semibold mr-1">Gartner 预测：</span>
              到 2026 年底，
              <span className="text-[var(--landing-accent)] font-bold text-lg mx-1">40%</span>
              的企业应用将集成任务特定 AI agents
            </p>
          </div>
        </motion.div>
      </section>

      {/* 为什么 Web3 */}
      <section id="why-web3" className="snap-section relative overflow-hidden px-6 py-24">
        {/* Decorative background for Web3 */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[radial-gradient(circle,rgba(178,199,58,0.03)_0%,transparent_70%)] opacity-60" />
          <div className="absolute right-0 top-0 h-full w-1/4 bg-gradient-to-l from-[var(--landing-accent-highlight)]/[0.02] to-transparent" />
        </div>

        <motion.div
          className="mx-auto max-w-6xl relative z-10"
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
        >
          <div className="grid gap-16 lg:grid-cols-2 items-center">
            <div className="flex flex-col gap-6">
              <motion.div variants={fadeUpVariants}>
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--landing-accent-highlight)]/20 bg-[var(--landing-accent-highlight)]/5 px-4 py-1.5 backdrop-blur-sm mb-6">
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--landing-accent-highlight)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--landing-accent-highlight)]"></span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--landing-accent-highlight)]">
                    Why Web3
                  </span>
                </div>
                <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-white leading-tight">
                  当参与方<br />
                  <span className="bg-gradient-to-r from-[var(--landing-accent-highlight)] to-[var(--landing-accent)] bg-clip-text text-transparent">不在同一平台</span>
                </h2>
              </motion.div>

              <motion.p
                variants={fadeUpVariants}
                className="text-lg text-[var(--landing-muted)] leading-relaxed max-w-lg"
              >
                Web2 支付在闭环平台里依然更优。但当交易变成开放网络里的多方协作时，
                需要一层更<span className="text-white font-medium border-b border-white/10">可验证、可组合</span>的结算与承诺机制。
              </motion.p>

              <motion.div
                variants={fadeUpVariants}
                className="mt-4 p-8 rounded-[2rem] border border-[var(--landing-accent-highlight)]/10 bg-white/[0.02] backdrop-blur-xl relative overflow-hidden group shadow-2xl shadow-black/20"
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[var(--landing-accent-highlight)]/40 to-transparent" />
                <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-[var(--landing-accent-highlight)]/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />

                <p className="text-base text-white/70 italic leading-relaxed relative z-10">
                  <span className="text-3xl font-serif text-[var(--landing-accent-highlight)]/30 mr-2 leading-none">“</span>
                  越开放、越多方、越自动化，越需要把承诺与结算从私有系统里抽出来做成可验证接口。
                  <span className="text-3xl font-serif text-[var(--landing-accent-highlight)]/30 ml-1 leading-none">”</span>
                </p>
              </motion.div>
            </div>

            <motion.div
              variants={containerVariants}
              className="grid gap-5"
            >
              {web3Scenarios.map((scenario, index) => (
                <motion.div
                  key={scenario.title}
                  variants={fadeUpVariants}
                  whileHover={{ x: 12, backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(178,199,58,0.2)" }}
                  className="group relative rounded-3xl border border-white/5 bg-white/[0.015] p-6 flex gap-6 transition-all duration-500 hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-[var(--landing-accent-highlight)] shadow-inner group-hover:scale-110 group-hover:bg-[var(--landing-accent-highlight)]/10 group-hover:border-[var(--landing-accent-highlight)]/20 transition-all duration-500">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="flex flex-col justify-center">
                    <h3 className="text-lg font-bold text-white transition-colors duration-300 group-hover:text-[var(--landing-accent-highlight)]">
                      {scenario.title}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--landing-muted)] leading-relaxed transition-colors duration-300 group-hover:text-white/70">
                      {scenario.desc}
                    </p>
                  </div>

                  {/* Subtle corner accent */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--landing-accent-highlight)]/40 blur-[1px]" />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ZetaChain 优势 */}
      <section id="zetachain" className="snap-section relative mx-auto max-w-6xl overflow-hidden px-6 py-16">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute left-1/2 top-6 h-40 w-[520px] -translate-x-1/2 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(circle at center, rgba(178,199,58,0.15), rgba(221,225,210,0.04) 45%, transparent 70%)",
            }}
          />
          <div
            className="absolute -right-10 bottom-0 h-52 w-72 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, rgba(201,149,108,0.18), transparent 65%)",
            }}
          />
        </div>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="text-center"
        >
          <motion.p
            variants={fadeUpVariants}
            className="text-xs uppercase tracking-[0.4em] text-[var(--landing-muted)]"
          >
            <span className="inline-flex items-center rounded-full border border-[var(--landing-accent-highlight)]/40 bg-[var(--landing-accent-highlight)]/15 px-4 py-1 text-[10px] font-semibold tracking-[0.5em] text-[var(--landing-accent-highlight)] shadow-[0_0_18px_rgba(178,199,58,0.18)]">
              ZetaChain
            </span>
          </motion.p>
          <motion.h2
            variants={fadeUpVariants}
            className="mt-4 font-display text-3xl md:text-4xl lg:text-5xl tracking-tight text-white"
          >
            一次意图，<span className="glow-keyword-strong">多链执行</span>
          </motion.h2>
          <motion.p
            variants={fadeUpVariants}
            className="mx-auto mt-4 max-w-2xl text-base text-[var(--landing-muted)]"
          >
            用户资产/支付可能在不同链。如果用单一主链 + 外部跨链协议，复杂度会成为产品的一部分。
            ZetaChain 把跨链编排收敛到一个执行平面。
          </motion.p>
          <motion.div
            variants={fadeUpVariants}
            className="mx-auto mt-6 h-px w-24 bg-gradient-to-r from-transparent via-[var(--landing-accent-highlight)]/50 to-transparent"
          />
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="mt-12 grid gap-6 md:grid-cols-3"
        >
          {zetaAdvantages.map((advantage) => {
            const Icon = advantage.icon;
            return (
              <motion.div
                key={advantage.title}
                variants={fadeUpVariants}
                whileHover={{ y: -6 }}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[var(--landing-card)] p-6 transition-all duration-500 hover:border-[var(--landing-accent-highlight)]/35 hover:bg-white/[0.04]"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[var(--landing-accent-highlight)]/10 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="relative mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--landing-accent-highlight)]/30 bg-[var(--landing-accent-highlight)]/10 shadow-[0_10px_30px_-18px_rgba(178,199,58,0.8)]">
                  <Icon className="h-5 w-5 text-[var(--landing-accent-highlight)]" />
                </div>
                <h3 className="relative text-lg font-semibold text-white/90">{advantage.title}</h3>
                <p className="relative mt-3 text-sm text-[var(--landing-muted)] leading-relaxed">{advantage.desc}</p>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="relative mt-10 overflow-hidden rounded-3xl border border-white/10 bg-[var(--landing-card)] p-6"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/[0.04] via-transparent to-white/[0.02]" />
          <div className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[var(--landing-accent-highlight)]/40 via-transparent to-transparent" />
          <h3 className="relative mb-4 text-sm font-semibold text-white/90">为什么 ZetaChain 和 Agent 很适配</h3>
          <div className="relative grid gap-4 md:grid-cols-2">
            <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-all duration-300 hover:border-[var(--landing-accent-highlight)]/30 hover:bg-white/[0.04]">
              <div className="flex items-start gap-3">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--landing-accent)]" />
                <p className="text-sm text-[var(--landing-muted)]">
                  <span className="text-white/80">单一执行平面</span>：Agent 编排最怕「到处对接、到处出错」
                </p>
              </div>
            </div>
            <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-all duration-300 hover:border-[var(--landing-accent-highlight)]/30 hover:bg-white/[0.04]">
              <div className="flex items-start gap-3">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--landing-accent)]" />
                <p className="text-sm text-[var(--landing-muted)]">
                  <span className="text-white/80">更少集成分支</span>：不用为每条链写一套工具与异常处理
                </p>
              </div>
            </div>
            <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-all duration-300 hover:border-[var(--landing-accent-highlight)]/30 hover:bg-white/[0.04]">
              <div className="flex items-start gap-3">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--landing-accent)]" />
                <p className="text-sm text-[var(--landing-muted)]">
                  <span className="text-white/80">更好的自动执行</span>：gas/跨链摩擦越少，Agent 越能把「计划」变成「完成」
                </p>
              </div>
            </div>
            <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-all duration-300 hover:border-[var(--landing-accent-highlight)]/30 hover:bg-white/[0.04]">
              <div className="flex items-start gap-3">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--landing-accent)]" />
                <p className="text-sm text-[var(--landing-muted)]">
                  <span className="text-white/80">事件驱动</span>：跨链回执可以驱动 Agent 的下一步决策
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 对比：传统电商 vs Agentic 电商 */}
      <section id="comparison" className="snap-section mx-auto max-w-6xl px-6 py-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="text-center mb-12"
        >
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-sm"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--landing-accent)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--landing-accent)]"></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--landing-accent)]">
              对比
            </span>
          </motion.div>
          <motion.h2
            variants={fadeUpVariants}
            className="mt-6 font-display text-3xl md:text-4xl lg:text-5xl"
          >
            从<span className="glow-keyword">人工驱动</span>到<span className="glow-keyword-strong">智能体驱动</span>
          </motion.h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="grid gap-6 lg:grid-cols-2"
        >
          {comparisons.map((item) => (
            <motion.div
              key={item.title}
              variants={fadeUpVariants}
              whileHover={{ y: -4 }}
              className={`rounded-3xl border bg-[var(--landing-card)] p-6 ${item.icon === "new" ? "border-[var(--landing-accent)]/30" : "border-white/10"}`}
            >
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${item.tone}`}>
                {item.icon === "old" ? "❌" : "✓"} {item.title}
              </div>
              <p className="mt-4 text-sm text-[var(--landing-muted)]">{item.desc}</p>
              <ul className="mt-5 space-y-3 text-sm text-white/70">
                {item.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3">
                    <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${item.icon === "new" ? "bg-[var(--landing-accent)]" : "bg-white/30"}`} />
                    {bullet}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Cross-Chain Flow Section：技术细节 */}
      <section id="cross-chain" className="snap-section mx-auto max-w-5xl px-6 py-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="text-center mb-6"
        >
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-sm"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--landing-accent-highlight)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--landing-accent-highlight)]"></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--landing-accent-highlight)]">
              跨链魔法
            </span>
          </motion.div>
          <motion.h2
            variants={fadeUpVariants}
            className="mt-4 font-display text-3xl md:text-4xl lg:text-5xl"
          >
            一笔签名，<span className="glow-keyword-strong">三链联动</span>。
          </motion.h2>
          <motion.p
            variants={fadeUpVariants}
            className="mx-auto mt-3 max-w-2xl text-sm text-[var(--landing-muted)]"
          >
            覆盖 NFT、实体商品与跨链结算：买家在 Base 付款，ZetaChain 编排结算，权益/订单凭证在目标链更新。
            关键链上动作原子化、可追溯，可与线下履约衔接。
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: easeOut }}
        >
          <CrossChainFlow />
        </motion.div>
      </section>

      <section id="protocol" className="snap-section mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[0.95fr_1.05fr]">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
        >
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-sm"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--landing-accent-secondary)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--landing-accent-secondary)]"></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--landing-accent-secondary)]">
              协议入口
            </span>
          </motion.div>
          <motion.h2
            variants={fadeUpVariants}
            className="mt-6 font-display text-3xl md:text-4xl lg:text-5xl"
          >
            简洁 API，<span className="glow-keyword">MCP 就绪</span>。
          </motion.h2>
          <motion.p
            variants={fadeUpVariants}
            className="mt-4 text-base text-[var(--landing-muted)]"
          >
            当前提供轻量 HTTP + SSE 接口，即将支持 MCP Server——届时 Claude、Cursor 等原生 MCP 客户端可直接连接，无需额外适配。
          </motion.p>
          <motion.div
            variants={fadeUpVariants}
            className="mt-8 flex flex-wrap gap-3 text-xs"
          >
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">EIP-191 鉴权</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">智能体工具调用</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">结算 SSE</span>
            <span className="rounded-full border border-[#00DC82]/30 bg-[#00DC82]/10 px-3 py-1 text-[#00DC82]">MCP Soon™</span>
          </motion.div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="rounded-3xl border border-white/10 bg-[var(--landing-card)] p-6"
        >
          <motion.div
            variants={fadeUpVariants}
            className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-[var(--landing-muted)]"
          >
            <Terminal className="h-4 w-4" />
            HTTP 端点
          </motion.div>
          <motion.div variants={fadeUpVariants} className="mt-6 space-y-4">
            {endpoints.map((endpoint) => (
              <div
                key={endpoint.path}
                className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${endpoint.methodColor}`}>
                    {endpoint.method}
                  </span>
                  <span className="font-mono text-xs text-white/80">{endpoint.path}</span>
                </div>
                <span className="text-xs text-[var(--landing-muted)]">{endpoint.desc}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      <section id="flow" className="snap-section mx-auto max-w-6xl px-6 py-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="text-center"
        >
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-sm"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--landing-accent)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--landing-accent)]"></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--landing-accent)]">
              流程
            </span>
          </motion.div>
          <motion.h2
            variants={fadeUpVariants}
            className="mt-6 font-display text-3xl md:text-4xl lg:text-5xl"
          >
            从<span className="glow-keyword">意图</span>到<span className="glow-keyword">结算</span>的四步流程。
          </motion.h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.step}
                variants={fadeUpVariants}
                whileHover={{
                  scale: 1.03,
                  borderColor: "rgba(178, 199, 58, 0.3)",
                  transition: { duration: 0.2 }
                }}
                className="group relative rounded-3xl border border-white/10 bg-[var(--landing-card)] p-6 text-left transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(178,199,58,0.1)]"
              >
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[rgba(178,199,58,0.05)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative flex items-center justify-between">
                  <motion.span
                    className="font-display text-lg text-[var(--landing-accent-secondary)]"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.4 }}
                  >
                    {step.step}
                  </motion.span>
                  <motion.div
                    whileHover={{ rotate: 10, scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Icon className="h-5 w-5 text-[var(--landing-accent)] transition-colors duration-300 group-hover:text-[var(--landing-accent-secondary)]" />
                  </motion.div>
                </div>
                <h3 className="relative mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="relative mt-3 text-sm text-[var(--landing-muted)]">{step.desc}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </section>


      {/* CTA：进入市场 */}
      <section id="cta" className="snap-section mx-auto max-w-6xl px-6 pb-24 pt-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[var(--landing-card)] px-8 py-16 text-center"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[rgba(178,199,58,0.12)] via-transparent to-[rgba(185,187,173,0.1)]" />
          <motion.p
            variants={fadeUpVariants}
            className="relative text-xs uppercase tracking-[0.4em] text-[var(--landing-muted)]"
          >
            开始体验
          </motion.p>
          <motion.h2
            variants={fadeUpVariants}
            className="relative mt-4 font-display text-3xl md:text-4xl lg:text-5xl"
          >
            进入<span className="glow-keyword">市场</span>，剩下交给<span className="glow-keyword-strong">智能体</span>。
          </motion.h2>
          <motion.p
            variants={fadeUpVariants}
            className="relative mx-auto mt-4 max-w-2xl text-base text-[var(--landing-muted)]"
          >
            表达意图、连接钱包，让智能体完成发现、协商与跨链结算。
          </motion.p>
          <motion.div variants={fadeUpVariants} className="relative mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--landing-accent)] px-8 py-4 text-sm font-semibold text-[#0b0f14] transition-transform hover:-translate-y-0.5"
            >
              进入市场 <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/agent"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-8 py-4 text-sm font-semibold text-[var(--landing-text)] transition-colors hover:border-white/40"
            >
              智能体接入 <Terminal className="h-4 w-4" />
            </Link>
          </motion.div>
        </motion.div>

        <div className="mt-12 flex items-center justify-between text-xs text-[var(--landing-muted)]">
          <span>Universal AI Market</span>
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Powered by ZetaChain
          </span>
        </div>
      </section>
    </div>
  );
}
