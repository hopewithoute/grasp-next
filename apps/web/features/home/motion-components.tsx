'use client';

import * as React from 'react';
import { AnimatePresence, m } from 'framer-motion';

export function InfiniteScrollTrack({
  children,
  speed = 40,
}: {
  children: React.ReactNode;
  speed?: number;
}) {
  return (
    <div className="relative flex w-full overflow-hidden">
      <m.div
        className="flex shrink-0 gap-4 pr-4"
        animate={{ x: ['0%', '-100%'] }}
        transition={{
          ease: 'linear',
          duration: speed,
          repeat: Infinity,
        }}
      >
        {children}
      </m.div>
      <m.div
        className="flex shrink-0 gap-4 pr-4"
        animate={{ x: ['0%', '-100%'] }}
        transition={{
          ease: 'linear',
          duration: speed,
          repeat: Infinity,
        }}
      >
        {children}
      </m.div>
    </div>
  );
}

export function PulseBadge({ children }: { children: React.ReactNode }) {
  return (
    <m.span
      animate={{ opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      className="inline-flex"
    >
      {children}
    </m.span>
  );
}

export function IntelligentList({
  items,
}: {
  items: Array<{ id: string; label: string; value: string }>;
}) {
  const [data, setData] = React.useState(() => [...items]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => {
        const next = [...prev];
        const first = next.shift();
        if (first) next.push(first);
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {data.map((item) => (
          <m.div
            key={item.id}
            layout
            layoutId={item.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="border-border flex items-center justify-between border-b py-2 text-sm"
          >
            <span className="text-foreground font-medium">{item.label}</span>
            <span className="text-brand-accent font-mono text-xs">{item.value}</span>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function LiquidGlassPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-card border-border relative overflow-hidden rounded-[2.5rem] border shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${className || ''}`}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function FadeUp({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98], delay }}
      className={className}
    >
      {children}
    </m.div>
  );
}

export function FadeIn({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <m.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.9, ease: 'easeOut', delay }}
      className={className}
    >
      {children}
    </m.div>
  );
}
