import type { Metadata, Viewport } from "next";

import "./globals.css";

import { AppShell } from "@/components/layout/AppShell";
import { ActiveCompanionProvider } from "@/components/lobster/useActiveCompanion";
import { ChatEngineProvider } from "@/lib/chat-engine";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { I18nProvider } from "@/lib/i18n";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b6b4f",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.clawnfaterminal.xyz"),
  applicationName: "claworldnfa",
  manifest: "/manifest.webmanifest",
  title: "claworldnfa",
  description: "Persistent AI agent runtime with identity, memory, bounded execution, and auditable receipts.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "claworldnfa",
  },
  openGraph: {
    title: "claworldnfa",
    description: "Open-source runtime for persistent AI agents.",
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
      <body>
        <WalletProvider>
          <I18nProvider>
            <ChatEngineProvider>
              <ActiveCompanionProvider>
                <AppShell>{children}</AppShell>
              </ActiveCompanionProvider>
            </ChatEngineProvider>
          </I18nProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
