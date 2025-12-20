"use client";

import { usePathname } from "next/navigation";
import { CartProvider } from "@/components/CartProvider";
import { AgentProvider, ChatSidebar, DealSidebar } from "@/components/agent";
import { DynamicProvider, Navbar } from "@/components/auth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";
  const showSidebars = !isLandingPage;

  return (
    <DynamicProvider>
      <AgentProvider>
        <CartProvider>
          {/* 导航栏（Landing 页面不显示，因为有自己的 hero section） */}
          {!isLandingPage && <Navbar />}

          {showSidebars ? <ChatSidebar /> : null}
          {children}
          {showSidebars ? <DealSidebar /> : null}
        </CartProvider>
      </AgentProvider>
    </DynamicProvider>
  );
}
