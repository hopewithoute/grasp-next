import { ArrowRight, FileText, History, MessageSquareText, Network, Quote } from 'lucide-react';
import { Eyebrow } from './home-shared';
import { InfiniteScrollTrack, PulseBadge } from './motion-components';

const reviewLog = [
  {
    id: '1',
    actor: 'You',
    delta: 'approved',
    label: 'Concept graph',
    meta: 'v3',
    tone: 'success' as const,
  },
  {
    id: '2',
    actor: 'AI',
    delta: 'extracted',
    label: '12 concepts, 7 prerequisites',
    meta: '4.2s',
    tone: 'neutral' as const,
  },
  {
    id: '3',
    actor: 'You',
    delta: 'requested revision',
    label: 'Lesson §2.1',
    meta: 'v2',
    tone: 'warn' as const,
  },
];

export function WorkflowSection() {
  return (
    <section className="border-border border-t pt-16 pb-20 md:pt-24 md:pb-32" id="workflow">
      <header className="mb-12 grid gap-8 md:grid-cols-[0.42fr_0.58fr] md:items-end">
        <div className="space-y-3">
          <Eyebrow>The pipeline</Eyebrow>
          <h2 className="text-3xl leading-[1.05] font-medium tracking-tight md:text-5xl">
            Five stages.
            <br />
            One dense console.
          </h2>
        </div>
        <p className="text-muted-foreground max-w-[60ch] text-base leading-relaxed md:text-lg">
          Each stage is a strict checkpoint. The studio suspends the pipeline at every review so you
          stay in total control of the generated artifacts.
        </p>
      </header>

      {/* Dense Workbench Bento */}
      <div className="bg-border border-border grid gap-[1px] overflow-hidden rounded-3xl border md:auto-rows-[minmax(220px,auto)] md:grid-cols-12">
        {/* Stage 03 — Reviewable artifacts (Featured) */}
        <article className="bg-background relative flex flex-col justify-between p-7 md:col-span-7 md:row-span-2 md:p-8">
          <div>
            <header className="border-border mb-6 flex items-start justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <Quote className="text-brand-accent size-4" strokeWidth={1.5} />
                <span className="text-brand-accent block font-mono text-[0.7rem] tracking-[0.16em] uppercase">
                  STAGE 03 · Reviewable Artifacts
                </span>
              </div>
              <span className="text-muted-foreground font-mono text-[0.7rem] tabular-nums">
                PRD §7.7
              </span>
            </header>

            <h3 className="max-w-[20ch] text-2xl leading-tight font-medium tracking-tight md:text-3xl">
              Every output is versioned. Approve, revise, or reject.
            </h3>

            {/* Mock review log — Dense list */}
            <ul className="bg-border border-border mt-8 flex flex-col gap-[1px] overflow-hidden rounded-lg border">
              {reviewLog.map((entry) => {
                const isSuccess = entry.tone === 'success';
                const isWarn = entry.tone === 'warn';
                return (
                  <li
                    className={`bg-card flex items-center justify-between px-4 py-2.5 text-sm`}
                    key={entry.id}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.16em] uppercase">
                        [{entry.actor}]
                      </span>
                      <span
                        className={
                          isSuccess
                            ? 'text-brand-accent'
                            : isWarn
                              ? 'text-amber-500'
                              : 'text-foreground'
                        }
                      >
                        {entry.delta}
                      </span>
                      <span className="text-muted-foreground">{entry.label}</span>
                    </div>
                    <span className="text-muted-foreground font-mono text-[0.7rem] tabular-nums">
                      {entry.meta}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </article>

        {/* Stage 01 — Source */}
        <article className="bg-background flex flex-col p-7 md:col-span-5 md:p-8">
          <header className="border-border mb-6 flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <FileText className="text-muted-foreground size-4" strokeWidth={1.5} />
              <span className="text-muted-foreground font-mono text-[0.7rem] tracking-[0.16em] uppercase">
                STAGE 01 · Source
              </span>
            </div>
            <span className="text-muted-foreground font-mono text-[0.7rem] tabular-nums">
              PRD §7.1
            </span>
          </header>
          <div className="flex flex-1 flex-col justify-end">
            <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
              Paste markdown or text. The studio validates length, language, and readiness before
              execution.
            </p>
            <div className="text-muted-foreground border-border bg-card flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs">
              <span>
                status: <span className="text-brand-accent">validated</span>
              </span>
              <span className="text-border">|</span>
              <span>chars: 42,091</span>
            </div>
          </div>
        </article>

        {/* Stage 02 — Concept extraction */}
        <article className="bg-background flex flex-col overflow-hidden p-7 md:col-span-5 md:p-8">
          <header className="border-border mb-6 flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <Network className="text-muted-foreground size-4" strokeWidth={1.5} />
              <span className="text-muted-foreground font-mono text-[0.7rem] tracking-[0.16em] uppercase">
                STAGE 02 · Graph
              </span>
            </div>
            <span className="text-muted-foreground font-mono text-[0.7rem] tabular-nums">
              PRD §7.2
            </span>
          </header>
          <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
            A Mastra agent extracts concepts with definitions and citations. Streams as it works.
          </p>
          <div className="-mx-8 mt-auto">
            {/* Infinite Scroll Micro-Interaction */}
            <InfiniteScrollTrack speed={30}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="bg-card border-border text-muted-foreground flex items-center gap-2 rounded border px-3 py-1.5 font-mono text-[0.7rem] whitespace-nowrap uppercase"
                >
                  <PulseBadge>
                    <span className="bg-brand-accent block size-1.5 rounded-full" />
                  </PulseBadge>
                  node_ext_{i}
                </div>
              ))}
            </InfiniteScrollTrack>
          </div>
        </article>

        {/* Stage 04 — Block-level revision */}
        <article className="bg-background flex flex-col p-7 md:col-span-6 md:p-8">
          <header className="border-border mb-6 flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <History className="text-muted-foreground size-4" strokeWidth={1.5} />
              <span className="text-muted-foreground font-mono text-[0.7rem] tracking-[0.16em] uppercase">
                STAGE 04 · Revision
              </span>
            </div>
            <span className="text-muted-foreground font-mono text-[0.7rem] tabular-nums">
              PRD §7.5
            </span>
          </header>
          <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
            Lesson blocks regenerate on instruction. Versions are kept. Nothing publishes until
            approved.
          </p>
          <div className="border-border bg-card mt-auto flex items-center gap-3 rounded-lg border px-4 py-3">
            <span className="text-brand-accent font-mono text-[0.65rem] tracking-[0.16em] uppercase">
              prompt
            </span>
            <span className="text-foreground flex-1 truncate text-sm">
              rewrite explanation as a bookshelf analogy
            </span>
            <span
              aria-hidden
              className="bg-brand-accent stream-cursor inline-block h-3.5 w-[2px]"
            />
          </div>
        </article>

        {/* Stage 05 — Chat with material */}
        <article className="bg-background flex flex-col p-7 md:col-span-6 md:p-8">
          <header className="border-border mb-6 flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <MessageSquareText className="text-muted-foreground size-4" strokeWidth={1.5} />
              <span className="text-muted-foreground font-mono text-[0.7rem] tracking-[0.16em] uppercase">
                STAGE 05 · Tutor
              </span>
            </div>
            <span className="text-muted-foreground font-mono text-[0.7rem] tabular-nums">
              PRD §7.9
            </span>
          </header>
          <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
            Learners chat through an Agentic RAG tutor. Every answer cites the section it came from.
          </p>
          <div className="mt-auto flex flex-col gap-1">
            <div className="text-muted-foreground mb-2 flex items-center gap-2 font-mono text-xs">
              <span>Query: B-tree vs Table Scan</span>
            </div>
            <div className="border-brand-accent text-foreground relative border-l-2 py-1 pl-4 text-sm">
              The engine reads <span className="text-brand-accent font-mono">log₁₀₀(N)</span> pages
              instead of N rows.
              <div className="text-muted-foreground mt-2 flex items-center gap-2 font-mono text-[0.65rem] tracking-widest uppercase">
                <ArrowRight className="size-3" strokeWidth={1.5} />
                cited from §3.2, §3.4
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
