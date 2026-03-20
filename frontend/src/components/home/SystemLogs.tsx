'use client';

import { useState, useEffect } from 'react';

const logs = [
  { time: '14:02:11', msg: 'INTEGRITY CHECK PASSED. NO RAD-LEAKS DETECTED.', type: 'info' as const },
  { time: '14:05:44', msg: 'FETCHING BLOCKCHAIN DATA... SYNCED.', type: 'info' as const },
  { time: '14:08:02', msg: 'WARNING: RADSTORM INBOUND IN SECTOR 7-G.', type: 'warn' as const },
  { time: '14:12:30', msg: 'NFA #0247 PERSONALITY SHIFT DETECTED.', type: 'info' as const },
  { time: '14:15:01', msg: 'WORLD STATE UPDATE: REWARD MULTIPLIER RECALC.', type: 'info' as const },
];

export function SystemLogs() {
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
      <div className="text-[9px] font-bold opacity-50 uppercase mb-2">[ SYSTEM LOGS ]</div>
      <div className="text-[10px] leading-relaxed opacity-75 space-y-0.5">
        {logs.map((log, i) => (
          <div key={i} className={`flex gap-2 ${log.type === 'warn' ? 'term-warn' : ''}`}>
            <span className="opacity-40">{log.time}</span>
            <span>{log.msg}</span>
          </div>
        ))}
        {now && (
          <div className="flex gap-2 animate-pulse">
            <span className="opacity-40">{now}</span>
            <span className="term-dim">AWAITING INPUT...</span>
          </div>
        )}
      </div>
    </div>
  );
}
