"use client";

// 安全的 Dynamic Context hook，在 SSR 或 provider 外部使用时不会报错
export function useSafeDynamic() {
  if (typeof window === "undefined") {
    return {
      user: null,
      primaryWallet: null,
      sdkHasLoaded: false,
      setShowAuthFlow: () => {},
      handleLogOut: () => {},
      isAvailable: true as const,
    };
  }

  try {
    // 动态导入以避免 SSR 问题
    const { useDynamicContext } = require("@dynamic-labs/sdk-react-core");
    return { ...useDynamicContext(), isAvailable: true as const };
  } catch {
    // 返回默认值
    return {
      user: null,
      primaryWallet: null,
      sdkHasLoaded: false,
      setShowAuthFlow: () => {},
      handleLogOut: () => {},
      isAvailable: false as const,
    };
  }
}
