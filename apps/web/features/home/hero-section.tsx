import Link from 'next/link';
import { ArrowUpRight, Gauge, FileText, Network, CheckCircle2 } from 'lucide-react';
import { Eyebrow } from './home-shared';
import { IntelligentList, LiquidGlassPanel, PulseBadge } from './motion-components';

const conceptStream = [
  { id: '1', label: 'B-tree index', value: 'log₁₀₀(N)' },
  { id: '2', label: 'Hash index', value: 'O(1) lookup' },
  { id: '3', label: 'Inverted index', value: 'Full-text match' },
  { id: '4', label: 'Bitmap index', value: 'Low-cardinality' },
];

export function HeroSection() {
  return (
    <section className="grid gap-12 pb-20 md:grid-cols-[1.2fr_0.8fr] md:gap-10 md:pb-32 items-center">
      <div className="space-y-8">
        <Eyebrow>v0.4 · MVP build</Eyebrow>

        <h1 className="max-w-[16ch] text-[clamp(2.6rem,5.4vw,5rem)] leading-[0.95] font-medium tracking-tighter">
          Turn raw material into a{' '}
          <span className="relative inline-block text-brand-accent">
            reviewable
            <span
              aria-hidden
              className="absolute -bottom-1 left-0 h-[2px] w-full bg-brand-accent/50"
            />
          </span>{' '}
          lesson, grounded in evidence.
        </h1>

        <p className="max-w-[58ch] text-base leading-relaxed text-muted-foreground md:text-lg">
          Adaptive Learning Studio extracts concepts, surfaces evidence, and generates lesson
          blocks you approve one at a time. A dense, high-agency workbench for creators.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-accent px-6 text-sm font-medium text-background transition-all hover:bg-brand-accent/90 active:scale-[0.98]"
            href="/sign-in"
          >
            Open creator workspace
            <ArrowUpRight
              className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              strokeWidth={1.5}
            />
          </Link>
          <a
            className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-6 text-sm text-foreground transition-colors hover:bg-muted"
            href="#workflow"
          >
            See the pipeline
          </a>
        </div>

        {/* Pipeline strip - Workbench Style */}
        <div className="pt-4 border-t border-border flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <FileText className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span className="font-mono tabular-nums text-muted-foreground">01</span>
            <span className="text-foreground">Source</span>
          </div>
          <span className="text-border">/</span>
          <div className="flex items-center gap-2">
            <Network className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span className="font-mono tabular-nums text-muted-foreground">02</span>
            <span className="text-foreground">Graph</span>
          </div>
          <span className="text-border">/</span>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 text-brand-accent" strokeWidth={1.5} />
            <span className="text-foreground font-medium">Review & Publish</span>
          </div>
        </div>
      </div>

      {/* Hero asset — Dense Tech Workbench Cockpit UI */}
      <div className="relative w-full">
        <LiquidGlassPanel className="p-0 border-border border">
          {/* Panel header */}
          <header className="flex items-center justify-between border-b border-border bg-card/40 px-5 py-3">
            <div className="flex items-center gap-3">
              <PulseBadge>
                <span className="size-2 rounded-full bg-brand-accent" />
              </PulseBadge>
              <span className="text-sm font-medium tracking-tight">Concept Extractor</span>
            </div>
            <div className="flex gap-4">
              <span className="font-mono text-[0.7rem] uppercase text-muted-foreground">v3 stream</span>
              <span className="font-mono text-[0.7rem] uppercase text-brand-accent">Live</span>
            </div>
          </header>

          <div className="p-5">
            {/* Intelligent List Micro-interaction */}
            <div className="mb-4">
              <p className="mb-2 font-mono text-[0.65rem] tracking-[0.16em] uppercase text-muted-foreground border-b border-border pb-2">
                Confidence Ranking
              </p>
              <IntelligentList items={conceptStream} />
            </div>

            {/* Stream-in row dense */}
            <div className="flex items-center gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
              <Gauge className="size-4 text-brand-accent" strokeWidth={1.5} />
              <span className="flex-1 font-mono text-xs">Extracting from §3.8: LSM Trees</span>
              <span aria-hidden className="inline-block h-3 w-[2px] bg-brand-accent stream-cursor" />
            </div>
          </div>

          {/* Footer log */}
          <footer className="flex items-center justify-between border-t border-border bg-card/40 px-5 py-3">
            <div className="flex items-center gap-3 font-mono text-[0.7rem] tabular-nums text-muted-foreground">
              <span>Tokens: <span className="text-foreground">2,418</span></span>
              <span>Latency: <span className="text-foreground">4.2s</span></span>
            </div>
            <span className="font-mono text-[0.65rem] tracking-[0.16em] uppercase text-brand-accent/70">
              [ human-in-the-loop ]
            </span>
          </footer>
        </LiquidGlassPanel>
      </div>
    </section>
  );
}
