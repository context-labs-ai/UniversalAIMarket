"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DYNAMIC_ENVIRONMENT_ID, hasDynamicEnvironmentId } from "@/lib/auth/dynamic";

interface DynamicProviderProps {
  children: ReactNode;
}

export function DynamicProvider({ children }: DynamicProviderProps) {
  const [Provider, setProvider] = useState<React.ComponentType<{ children: ReactNode }> | null>(null);

  useEffect(() => {
    if (!hasDynamicEnvironmentId) return;

    // 只在客户端动态加载 Dynamic SDK，避免 SSR 触发 CJS/ESM 兼容问题
    Promise.all([
      import("@dynamic-labs/sdk-react-core"),
      import("@dynamic-labs/ethereum"),
    ]).then(([{ DynamicContextProvider }, { EthereumWalletConnectors }]) => {
      const settings = {
        environmentId: DYNAMIC_ENVIRONMENT_ID,
        walletConnectors: [EthereumWalletConnectors],
        eventsCallbacks: {
          onAuthSuccess: (args: { isAuthenticated: boolean }) => {
            console.log("[Dynamic] Auth success:", args);
          },
          onLogout: () => {
            console.log("[Dynamic] User logged out");
          },
        },
      };

      const WrappedProvider = ({ children }: { children: ReactNode }) => (
        <DynamicContextProvider settings={settings}>{children}</DynamicContextProvider>
      );

      setProvider(() => WrappedProvider);
    });
  }, []);

  if (!hasDynamicEnvironmentId || !Provider) {
    return <>{children}</>;
  }

  return <Provider>{children}</Provider>;
}
