"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { CartButton } from "@/components/CartButton";
import { AgentConnectButton } from "@/components/agent";
import { ConnectButton } from "./ConnectButton";

interface NavbarProps {
  showAgentButton?: boolean;
  showCartButton?: boolean;
}

export function Navbar({ showAgentButton = true, showCartButton = true }: NavbarProps) {
  return (
    <nav className="sticky top-0 z-50 bg-transparent backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* 左侧：Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Logo size={32} />
            <span className="text-lg font-semibold tracking-tight hidden sm:block">
              Universal AI Market
            </span>
          </Link>

          {/* 右侧：操作区 */}
          <div className="flex items-center gap-2">
            {/* Agent 按钮 */}
            {showAgentButton && <AgentConnectButton />}

            {/* 购物车 */}
            {showCartButton && <CartButton />}

            {/* API 文档 */}
            <Link
              href="/agent"
              className="glass-panel rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white/90 transition-colors hidden sm:block"
            >
              API
            </Link>

            {/* 用户菜单（登录/角色选择） */}
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
