'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';

const logKeys = [
  { time: '14:02:11', key: 'log.1' as const, type: 'info' as const },
  { time: '14:05:44', key: 'log.2' as const, type: 'info' as const },
  { time: '14:08:02', key: 'log.3' as const, type: 'warn' as const },
  { time: '14:12:30', key: 'log.4' as const, type: 'info' as const },
  { time: '14:15:01', key: 'log.5' as const, type: 'info' as const },
];

export function SystemLogs() {
  const { t } = useI18n();
  const [now, setNow] = useState('');

  useEffect(() => {
    const update = () => {
      const d = new Date();
      setNow(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="border-t border-crt-green/15 pt-3">
      <div className="text-[9px] font-bold opacity-50 uppercase mb-2">[ {t('log.title')} ]</div>
      <div className="text-[10px] leading-relaxed opacity-75 space-y-0.5">
        {logKeys.map((log, i) => (
          <div key={i} className={`flex gap-2 ${log.type === 'warn' ? 'term-warn' : ''}`}>
            <span className="opacity-40">{log.time}</span>
            <span>{t(log.key)}</span>
          </div>
        ))}
        {now && (
          <div className="flex gap-2 animate-pulse">
            <span className="opacity-40">{now}</span>
            <span className="term-dim">{t('log.awaiting')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
