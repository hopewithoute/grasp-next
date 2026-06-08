import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { StatusChip } from './project-shared';

export function IngestionStatusPanel({
  status,
}: {
  status: {
    hint: string;
    ready: boolean;
    unit: string;
    value: string;
  };
}) {
  return (
    <section className="border-border bg-card/50 grid gap-px overflow-hidden rounded-[1.35rem] border md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="bg-card/50 flex items-center justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-muted-foreground font-mono text-[0.62rem] tracking-[0.18em] uppercase tabular-nums">
            Ingestion
          </p>
          <p className="text-foreground text-lg font-medium tracking-tight capitalize">
            {status.value}
          </p>
        </div>
        <StatusChip ready={status.ready} />
      </div>
      <div className="bg-card/50 p-5">
        <p className="text-muted-foreground text-sm leading-7">{status.hint}</p>
        <p className="text-muted-foreground mt-2 font-mono text-[0.65rem] tracking-[0.16em] uppercase">
          Direct source ingestion / vector search later
        </p>
      </div>
    </section>
  );
}

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
      <article className="border-border bg-card/50 rounded-[1.75rem] border p-6">
        <p className="text-muted-foreground text-sm font-medium">{eyebrow}</p>
        <h2 className="text-foreground mt-2 max-w-3xl text-3xl leading-tight font-medium tracking-[-0.04em]">
          {title}
        </h2>
        <p className="text-muted-foreground mt-4 max-w-3xl text-sm leading-7">
          This placeholder keeps the project studio aligned with the end-to-end MVP architecture
          while the current implementation stays focused on source and graph review.
        </p>
        <div className="mt-6 space-y-3">
          {blockers.map((blocker) => (
            <div
              className="border-border bg-card/50 text-muted-foreground rounded-[1.25rem] border px-4 py-3 text-sm leading-7"
              key={blocker}
            >
              {blocker}
            </div>
          ))}
        </div>
      </article>

      <aside className="border-border bg-card/50 rounded-[1.75rem] border p-5">
        <p className="text-muted-foreground text-sm font-medium">Suggested route</p>
        <p className="text-muted-foreground mt-3 text-sm leading-7">
          Return to the currently implemented stage and keep the workflow moving there.
        </p>
        <Link
          className="border-border bg-card/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200"
          href={ctaHref}
        >
          {ctaLabel}
          <ArrowRight className="size-4" />
        </Link>
      </aside>
    </section>
  );
}
