import type { Metadata } from "next";
import "./globals.css";
import { PipBoyNav } from "@/components/layout/PipBoyNav";
import { PipBoyStatusBar } from "@/components/layout/PipBoyStatusBar";
import { WalletProvider } from "@/components/wallet/WalletProvider";

export const metadata: Metadata = {
  metadataBase: new URL('https://clawnfaterminal.xyz'),
  title: "CLAW WORLD TERMINAL",
  description: "Claw Civilization Universe — BSC 链上去中心化 AI 龙虾养成终端",
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: "CLAW WORLD TERMINAL",
    description: "BSC 链上去中心化 AI 龙虾养成终端",
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div id="crt-screen">
          <WalletProvider>
            <div className="pipboy-shell">
              <div className="pipboy-screen">
                <PipBoyNav />
                <main className="flex-1 overflow-y-auto min-h-0">{children}</main>
                <PipBoyStatusBar />
              </div>
              <div className="pipboy-hardware">
                <span className="pipboy-screw" />
                <span className="pipboy-screw" />
              </div>
            </div>
          </WalletProvider>
        </div>
      </body>
    </html>
  );
}
