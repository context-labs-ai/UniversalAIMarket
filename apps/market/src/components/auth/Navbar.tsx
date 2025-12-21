"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { CartButton } from "@/components/CartButton";
import { AgentConnectButton } from "@/components/agent";
import { ConnectButton } from "./ConnectButton";
import { getCurrentRole, type UserRole } from "@/lib/auth/dynamic";

interface NavbarProps {
  showAgentButton?: boolean;
  showCartButton?: boolean;
}

export function Navbar({ showAgentButton = true, showCartButton = true }: NavbarProps) {
  const [role, setRole] = useState<UserRole>("buyer");

  useEffect(() => {
    setRole(getCurrentRole());

    const handleRoleChange = () => setRole(getCurrentRole());
    window.addEventListener("storage", handleRoleChange);
    window.addEventListener("role-changed", handleRoleChange);

    return () => {
      window.removeEventListener("storage", handleRoleChange);
      window.removeEventListener("role-changed", handleRoleChange);
    };
  }, []);

  const isSeller = role === "seller";

  return (
    <nav className="z-50">
      <div className="mx-auto max-w-6xl px-5 pt-4">
        <div className="flex h-12 items-center justify-between gap-4">
          {/* 左侧：Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Logo size={32} />
            <span className="text-lg font-semibold tracking-tight hidden sm:block">
              Universal AI Market
            </span>
          </Link>

          {/* 右侧：操作区 */}
          <div className="flex items-center gap-2">
            {/* Agent 按钮 - 买家模式显示 */}
            {showAgentButton && !isSeller && <AgentConnectButton />}

            {/* 购物车 - 买家模式显示 */}
            {showCartButton && !isSeller && <CartButton />}

            {/* 卖家中心 - 卖家模式显示 */}
            {isSeller && (
              <Link
                href="/seller"
                className="glass-panel rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white/90 transition-colors hidden sm:block"
              >
                卖家中心
              </Link>
            )}

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
