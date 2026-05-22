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
    <section className="grid gap-px overflow-hidden rounded-[1.35rem] border border-border bg-card/50 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="flex items-center justify-between gap-4 bg-card/50 p-5">
        <div className="space-y-1">
          <p className="font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-muted-foreground">
            Ingestion
          </p>
          <p className="text-lg font-medium tracking-tight text-foreground capitalize">
            {status.value}
          </p>
        </div>
        <StatusChip ready={status.ready} />
      </div>
      <div className="bg-card/50 p-5">
        <p className="text-sm leading-7 text-muted-foreground">{status.hint}</p>
        <p className="mt-2 font-mono text-[0.65rem] tracking-[0.16em] uppercase text-muted-foreground">
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
      <article className="rounded-[1.75rem] border border-border bg-card/50 p-6">
        <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-2 max-w-3xl text-3xl leading-tight font-medium tracking-[-0.04em] text-foreground">
          {title}
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
          This placeholder keeps the project studio aligned with the end-to-end MVP architecture
          while the current implementation stays focused on source and graph review.
        </p>
        <div className="mt-6 space-y-3">
          {blockers.map((blocker) => (
            <div
              className="rounded-[1.25rem] border border-border bg-card/50 px-4 py-3 text-sm leading-7 text-muted-foreground"
              key={blocker}
            >
              {blocker}
            </div>
          ))}
        </div>
      </article>

      <aside className="rounded-[1.75rem] border border-border bg-card/50 p-5">
        <p className="text-sm font-medium text-muted-foreground">Suggested route</p>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Return to the currently implemented stage and keep the workflow moving there.
        </p>
        <Link
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-muted/50 hover:text-foreground"
          href={ctaHref}
        >
          {ctaLabel}
          <ArrowRight className="size-4" />
        </Link>
      </aside>
    </section>
  );
}
