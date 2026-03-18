'use client';

import { useState, useEffect } from 'react';

interface TypeWriterProps {
  text: string;
  speed?: number;
  className?: string;
  cursor?: boolean;
  delay?: number;
}

export function TypeWriter({ text, speed = 30, className = '', cursor = true, delay = 0 }: TypeWriterProps) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (displayed.length >= text.length) return;

    const timer = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, speed);

    return () => clearTimeout(timer);
  }, [displayed, text, speed, started]);

  return (
    <span className={className}>
      {displayed}
      {cursor && displayed.length < text.length && (
        <span className="animate-blink">█</span>
      )}
    </span>
  );
}
