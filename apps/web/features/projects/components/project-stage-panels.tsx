import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function PlannedStagePanel({
  blockers,
  ctaHref,
  ctaLabel,
  eyebrow,
  title,
}: {
  blockers: string[];
  ctaHref: string;
  ctaLabel: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <article className="border-border/40 bg-background/50 group relative rounded-none border p-6">
        <div className="border-muted-foreground/30 group-hover:border-brand-accent absolute top-0 left-0 size-2 border-t border-l transition-colors" />
        <div className="border-muted-foreground/30 group-hover:border-brand-accent absolute right-0 bottom-0 size-2 border-r border-b transition-colors" />

        <p className="text-brand-accent/80 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
          [ {eyebrow} ]
        </p>
        <h2 className="text-foreground mt-4 max-w-3xl text-3xl leading-[1.05] font-light tracking-[-0.03em] uppercase">
          {title}
        </h2>
        <p className="text-muted-foreground/70 mt-6 max-w-3xl font-mono text-xs leading-relaxed uppercase">
          &gt; This placeholder keeps the project studio aligned with the end-to-end MVP
          architecture while the current implementation stays focused on source and graph review.
        </p>
        <div className="mt-8 space-y-3">
          {blockers.map((blocker) => (
            <div
              className="border-border/30 bg-muted/5 text-muted-foreground/80 rounded-none border px-4 py-3 font-mono text-[0.65rem] leading-relaxed tracking-widest uppercase"
              key={blocker}
            >
              [ BLK ] {blocker}
            </div>
          ))}
        </div>
      </article>

      <aside className="border-border/40 bg-background/50 relative flex flex-col justify-between rounded-none border p-6">
        <div className="border-muted-foreground/30 absolute top-0 left-0 size-2 border-t border-l" />
        <div className="border-muted-foreground/30 absolute right-0 bottom-0 size-2 border-r border-b" />

        <div>
          <p className="text-muted-foreground/60 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
            [ SUGGESTED_ROUTE ]
          </p>
          <p className="text-muted-foreground/80 mt-4 font-mono text-xs leading-relaxed uppercase">
            &gt; Return to the currently implemented stage and keep the workflow moving there.
          </p>
        </div>
        <Link
          className="border-brand-accent/50 bg-brand-accent/10 text-brand-accent hover:bg-brand-accent hover:text-background mt-8 flex items-center justify-between gap-2 rounded-none border px-4 py-3 font-mono text-xs tracking-widest uppercase transition-all"
          href={ctaHref}
        >
          [ {ctaLabel} ]
          <ArrowRight className="size-4" />
        </Link>
      </aside>
    </section>
  );
}
