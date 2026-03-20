import type { Metadata } from "next";
import "./globals.css";
import { PipBoyNav } from "@/components/layout/PipBoyNav";
import { PipBoyStatusBar } from "@/components/layout/PipBoyStatusBar";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
          <div className="pipboy-frame">
            {/* Frame branding */}
            <div className="pipboy-frame-brand">CLAW WORLD TERMINAL v2.0</div>

            {/* Side labels */}
            <div className="hw-side-labels hidden lg:flex">
              <span>STAT</span>
              <span style={{ color: '#26ff26' }}>INV</span>
              <span>DATA</span>
              <span>MAP</span>
            </div>

            {/* Side knobs */}
            <div className="hw-knob-side hidden lg:block" style={{ top: '140px' }} />
            <div className="hw-knob-side hidden lg:block" style={{ bottom: '100px' }} />

            {/* CRT Screen housing */}
            <div className="crt-container">
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

            {/* Bottom hardware screws */}
            <div className="pipboy-hw-bottom hidden lg:flex justify-between items-center px-10 pt-3" style={{ flexShrink: 0 }}>
              <div className="hw-screw hw-screw-rust" />
              <div className="hw-screw" />
              <div className="hw-screw hw-screw-rust" />
            </div>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
