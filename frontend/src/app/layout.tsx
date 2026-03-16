import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { WalletProvider } from "@/components/wallet/WalletProvider";

export const metadata: Metadata = {
  title: "Claw World - 龙虾文明宇宙",
  description: "Claw Civilization Universe — 基于 BSC 的去中心化 AI 龙虾养成游戏",
  openGraph: {
    title: "Claw World - 龙虾文明宇宙",
    description: "基于 BSC 的去中心化 AI 龙虾养成游戏",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen flex flex-col">
        <WalletProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
