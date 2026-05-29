import { FileText, History, MessageSquareText, Network, Quote, ArrowRight } from 'lucide-react';
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
    <section className="border-t border-border pt-16 pb-20 md:pt-24 md:pb-32" id="workflow">
      <header className="mb-12 grid gap-8 md:grid-cols-[0.42fr_0.58fr] md:items-end">
        <div className="space-y-3">
          <Eyebrow>The pipeline</Eyebrow>
          <h2 className="text-3xl leading-[1.05] font-medium tracking-tight md:text-5xl">
            Five stages.
            <br />
            One dense console.
          </h2>
        </div>
        <p className="max-w-[60ch] text-base leading-relaxed text-muted-foreground md:text-lg">
          Each stage is a strict checkpoint. The studio suspends the pipeline at every review so you
          stay in total control of the generated artifacts.
        </p>
      </header>

      {/* Dense Workbench Bento */}
      <div className="grid gap-[1px] bg-border border border-border rounded-3xl overflow-hidden md:grid-cols-12 md:auto-rows-[minmax(220px,auto)]">
        {/* Stage 03 — Reviewable artifacts (Featured) */}
        <article className="relative bg-background p-7 md:col-span-7 md:row-span-2 md:p-8 flex flex-col justify-between">
          <div>
            <header className="flex items-start justify-between border-b border-border pb-4 mb-6">
              <div className="flex items-center gap-3">
                <Quote className="size-4 text-brand-accent" strokeWidth={1.5} />
                <span className="block font-mono text-[0.7rem] tracking-[0.16em] uppercase text-brand-accent">
                  STAGE 03 · Reviewable Artifacts
                </span>
              </div>
              <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
                PRD §7.7
              </span>
            </header>

            <h3 className="max-w-[20ch] text-2xl leading-tight font-medium tracking-tight md:text-3xl">
              Every output is versioned. Approve, revise, or reject.
            </h3>

            {/* Mock review log — Dense list */}
            <ul className="mt-8 flex flex-col gap-[1px] bg-border border border-border rounded-lg overflow-hidden">
              {reviewLog.map((entry) => {
                const isSuccess = entry.tone === 'success';
                const isWarn = entry.tone === 'warn';
                return (
                  <li
                    className={`flex items-center justify-between bg-card px-4 py-2.5 text-sm`}
                    key={entry.id}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[0.65rem] tracking-[0.16em] uppercase text-muted-foreground">
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
                    <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
                      {entry.meta}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </article>

        {/* Stage 01 — Source */}
        <article className="bg-background p-7 md:col-span-5 md:p-8 flex flex-col">
          <header className="flex items-center justify-between border-b border-border pb-4 mb-6">
            <div className="flex items-center gap-3">
              <FileText className="size-4 text-muted-foreground" strokeWidth={1.5} />
              <span className="font-mono text-[0.7rem] tracking-[0.16em] uppercase text-muted-foreground">
                STAGE 01 · Source
              </span>
            </div>
            <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
              PRD §7.1
            </span>
          </header>
          <div className="flex-1 flex flex-col justify-end">
            <p className="text-sm leading-relaxed text-muted-foreground mb-4">
              Paste markdown or text. The studio validates length, language, and readiness before
              execution.
            </p>
            <div className="font-mono text-xs text-muted-foreground flex items-center gap-2 border border-border rounded-md px-3 py-2 bg-card">
              <span>
                status: <span className="text-brand-accent">validated</span>
              </span>
              <span className="text-border">|</span>
              <span>chars: 42,091</span>
            </div>
          </div>
        </article>

        {/* Stage 02 — Concept extraction */}
        <article className="bg-background p-7 md:col-span-5 md:p-8 flex flex-col overflow-hidden">
          <header className="flex items-center justify-between border-b border-border pb-4 mb-6">
            <div className="flex items-center gap-3">
              <Network className="size-4 text-muted-foreground" strokeWidth={1.5} />
              <span className="font-mono text-[0.7rem] tracking-[0.16em] uppercase text-muted-foreground">
                STAGE 02 · Graph
              </span>
            </div>
            <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
              PRD §7.2
            </span>
          </header>
          <p className="text-sm leading-relaxed text-muted-foreground mb-6">
            A Mastra agent extracts concepts with definitions and citations. Streams as it works.
          </p>
          <div className="mt-auto -mx-8">
            {/* Infinite Scroll Micro-Interaction */}
            <InfiniteScrollTrack speed={30}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="font-mono text-[0.7rem] whitespace-nowrap bg-card border border-border px-3 py-1.5 rounded uppercase text-muted-foreground flex items-center gap-2"
                >
                  <PulseBadge>
                    <span className="size-1.5 bg-brand-accent block rounded-full" />
                  </PulseBadge>
                  node_ext_{i}
                </div>
              ))}
            </InfiniteScrollTrack>
          </div>
        </article>

        {/* Stage 04 — Block-level revision */}
        <article className="bg-background p-7 md:col-span-6 md:p-8 flex flex-col">
          <header className="flex items-center justify-between border-b border-border pb-4 mb-6">
            <div className="flex items-center gap-3">
              <History className="size-4 text-muted-foreground" strokeWidth={1.5} />
              <span className="font-mono text-[0.7rem] tracking-[0.16em] uppercase text-muted-foreground">
                STAGE 04 · Revision
              </span>
            </div>
            <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
              PRD §7.5
            </span>
          </header>
          <p className="text-sm leading-relaxed text-muted-foreground mb-6">
            Lesson blocks regenerate on instruction. Versions are kept. Nothing publishes until
            approved.
          </p>
          <div className="mt-auto flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <span className="font-mono text-[0.65rem] tracking-[0.16em] uppercase text-brand-accent">
              prompt
            </span>
            <span className="flex-1 truncate text-sm text-foreground">
              rewrite explanation as a bookshelf analogy
            </span>
            <span
              aria-hidden
              className="inline-block h-3.5 w-[2px] bg-brand-accent stream-cursor"
            />
          </div>
        </article>

        {/* Stage 05 — Chat with material */}
        <article className="bg-background p-7 md:col-span-6 md:p-8 flex flex-col">
          <header className="flex items-center justify-between border-b border-border pb-4 mb-6">
            <div className="flex items-center gap-3">
              <MessageSquareText className="size-4 text-muted-foreground" strokeWidth={1.5} />
              <span className="font-mono text-[0.7rem] tracking-[0.16em] uppercase text-muted-foreground">
                STAGE 05 · Tutor
              </span>
            </div>
            <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
              PRD §7.9
            </span>
          </header>
          <p className="text-sm leading-relaxed text-muted-foreground mb-6">
            Learners chat through an Agentic RAG tutor. Every answer cites the section it came from.
          </p>
          <div className="mt-auto flex flex-col gap-1">
            <div className="font-mono text-xs text-muted-foreground flex items-center gap-2 mb-2">
              <span>Query: B-tree vs Table Scan</span>
            </div>
            <div className="relative border-l-2 border-brand-accent pl-4 py-1 text-sm text-foreground">
              The engine reads <span className="font-mono text-brand-accent">log₁₀₀(N)</span> pages
              instead of N rows.
              <div className="mt-2 flex items-center gap-2 font-mono text-[0.65rem] text-muted-foreground uppercase tracking-widest">
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
