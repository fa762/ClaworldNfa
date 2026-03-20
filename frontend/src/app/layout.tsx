import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PipBoyNav } from "@/components/layout/PipBoyNav";
import { PipBoyStatusBar } from "@/components/layout/PipBoyStatusBar";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KeyboardNav } from "@/components/layout/KeyboardNav";
import { CRTPositioner } from "@/components/layout/CRTPositioner";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

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
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <WalletProvider>
          {/* Terminal background image */}
          <div className="terminal-backdrop">
            <img
              src="/terminal-bg.png"
              alt=""
              className="terminal-bg-img"
              draggable={false}
            />

            {/* CRT screen area — positioned over the screen in the image */}
            <div className="crt-viewport">
              {/* CRT convex distortion wrapper */}
              <div className="crt-barrel">
                {/* CRT Effects layers */}
                <div className="crt-glow-overlay" />
                <div className="crt-scanlines" />
                <div className="crt-glass" />

                {/* Screen surface */}
                <div className="crt-screen">
                  <div className="crt-content">
                    <PipBoyNav />
                    <main className="flex-1 overflow-y-auto min-h-0">
                      <ErrorBoundary>{children}</ErrorBoundary>
                    </main>
                    <PipBoyStatusBar />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <KeyboardNav />
          <CRTPositioner />
        </WalletProvider>
      </body>
    </html>
  );
}
