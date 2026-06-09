import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { BrandMark } from './home-shared';
import { ThemeToggle } from './theme-toggle';

export function HomeNav({ variant = 'home' }: { variant?: 'home' | 'auth' }) {
  return (
    <header className="sticky top-0 z-50 mb-16 w-full">
      <nav
        aria-label="Primary"
        className="border-border/40 bg-background/70 flex w-full items-center justify-between rounded-none border-b px-6 py-4 shadow-sm backdrop-blur-md transition-all"
      >
        <Link className="group flex items-center gap-3" href="/">
          <span className="text-foreground border-border/50 bg-background group-hover:border-brand-accent/50 grid size-9 place-items-center rounded-none border shadow-sm transition-colors">
            <BrandMark className="group-hover:text-brand-accent size-5 transition-colors" />
          </span>
          <span className="flex flex-col">
            <span className="text-foreground font-mono text-xs font-semibold tracking-widest uppercase">
              [ ADAPTIVE_LEARNING_STUDIO ]
            </span>
            <span className="text-muted-foreground/80 font-mono text-[0.6rem] tracking-[0.2em] uppercase">
              [ KNOWLEDGEBASE / MULTIMEDIA ]
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {variant === 'home' && (
            <>
              <a
                className="text-muted-foreground hover:text-foreground hidden items-center px-4 font-mono text-xs tracking-widest uppercase transition-colors sm:inline-flex"
                href="#workflow"
              >
                [ WORKFLOW ]
              </a>
              <a
                className="text-muted-foreground hover:text-foreground hidden items-center px-4 font-mono text-xs tracking-widest uppercase transition-colors sm:inline-flex"
                href="#principles"
              >
                [ PRINCIPLES ]
              </a>
            </>
          )}
          <ThemeToggle />
          {variant === 'home' ? (
            <Link
              className="border-brand-accent/50 bg-brand-accent/10 text-brand-accent hover:bg-brand-accent hover:text-background inline-flex h-9 items-center rounded-none border px-5 font-mono text-xs font-medium tracking-widest uppercase transition-colors"
              href="/sign-in"
            >
              [ SIGN IN ]
              <ArrowUpRight className="ml-2 size-3.5" strokeWidth={1} />
            </Link>
          ) : (
            <Link
              className="text-muted-foreground hover:text-foreground border-border/40 hover:border-foreground/50 inline-flex h-9 items-center rounded-none border px-5 font-mono text-xs font-medium tracking-widest uppercase transition-colors"
              href="/"
            >
              <ArrowLeft className="mr-2 size-3.5" strokeWidth={1} />[ ABORT ]
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
