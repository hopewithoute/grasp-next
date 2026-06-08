import Link from 'next/link';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { BrandMark, Eyebrow } from './home-shared';

export function CtaSection() {
  return (
    <>
      <section className="border-border border-t pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="grid gap-8 md:grid-cols-[1.4fr_0.6fr] md:items-end">
          <div className="space-y-4">
            <Eyebrow>Get started</Eyebrow>
            <h2 className="max-w-[20ch] text-3xl leading-[1.05] font-medium tracking-tight md:text-5xl">
              Bring one chapter. Leave with a reviewed lesson.
            </h2>
            <p className="text-muted-foreground max-w-[58ch] text-base leading-relaxed">
              Sign in with Google. Create your first project. The pipeline starts as soon as you
              paste the source.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              className="group bg-brand-accent text-background hover:bg-brand-accent/90 inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition-all active:scale-[0.98]"
              href="/sign-in"
            >
              Continue with Google
              <ArrowUpRight
                className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={1.5}
              />
            </Link>
            <p className="text-muted-foreground font-mono text-[0.7rem] tracking-[0.14em] uppercase">
              Single creator entry · OAuth only
            </p>
          </div>
        </div>
      </section>

      <footer className="border-border text-muted-foreground flex flex-col items-start justify-between gap-4 border-t py-10 text-xs md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <span className="border-brand-accent-border bg-brand-accent-surface text-brand-accent grid size-7 place-items-center rounded-full border">
            <BrandMark className="size-3.5" />
          </span>
          <span className="text-foreground font-mono tracking-[0.14em] uppercase">
            Adaptive Learning Studio
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <CheckCircle2 className="text-brand-accent size-3.5" strokeWidth={1.5} />
          <span>Reviewable AI · Grounded · Progressive</span>
        </div>
      </footer>
    </>
  );
}
