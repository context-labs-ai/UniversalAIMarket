import type { Metadata } from "next";
import { Fraunces, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Universal AI Market",
  description: "Cross-chain AI-powered marketplace with ZetaChain",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${fraunces.variable} ${spaceMono.variable} antialiased`} suppressHydrationWarning>
        <div className="bg-cosmic" />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
