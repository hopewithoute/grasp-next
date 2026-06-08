import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { BrandMark } from './home-shared';
import { ThemeToggle } from './theme-toggle';

export function HomeNav() {
  return (
    <nav
      aria-label="Primary"
      className="border-border bg-card/60 mb-16 flex items-center justify-between rounded-full border px-4 py-3 backdrop-blur"
    >
      <Link className="flex items-center gap-3" href="/">
        <span className="border-brand-accent-border bg-brand-accent-surface text-brand-accent grid size-9 place-items-center rounded-full border">
          <BrandMark className="brand-mark-spin size-5" />
        </span>
        <span>
          <span className="text-foreground block text-sm font-medium tracking-tight">
            Adaptive Learning Studio
          </span>
          <span className="text-muted-foreground block font-mono text-[0.65rem] tracking-[0.16em] uppercase">
            Reviewable AI for creators
          </span>
        </span>
      </Link>

      <div className="flex items-center gap-3">
        <a
          className="text-muted-foreground hover:text-foreground hidden h-10 items-center rounded-full px-4 text-sm transition-colors sm:inline-flex"
          href="#workflow"
        >
          How it works
        </a>
        <a
          className="text-muted-foreground hover:text-foreground hidden h-10 items-center rounded-full px-4 text-sm transition-colors sm:inline-flex"
          href="#principles"
        >
          Principles
        </a>
        <ThemeToggle />
        <Link
          className="bg-brand-accent text-background inline-flex h-10 items-center rounded-full px-5 text-sm font-medium transition-colors hover:opacity-90 active:scale-[0.98]"
          href="/sign-in"
        >
          Sign in
          <ArrowUpRight className="ml-1.5 size-4" strokeWidth={1.5} />
        </Link>
      </div>
    </nav>
  );
}
