'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';

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
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [offline, setOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [iosBrowser, setIosBrowser] = useState(false);

  useEffect(() => {
    function updateState() {
      setInstalled(detectStandalone());
      setOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);
      setIosBrowser(detectIos() && !detectStandalone());
    }

    updateState();

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setDismissed(false);
    }

    function handleAppInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
      setDismissed(false);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', updateState);
    window.addEventListener('offline', updateState);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', updateState);
      window.removeEventListener('offline', updateState);
    };
  }, []);

  const banner = useMemo(() => {
    if (offline) {
      return {
        mode: 'offline' as const,
        title: 'Offline shell active',
        detail: 'Cached screens stay available until the network returns.',
      };
    }
    if (!installed && !dismissed && installPrompt) {
      return {
        mode: 'install' as const,
        title: 'Install Clawworld',
        detail: 'Open faster, keep the bottom-nav shell, and return without browser chrome.',
      };
    }
    if (!installed && !dismissed && iosBrowser) {
      return {
        mode: 'ios' as const,
        title: 'Add to Home Screen',
        detail: 'Use Safari Share > Add to Home Screen to keep Clawworld as a standalone app.',
      };
    }
    return null;
  }, [dismissed, installPrompt, installed, iosBrowser, offline]);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome !== 'accepted') {
      setDismissed(true);
    }
    setInstallPrompt(null);
  }

  if (!banner) return null;

  return (
    <section className={`cw-pwa-banner cw-pwa-banner--${banner.mode}`}>
      <div className="cw-pwa-banner-copy">
        <span className="cw-label">PWA shell</span>
        <h3>{banner.title}</h3>
        <p className="cw-muted">{banner.detail}</p>
      </div>
      <div className="cw-pwa-banner-actions">
        {banner.mode === 'install' ? (
          <button type="button" className="cw-button cw-button--primary" onClick={() => void handleInstall()}>
            <Download size={16} />
            Install
          </button>
        ) : banner.mode === 'ios' ? (
          <span className="cw-chip cw-chip--warm">
            <Smartphone size={14} />
            Safari only
          </span>
        ) : (
          <span className="cw-chip cw-chip--cool">
            <WifiOff size={14} />
            Waiting
          </span>
        )}
        {banner.mode !== 'offline' ? (
          <button type="button" className="cw-icon-button" onClick={() => setDismissed(true)} aria-label="Dismiss PWA banner">
            <X size={16} />
          </button>
        ) : null}
      </div>
    </section>
  );
}
