"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { hasDynamicEnvironmentId } from "@/lib/auth/dynamic";

interface AuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
  message?: string;
}

export function AuthGuard({
  children,
  redirectTo = "/dashboard",
  message = "请先登录后继续操作",
}: AuthGuardProps) {
  const [dynamicHook, setDynamicHook] = useState<
    | (() => {
        user: unknown;
        sdkHasLoaded: boolean;
        setShowAuthFlow: (show: boolean) => void;
      })
    | null
  >(null);

  useEffect(() => {
    if (!hasDynamicEnvironmentId) return;
    import("@dynamic-labs/sdk-react-core")
      .then((mod) => setDynamicHook(() => mod.useDynamicContext))
      .catch(() => setDynamicHook(null));
  }, []);

  if (!hasDynamicEnvironmentId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="glass-panel rounded-2xl p-8 text-center max-w-md">
          <div className="mb-4 text-5xl">!</div>
          <h2 className="text-xl font-semibold text-white/90 mb-2">未配置 Dynamic 环境</h2>
          <p className="text-sm text-white/60">
            请设置 NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID 后重试。
          </p>
        </div>
      </div>
    );
  }

  if (!dynamicHook) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#d4a574]" />
        <p className="text-sm text-white/60">加载中...</p>
      </div>
    );
  }

  return (
    <AuthGuardInner
      useDynamicContext={dynamicHook}
      redirectTo={redirectTo}
      message={message}
    >
      {children}
    </AuthGuardInner>
  );
}

function AuthGuardInner({
  children,
  redirectTo,
  message,
  useDynamicContext,
}: {
  children: React.ReactNode;
  redirectTo: string;
  message: string;
  useDynamicContext: () => {
    user: unknown;
    sdkHasLoaded: boolean;
    setShowAuthFlow: (show: boolean) => void;
  };
}) {
  const router = useRouter();
  let user: unknown = null;
  let sdkHasLoaded = false;
  let setShowAuthFlow: (show: boolean) => void = () => {};

  try {
    const ctx = useDynamicContext();
    user = ctx.user;
    sdkHasLoaded = ctx.sdkHasLoaded;
    setShowAuthFlow = ctx.setShowAuthFlow;
  } catch {
    // Dynamic context not ready
  }

  const isAuthenticated = !!user;

  useEffect(() => {
    // SDK 加载完成且未登录时，显示登录弹窗
    if (sdkHasLoaded && !isAuthenticated) {
      setShowAuthFlow(true);
    }
  }, [sdkHasLoaded, isAuthenticated, setShowAuthFlow]);

  // SDK 还在加载
  if (!sdkHasLoaded) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#d4a574]" />
        <p className="text-sm text-white/60">加载中...</p>
      </div>
    );
  }

  // 未登录
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
        <div className="glass-panel rounded-2xl p-8 text-center max-w-md">
          <div className="mb-4 text-5xl">?</div>
          <h2 className="text-xl font-semibold text-white/90 mb-2">需要登录</h2>
          <p className="text-sm text-white/60 mb-6">{message}</p>
          <button
            onClick={() => setShowAuthFlow(true)}
            className="w-full rounded-xl bg-gradient-to-r from-[#d4a574] to-[#c8d86a] px-6 py-3 font-medium text-black transition-all hover:opacity-90"
          >
            连接钱包登录
          </button>
          <button
            onClick={() => router.push(redirectTo)}
            className="mt-3 w-full rounded-xl border border-white/20 px-6 py-3 text-sm text-white/70 transition-all hover:bg-white/5"
          >
            返回浏览
          </button>
        </div>
      </div>
    );
  }

  // 已登录，显示内容
  return <>{children}</>;
}
