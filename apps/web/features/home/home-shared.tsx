import React from 'react';

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="4.5" cy="6" r="1.4" />
      <circle cx="20" cy="9" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <line x1="12" x2="4.5" y1="12" y2="6" />
      <line x1="12" x2="20" y1="12" y2="9" />
      <line x1="12" x2="17" y1="12" y2="20" />
    </svg>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-3 text-[0.7rem] tracking-[0.2em] uppercase">
      <span className="bg-brand-accent pulse-soft size-1.5" />
      <span className="font-mono">[ {children} ]</span>
    </span>
  );
}
