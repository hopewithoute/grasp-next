'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export function SystemStatusTicker({ className }: { className?: string }) {
  const [time, setTime] = React.useState('--:--:--');
  const [latency, setLatency] = React.useState(12);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // Avoid synchronous setState in effect
    const timeout = setTimeout(() => {
      setMounted(true);
      setLatency(Math.floor(Math.random() * 20) + 12);
    }, 0);

    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toTimeString().split(' ')[0]);
    }, 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(timer);
    };
  }, []);

  return (
    <div
      className={cn(
        'border-brand-accent/20 bg-background/80 text-brand-accent/70 flex h-6 items-center gap-4 border-b px-4 font-mono text-[0.6rem] tracking-widest uppercase backdrop-blur-sm',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="bg-brand-accent absolute inline-flex h-full w-full animate-ping rounded-none opacity-75"></span>
          <span className="bg-brand-accent relative inline-flex h-2 w-2 rounded-none"></span>
        </span>
        SYS.OK
      </div>
      <div className="bg-brand-accent/30 h-3 w-px" />
      <div>UPLINK: SECURE</div>
      <div className="bg-brand-accent/30 h-3 w-px" />
      <div>LATENCY: {mounted ? latency : '--'}MS</div>
      <div className="bg-brand-accent/30 h-3 w-px" />
      <div className="ml-auto opacity-50">
        {mounted ? time : '--:--:--'} {'//'} T-MINUS
      </div>
    </div>
  );
}
