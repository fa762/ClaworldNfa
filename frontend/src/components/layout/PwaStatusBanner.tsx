'use client';

import { useEffect, useMemo, useState } from 'react';
import { WifiOff } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function detectStandalone() {
  if (typeof window === 'undefined') return false;
  const mediaMatch = window.matchMedia('(display-mode: standalone)').matches;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return mediaMatch || navigatorWithStandalone.standalone === true;
}

function detectIos() {
  if (typeof window === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function PwaStatusBanner() {
  const [installed, setInstalled] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    function updateState() {
      setInstalled(detectStandalone());
      setOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);
    }

    updateState();

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    function handleAppInstalled() {
      setInstalled(true);
    }

    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', updateState);
    window.addEventListener('offline', updateState);

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', updateState);
      window.removeEventListener('offline', updateState);
    };
  }, []);

  const banner = useMemo(() => {
    if (offline) {
      return {
        mode: 'offline' as const,
        title: '当前离线',
        detail: '缓存页面还能继续看，等网络恢复后会自动回到正常状态。',
      };
    }
    return null;
  }, [installed, offline]);

  if (!banner) return null;

  return (
    <section className={`cw-pwa-banner cw-pwa-banner--${banner.mode}`}>
      <div className="cw-pwa-banner-copy">
        <h3>{banner.title}</h3>
        <p className="cw-muted">{banner.detail}</p>
      </div>
      <div className="cw-pwa-banner-actions">
        <span className="cw-chip cw-chip--cool">
          <WifiOff size={14} />
          离线中
        </span>
      </div>
    </section>
  );
}
