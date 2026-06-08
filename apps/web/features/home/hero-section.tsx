import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, FileText, Gauge, Network } from 'lucide-react';
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
    <section className="grid items-center gap-12 pb-20 md:grid-cols-[1.2fr_0.8fr] md:gap-10 md:pb-32">
      <div className="space-y-8">
        <Eyebrow>v0.4 · MVP build</Eyebrow>

        <h1 className="max-w-[16ch] text-[clamp(2.6rem,5.4vw,5rem)] leading-[0.95] font-medium tracking-tighter">
          Turn raw material into a{' '}
          <span className="text-brand-accent relative inline-block">
            reviewable
            <span
              aria-hidden
              className="bg-brand-accent/50 absolute -bottom-1 left-0 h-[2px] w-full"
            />
          </span>{' '}
          lesson, grounded in evidence.
        </h1>

        <p className="text-muted-foreground max-w-[58ch] text-base leading-relaxed md:text-lg">
          Adaptive Learning Studio extracts concepts, surfaces evidence, and generates lesson blocks
          you approve one at a time. A dense, high-agency workbench for creators.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            className="group bg-brand-accent text-background hover:bg-brand-accent/90 inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition-all active:scale-[0.98]"
            href="/sign-in"
          >
            Open creator workspace
            <ArrowUpRight
              className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              strokeWidth={1.5}
            />
          </Link>
          <a
            className="border-border bg-card text-foreground hover:bg-muted inline-flex h-12 items-center justify-center rounded-full border px-6 text-sm transition-colors"
            href="#workflow"
          >
            See the pipeline
          </a>
        </div>

        {/* Pipeline strip - Workbench Style */}
        <div className="border-border flex flex-wrap items-center gap-4 border-t pt-4 text-xs">
          <div className="flex items-center gap-2">
            <FileText className="text-muted-foreground size-3.5" strokeWidth={1.5} />
            <span className="text-muted-foreground font-mono tabular-nums">01</span>
            <span className="text-foreground">Source</span>
          </div>
          <span className="text-border">/</span>
          <div className="flex items-center gap-2">
            <Network className="text-muted-foreground size-3.5" strokeWidth={1.5} />
            <span className="text-muted-foreground font-mono tabular-nums">02</span>
            <span className="text-foreground">Graph</span>
          </div>
          <span className="text-border">/</span>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-brand-accent size-3.5" strokeWidth={1.5} />
            <span className="text-foreground font-medium">Review & Publish</span>
          </div>
        </div>
      </div>

      {/* Hero asset — Dense Tech Workbench Cockpit UI */}
      <div className="relative w-full">
        <LiquidGlassPanel className="border-border border p-0">
          {/* Panel header */}
          <header className="border-border bg-card/40 flex items-center justify-between border-b px-5 py-3">
            <div className="flex items-center gap-3">
              <PulseBadge>
                <span className="bg-brand-accent size-2 rounded-full" />
              </PulseBadge>
              <span className="text-sm font-medium tracking-tight">Concept Extractor</span>
            </div>
            <div className="flex gap-4">
              <span className="text-muted-foreground font-mono text-[0.7rem] uppercase">
                v3 stream
              </span>
              <span className="text-brand-accent font-mono text-[0.7rem] uppercase">Live</span>
            </div>
          </header>

          <div className="p-5">
            {/* Intelligent List Micro-interaction */}
            <div className="mb-4">
              <p className="text-muted-foreground border-border mb-2 border-b pb-2 font-mono text-[0.65rem] tracking-[0.16em] uppercase">
                Confidence Ranking
              </p>
              <IntelligentList items={conceptStream} />
            </div>

            {/* Stream-in row dense */}
            <div className="border-border text-muted-foreground flex items-center gap-3 border-t pt-4 text-sm">
              <Gauge className="text-brand-accent size-4" strokeWidth={1.5} />
              <span className="flex-1 font-mono text-xs">Extracting from §3.8: LSM Trees</span>
              <span
                aria-hidden
                className="bg-brand-accent stream-cursor inline-block h-3 w-[2px]"
              />
            </div>
          </div>

          {/* Footer log */}
          <footer className="border-border bg-card/40 flex items-center justify-between border-t px-5 py-3">
            <div className="text-muted-foreground flex items-center gap-3 font-mono text-[0.7rem] tabular-nums">
              <span>
                Tokens: <span className="text-foreground">2,418</span>
              </span>
              <span>
                Latency: <span className="text-foreground">4.2s</span>
              </span>
            </div>
            <span className="text-brand-accent/70 font-mono text-[0.65rem] tracking-[0.16em] uppercase">
              [ human-in-the-loop ]
            </span>
          </footer>
        </LiquidGlassPanel>
      </div>
    </section>
  );
}
