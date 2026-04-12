import Link from 'next/link';
import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <>
      <section className="cw-band">
        <div className="cw-band--split">
          <div>
            <p className="cw-eyebrow">Offline</p>
            <h2 className="cw-section-title">The shell is still here.</h2>
            <p className="cw-muted">
              Cached screens remain available while the connection is down. Chain reads, writes, and live arena state will resume once the network returns.
            </p>
          </div>
          <div className="cw-score">
            <strong>Offline</strong>
            <span>shell</span>
          </div>
        </div>
      </section>

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">Connection</span>
            <h3>Local shell only</h3>
            <p className="cw-muted">
              Use this state to review the current shell and companion posture. Return to the network before attempting task, PK, Battle Royale, or autonomy actions.
            </p>
          </div>
          <span className="cw-chip cw-chip--cool">
            <WifiOff size={14} />
            Cached
          </span>
        </div>

        <div className="cw-list">
          <div className="cw-list-item cw-list-item--cool">
            <WifiOff size={16} />
            <span>Wallet connections, chain previews, and action receipts are unavailable until the browser reconnects.</span>
          </div>
          <div className="cw-list-item cw-list-item--warm">
            <WifiOff size={16} />
            <span>The installable shell and the most recent cached routes stay available so the app still opens cleanly.</span>
          </div>
        </div>

        <div className="cw-button-row">
          <Link href="/" className="cw-button cw-button--secondary">
            Return home
          </Link>
        </div>
      </section>
    </>
  );
}
