"use client";

import { Wallet, LogOut, ChevronDown, ShoppingBag, Store, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { getCurrentRole, setCurrentRole, type UserRole, hasDynamicEnvironmentId } from "@/lib/auth/dynamic";

type DynamicContextHook = () => {
  user: unknown;
  primaryWallet: { address?: string } | null;
  sdkHasLoaded: boolean;
  setShowAuthFlow: (show: boolean) => void;
  handleLogOut: () => void;
};

export function ConnectButton() {
  const [showDropdown, setShowDropdown] = useState(false);
  const [role, setRole] = useState<UserRole>("buyer");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dynamicHook, setDynamicHook] = useState<DynamicContextHook | null>(null);

  // 初始化角色
  useEffect(() => {
    setRole(getCurrentRole());
  }, []);

  useEffect(() => {
    if (!hasDynamicEnvironmentId) return;
    import("@dynamic-labs/sdk-react-core")
      .then((mod) => setDynamicHook(() => mod.useDynamicContext))
      .catch(() => setDynamicHook(null));
  }, []);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
    setRole(newRole);
  };

  if (!hasDynamicEnvironmentId) {
    return (
      <div className="glass-panel flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm">
        <span className="text-white/60">未配置 Dynamic 环境</span>
      </div>
    );
  }

  if (!dynamicHook) {
    return (
      <div className="glass-panel flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm">
        <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white/80" />
        <span className="text-white/50">加载中...</span>
      </div>
    );
  }

  return (
    <ConnectButtonInner
      role={role}
      onRoleChange={handleRoleChange}
      dropdownRef={dropdownRef}
      showDropdown={showDropdown}
      setShowDropdown={setShowDropdown}
      useDynamicContext={dynamicHook}
    />
  );
}

function ConnectButtonInner({
  role,
  onRoleChange,
  dropdownRef,
  showDropdown,
  setShowDropdown,
  useDynamicContext,
}: {
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  showDropdown: boolean;
  setShowDropdown: (show: boolean) => void;
  useDynamicContext: DynamicContextHook;
}) {
  let user: unknown = null;
  let primaryWallet: { address?: string } | null = null;
  let sdkHasLoaded = false;
  let setShowAuthFlow: (show: boolean) => void = () => {};
  let handleLogOut: () => void = () => {};

  try {
    const ctx = useDynamicContext();
    user = ctx.user;
    primaryWallet = ctx.primaryWallet;
    sdkHasLoaded = ctx.sdkHasLoaded;
    setShowAuthFlow = ctx.setShowAuthFlow;
    handleLogOut = ctx.handleLogOut;
  } catch {
    // Dynamic context not ready
  }

  const isAuthenticated = !!user;

  // SDK 加载中
  if (!sdkHasLoaded) {
    return (
      <div className="glass-panel flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm">
        <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white/80" />
        <span className="text-white/50">加载中...</span>
      </div>
    );
  }

  // 未登录状态
  if (!isAuthenticated) {
    return (
      <button
        onClick={() => setShowAuthFlow(true)}
        className="glass-panel flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-all hover:bg-white/[0.08] hover:border-[#d4a574]/30"
      >
        <Wallet size={14} className="text-[#d4a574]" />
        <span className="text-white/80">连接钱包</span>
      </button>
    );
  }

  // 已登录状态
  const userObj = user as { username?: string; email?: string } | null;
  const displayName =
    userObj?.username ||
    userObj?.email?.split("@")[0] ||
    (primaryWallet?.address
      ? `${primaryWallet.address.slice(0, 6)}...${primaryWallet.address.slice(-4)}`
      : "用户");

  const RoleIcon = role === "buyer" ? ShoppingBag : Store;
  const roleColor = role === "buyer" ? "text-[#d4a574]" : "text-[#c8d86a]";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="glass-panel flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-all hover:bg-white/[0.08]"
      >
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#d4a574] to-[#c8d86a]">
          <span className="text-[10px] font-medium text-black">
            {displayName.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="text-white/80 max-w-[100px] truncate hidden sm:block">{displayName}</span>
        <RoleIcon size={12} className={roleColor} />
        <ChevronDown
          size={12}
          className={`text-white/50 transition-transform ${showDropdown ? "rotate-180" : ""}`}
        />
      </button>

      {/* 下拉菜单 */}
      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-52 glass-panel rounded-xl p-1 z-50">
          {/* 钱包地址 */}
          {primaryWallet?.address && (
            <div className="px-3 py-2 border-b border-white/10">
              <div className="text-[10px] text-white/40 uppercase tracking-wider">钱包地址</div>
              <div className="mt-1 text-xs text-white/70 font-mono">
                {primaryWallet.address.slice(0, 10)}...{primaryWallet.address.slice(-8)}
              </div>
            </div>
          )}

          {/* 角色选择 */}
          <div className="px-3 py-2 border-b border-white/10">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">选择角色</div>
            <div className="space-y-1">
              <button
                onClick={() => onRoleChange("buyer")}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors ${
                  role === "buyer" ? "bg-[#d4a574]/20" : "hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag size={14} className="text-[#d4a574]" />
                  <span className="text-sm text-white/80">买家</span>
                </div>
                {role === "buyer" && <Check size={14} className="text-[#d4a574]" />}
              </button>
              <button
                onClick={() => onRoleChange("seller")}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors ${
                  role === "seller" ? "bg-[#c8d86a]/20" : "hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Store size={14} className="text-[#c8d86a]" />
                  <span className="text-sm text-white/80">卖家</span>
                </div>
                {role === "seller" && <Check size={14} className="text-[#c8d86a]" />}
              </button>
            </div>
          </div>

          {/* 退出登录 */}
          <button
            onClick={() => {
              handleLogOut();
              setShowDropdown(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:bg-white/[0.05] rounded-lg transition-colors"
          >
            <LogOut size={14} />
            <span>退出登录</span>
          </button>
        </div>
      )}
    </div>
  );
}
