import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { BrandMark } from './home-shared';
import { ThemeToggle } from './theme-toggle';

export function HomeNav() {
  return (
    <nav
      aria-label="Primary"
      className="mb-16 flex items-center justify-between rounded-full border border-border bg-card/60 px-4 py-3 backdrop-blur"
    >
      <Link className="flex items-center gap-3" href="/">
        <span className="grid size-9 place-items-center rounded-full border border-brand-accent-border bg-brand-accent-surface text-brand-accent">
          <BrandMark className="size-5 brand-mark-spin" />
        </span>
        <span>
          <span className="block text-sm font-medium tracking-tight text-foreground">Adaptive Learning Studio</span>
          <span className="block font-mono text-[0.65rem] tracking-[0.16em] uppercase text-muted-foreground">
            Reviewable AI for creators
          </span>
        </span>
      </Link>

      <div className="flex items-center gap-3">
        <a
          className="hidden h-10 items-center rounded-full px-4 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          href="#workflow"
        >
          How it works
        </a>
        <a
          className="hidden h-10 items-center rounded-full px-4 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          href="#principles"
        >
          Principles
        </a>
        <ThemeToggle />
        <Link
          className="inline-flex h-10 items-center rounded-full bg-brand-accent px-5 text-sm font-medium text-background transition-colors hover:opacity-90 active:scale-[0.98]"
          href="/sign-in"
        >
          Sign in
          <ArrowUpRight className="ml-1.5 size-4" strokeWidth={1.5} />
        </Link>
      </div>
    </nav>
  );
}
