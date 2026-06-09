'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="border-border bg-background text-foreground hover:bg-muted/10 relative grid size-9 place-items-center rounded-none border transition-colors"
        aria-label="Toggle theme"
      >
        <span className="size-4" />
      </button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="border-border/40 bg-background text-foreground/70 hover:border-brand-accent/50 hover:bg-brand-accent/10 hover:text-brand-accent relative grid size-9 place-items-center rounded-none border transition-all"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="size-4" strokeWidth={1} />
      ) : (
        <Moon className="size-4" strokeWidth={1} />
      )}
    </button>
  );
}
