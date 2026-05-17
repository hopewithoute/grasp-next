import Link from 'next/link';
import {
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Gauge,
  History,
  MessageSquareText,
  Network,
  Quote,
} from 'lucide-react';

const pipeline = [
  { label: 'Source', stage: '01' },
  { label: 'Graph', stage: '02' },
  { label: 'Lesson', stage: '03' },
  { label: 'Publish', stage: '04' },
];

const conceptStream = [
  {
    confidence: 92,
    definition: 'A self-balancing tree structure ordered by key range.',
    evidence: '§3.2',
    name: 'B-tree index',
  },
  {
    confidence: 87,
    definition: 'Direct lookup table mapping a hashed key to a row pointer.',
    evidence: '§3.4',
    name: 'Hash index',
  },
  {
    confidence: 64,
    definition: 'Index designed for full-text search across columns.',
    evidence: '§3.7',
    name: 'Inverted index',
  },
];

const reviewLog = [
  { actor: 'You', delta: 'approved', label: 'Concept graph', meta: 'v3', tone: 'success' as const },
  { actor: 'AI', delta: 'extracted', label: '12 concepts, 7 prerequisites', meta: '4.2s', tone: 'neutral' as const },
  { actor: 'You', delta: 'requested revision', label: 'Lesson §2.1', meta: 'v2', tone: 'warn' as const },
];

const stageBlocks = [
  {
    body: 'Paste markdown or text. The studio validates length, language, and readiness before the pipeline begins.',
    cite: 'PRD §7.1',
    icon: FileText,
    label: 'Source intake',
    stage: '01',
  },
  {
    body: 'A Mastra agent extracts concepts with definitions, prerequisites, and citation back to the source. Streams as it works.',
    cite: 'PRD §7.2',
    icon: Network,
    label: 'Concept extraction',
    stage: '02',
  },
  {
    body: 'Review every node with its confidence and source span. Approve, reject, or revise with a natural-language instruction.',
    cite: 'PRD §7.7',
    icon: Quote,
    label: 'Reviewable artifacts',
    stage: '03',
  },
  {
    body: 'Lesson blocks regenerate one at a time on instruction. Versions are kept. Nothing publishes until you say so.',
    cite: 'PRD §7.5',
    icon: History,
    label: 'Block-level revision',
    stage: '04',
  },
  {
    body: 'Learners chat with the source through an Agentic RAG tutor. Every answer cites the section it came from.',
    cite: 'PRD §7.9',
    icon: MessageSquareText,
    label: 'Chat with material',
    stage: '05',
  },
];

const principles = [
  {
    body: 'No artifact reaches a learner without an explicit approval. Every revision is a new version, not a silent overwrite.',
    title: 'Reviewable',
  },
  {
    body: 'Each generated claim points back to a source span. Confidence is shown, not hidden behind a chat bubble.',
    title: 'Grounded',
  },
  {
    body: 'Source, graph, lesson, publish. The studio always shows the next action, not a wall of metrics.',
    title: 'Progressive',
  },
];

function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="4.5" cy="6" r="1.4" />
      <circle cx="20" cy="9" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <line x1="12" x2="4.5" y1="12" y2="6" />
      <line x1="12" x2="20" y1="12" y2="9" />
      <line x1="12" x2="17" y1="12" y2="20" />
    </svg>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[0.7rem] tracking-[0.18em] uppercase text-[#f3efe3]/62">
      <span className="size-1.5 rounded-full bg-[#53d1cb] pulse-soft" />
      <span className="font-mono">{children}</span>
    </span>
  );
}

function ConfidenceGauge({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-[#53d1cb]"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-[#f3efe3]/72">{value}%</span>
    </div>
  );
}

export default function HomePage() {
  return (
    <main
      className="min-h-[100dvh] w-full overflow-x-hidden bg-[#07111b] text-[#f3efe3]"
      id="main-content"
    >
      {/* Ambient — single accent only */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 select-none"
      >
        <div className="ambient-float absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-[#53d1cb]/10 blur-3xl" />
        <div className="ambient-float absolute top-[60%] -right-40 h-[22rem] w-[22rem] rounded-full bg-[#53d1cb]/[0.06] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_38%),linear-gradient(180deg,_rgba(3,8,14,0.55),_rgba(3,8,14,0.96))]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1400px] px-4 py-6 md:px-10">
        {/* Nav */}
        <nav
          aria-label="Primary"
          className="mb-16 flex items-center justify-between rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur"
        >
          <Link className="flex items-center gap-3" href="/">
            <span className="grid size-9 place-items-center rounded-full border border-[#53d1cb]/30 bg-[#53d1cb]/8 text-[#53d1cb]">
              <BrandMark className="size-5 brand-mark-spin" />
            </span>
            <span>
              <span className="block text-sm font-medium tracking-tight">Adaptive Learning Studio</span>
              <span className="block text-[0.7rem] tracking-[0.16em] uppercase text-[#f3efe3]/52">
                Reviewable AI for creators
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <a
              className="hidden h-10 items-center rounded-full px-4 text-sm text-[#f3efe3]/72 transition-colors hover:text-[#f3efe3] sm:inline-flex"
              href="#workflow"
            >
              How it works
            </a>
            <a
              className="hidden h-10 items-center rounded-full px-4 text-sm text-[#f3efe3]/72 transition-colors hover:text-[#f3efe3] sm:inline-flex"
              href="#principles"
            >
              Principles
            </a>
            <Link
              className="inline-flex h-10 items-center rounded-full bg-[#53d1cb] px-5 text-sm font-medium text-[#041018] transition-colors hover:bg-[#7ceae3] active:scale-[0.98]"
              href="/sign-in"
            >
              Sign in
              <ArrowUpRight className="ml-1.5 size-4" strokeWidth={1.5} />
            </Link>
          </div>
        </nav>

        {/* Hero — asymmetric, left-aligned text + right asset */}
        <section className="grid gap-12 pb-20 md:grid-cols-[1.15fr_0.85fr] md:gap-10 md:pb-32">
          <div className="space-y-8">
            <Eyebrow>v0.4 · MVP build</Eyebrow>

            <h1 className="max-w-[18ch] text-[clamp(2.6rem,5.4vw,4.8rem)] leading-[0.98] font-medium tracking-[-0.04em]">
              Turn raw material into a{' '}
              <span className="relative inline-block">
                reviewable
                <span
                  aria-hidden
                  className="absolute -bottom-2 left-0 h-[3px] w-full rounded-full bg-[#53d1cb]"
                />
              </span>{' '}
              lesson, then let learners talk to it.
            </h1>

            <p className="max-w-[58ch] text-base leading-relaxed text-[#f3efe3]/68 md:text-lg">
              Adaptive Learning Studio extracts concepts, surfaces evidence, and generates lesson
              blocks you approve one at a time. Then it hands the lesson to learners as a tutor
              that cites every answer.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#53d1cb] px-6 text-sm font-medium text-[#041018] transition-all hover:bg-[#7ceae3] active:translate-y-[1px]"
                href="/sign-in"
              >
                Open creator workspace
                <ArrowUpRight
                  className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  strokeWidth={1.5}
                />
              </Link>
              <a
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 text-sm text-[#f3efe3]/82 transition-colors hover:bg-white/[0.08]"
                href="#workflow"
              >
                See the pipeline
              </a>
            </div>

            {/* Pipeline strip */}
            <div className="pt-2">
              <ol className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                {pipeline.map((step, index) => (
                  <li className="flex items-center gap-2" key={step.label}>
                    <span className="font-mono tabular-nums text-[#f3efe3]/42">{step.stage}</span>
                    <span className="text-[#f3efe3]/82">{step.label}</span>
                    {index < pipeline.length - 1 ? (
                      <span aria-hidden className="text-[#f3efe3]/28">
                        ──
                      </span>
                    ) : null}
                  </li>
                ))}
                <li className="flex items-center gap-2 rounded-full border border-[#53d1cb]/30 bg-[#53d1cb]/10 px-3 py-1 text-[#8af2eb]">
                  <span className="size-1.5 rounded-full bg-[#53d1cb] pulse-soft" />
                  <span className="font-mono text-[0.7rem] tracking-[0.14em] uppercase">
                    Chat with material
                  </span>
                </li>
              </ol>
            </div>
          </div>

          {/* Hero asset — mock graph review panel */}
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(circle_at_30%_20%,_rgba(83,209,203,0.16),_transparent_55%)]"
            />
            <article className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d1824]/92 p-5 shadow-[0_40px_120px_rgba(0,0,0,0.42)] backdrop-blur md:p-6">
              {/* Panel header */}
              <header className="flex items-center justify-between border-b border-white/8 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="size-2 rounded-full bg-[#53d1cb] pulse-soft" />
                  <span className="text-sm font-medium tracking-tight">Concept graph</span>
                  <span className="font-mono text-[0.7rem] text-[#f3efe3]/42">v3 · streaming</span>
                </div>
                <span className="rounded-full border border-emerald-500/24 bg-emerald-500/8 px-2.5 py-1 text-[0.65rem] font-medium tracking-[0.16em] uppercase text-emerald-400">
                  Approved
                </span>
              </header>

              {/* Concept stream */}
              <ul className="mt-4 space-y-3">
                {conceptStream.map((concept) => (
                  <li
                    className="group relative rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition-colors hover:bg-white/[0.05]"
                    key={concept.name}
                  >
                    {/* Evidence ribbon */}
                    <span
                      aria-hidden
                      className="absolute top-3 bottom-3 left-0 w-[2px] rounded-full bg-[#53d1cb]/72"
                    />
                    <div className="flex items-start justify-between gap-3 pl-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium tracking-tight text-[#f3efe3]">
                          {concept.name}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-[#f3efe3]/62">
                          {concept.definition}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[0.7rem] tabular-nums text-[#53d1cb]">
                        {concept.evidence}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between pl-3">
                      <ConfidenceGauge value={concept.confidence} />
                      <span className="font-mono text-[0.65rem] tracking-[0.14em] uppercase text-[#f3efe3]/42">
                        cited
                      </span>
                    </div>
                  </li>
                ))}

                {/* Stream-in row */}
                <li className="flex items-center gap-3 rounded-2xl border border-dashed border-white/8 px-4 py-3 text-sm text-[#f3efe3]/52">
                  <Gauge className="size-4 text-[#53d1cb]" strokeWidth={1.5} />
                  <span className="flex-1">Extracting next concept from §3.8</span>
                  <span aria-hidden className="inline-block h-3 w-[2px] bg-[#53d1cb] stream-cursor" />
                </li>
              </ul>

              {/* Footer log */}
              <footer className="mt-5 flex items-center justify-between border-t border-white/8 pt-4">
                <div className="flex items-center gap-2 font-mono text-[0.7rem] tabular-nums text-[#f3efe3]/52">
                  <span>tokens</span>
                  <span className="text-[#f3efe3]/82">2,418</span>
                  <span className="text-[#f3efe3]/28">·</span>
                  <span>latency</span>
                  <span className="text-[#f3efe3]/82">4.2s</span>
                </div>
                <span className="text-[0.7rem] tracking-[0.16em] uppercase text-[#f3efe3]/42">
                  human-in-the-loop
                </span>
              </footer>
            </article>
          </div>
        </section>

        {/* Workflow — asymmetric Bento */}
        <section className="border-t border-white/8 pt-16 pb-20 md:pt-24 md:pb-32" id="workflow">
          <header className="mb-12 grid gap-8 md:grid-cols-[0.42fr_0.58fr] md:items-end">
            <div className="space-y-3">
              <Eyebrow>The pipeline</Eyebrow>
              <h2 className="text-3xl leading-[1.05] font-medium tracking-[-0.03em] md:text-5xl">
                Five stages.
                <br />
                One studio.
              </h2>
            </div>
            <p className="max-w-[60ch] text-base leading-relaxed text-[#f3efe3]/62 md:text-lg">
              Each stage is a checkpoint. The studio suspends the pipeline at every review so the
              creator stays in control of what reaches the learner.
            </p>
          </header>

          {/* Asymmetric bento — 1 large + 4 staggered */}
          <div className="grid gap-4 md:grid-cols-12 md:auto-rows-[minmax(220px,auto)]">
            {/* Featured stage 03 — Reviewable artifacts */}
            <article className="relative overflow-hidden rounded-[2rem] border border-[#53d1cb]/20 bg-gradient-to-br from-[#53d1cb]/[0.07] to-transparent p-7 md:col-span-7 md:row-span-2 md:p-10">
              <header className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-2xl border border-[#53d1cb]/30 bg-[#53d1cb]/10 text-[#53d1cb]">
                    <Quote className="size-5" strokeWidth={1.5} />
                  </span>
                  <div>
                    <span className="block font-mono text-[0.7rem] tracking-[0.18em] text-[#53d1cb]/82">
                      STAGE 03
                    </span>
                    <span className="block text-sm font-medium tracking-tight">
                      Reviewable artifacts
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[0.7rem] tabular-nums text-[#f3efe3]/42">
                  PRD §7.7
                </span>
              </header>

              <h3 className="mt-10 max-w-[18ch] text-2xl leading-[1.1] font-medium tracking-[-0.02em] md:text-3xl">
                Every output is a versioned artifact you approve, revise, or reject.
              </h3>

              {/* Mock review log */}
              <ul className="mt-8 space-y-2">
                {reviewLog.map((entry) => {
                  const toneStyles = {
                    neutral: 'border-white/12 bg-white/[0.03] text-[#f3efe3]/72',
                    success: 'border-emerald-500/24 bg-emerald-500/8 text-emerald-300',
                    warn: 'border-[#f4b860]/30 bg-[#f4b860]/8 text-[#f4b860]',
                  };
                  return (
                    <li
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${toneStyles[entry.tone]}`}
                      key={`${entry.actor}-${entry.label}-${entry.meta}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[0.65rem] tracking-[0.16em] uppercase opacity-72">
                          {entry.actor}
                        </span>
                        <span className="opacity-92">{entry.delta}</span>
                        <span className="text-[#f3efe3]/82">{entry.label}</span>
                      </div>
                      <span className="font-mono text-[0.7rem] tabular-nums opacity-72">
                        {entry.meta}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {/* Hairline shimmer along bottom */}
              <div
                aria-hidden
                className="hairline-shimmer absolute right-10 bottom-10 left-10 h-[1px] bg-white/8"
              />
            </article>

            {/* Stage 01 — Source */}
            <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.025] p-7 md:col-span-5 md:p-8">
              <header className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl border border-white/12 bg-white/[0.04]">
                    <FileText className="size-4 text-[#f3efe3]/82" strokeWidth={1.5} />
                  </span>
                  <span className="font-mono text-[0.7rem] tracking-[0.18em] text-[#f3efe3]/42">
                    STAGE 01
                  </span>
                </div>
                <span className="font-mono text-[0.7rem] tabular-nums text-[#f3efe3]/42">
                  PRD §7.1
                </span>
              </header>
              <h3 className="mt-8 text-xl leading-tight font-medium tracking-tight">
                Source intake
              </h3>
              <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-[#f3efe3]/62">
                Paste markdown or text. The studio validates length, language, and readiness
                before the pipeline begins.
              </p>
            </article>

            {/* Stage 02 — Concept extraction */}
            <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.025] p-7 md:col-span-5 md:p-8">
              <header className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl border border-white/12 bg-white/[0.04]">
                    <Network className="size-4 text-[#f3efe3]/82" strokeWidth={1.5} />
                  </span>
                  <span className="font-mono text-[0.7rem] tracking-[0.18em] text-[#f3efe3]/42">
                    STAGE 02
                  </span>
                </div>
                <span className="font-mono text-[0.7rem] tabular-nums text-[#f3efe3]/42">
                  PRD §7.2
                </span>
              </header>
              <h3 className="mt-8 text-xl leading-tight font-medium tracking-tight">
                Concept extraction
              </h3>
              <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-[#f3efe3]/62">
                A Mastra agent extracts concepts with definitions, prerequisites, and citations.
                Streams as it works.
              </p>
            </article>

            {/* Stage 04 — Block-level revision */}
            <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.025] p-7 md:col-span-6 md:p-8">
              <header className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl border border-white/12 bg-white/[0.04]">
                    <History className="size-4 text-[#f3efe3]/82" strokeWidth={1.5} />
                  </span>
                  <span className="font-mono text-[0.7rem] tracking-[0.18em] text-[#f3efe3]/42">
                    STAGE 04
                  </span>
                </div>
                <span className="font-mono text-[0.7rem] tabular-nums text-[#f3efe3]/42">
                  PRD §7.5
                </span>
              </header>
              <h3 className="mt-8 text-xl leading-tight font-medium tracking-tight">
                Block-level revision
              </h3>
              <p className="mt-3 max-w-[44ch] text-sm leading-relaxed text-[#f3efe3]/62">
                Lesson blocks regenerate one at a time on instruction. Versions are kept. Nothing
                publishes until you say so.
              </p>

              <div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/8 bg-[#07111b]/72 px-3 py-2.5">
                <span className="font-mono text-[0.7rem] tracking-[0.16em] uppercase text-[#f3efe3]/42">
                  prompt
                </span>
                <span className="flex-1 truncate text-sm text-[#f3efe3]/82">
                  rewrite explanation as a bookshelf analogy
                </span>
                <span aria-hidden className="inline-block h-3.5 w-[2px] bg-[#53d1cb] stream-cursor" />
              </div>
            </article>

            {/* Stage 05 — Chat with material */}
            <article className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.025] p-7 md:col-span-6 md:p-8">
              <header className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl border border-white/12 bg-white/[0.04]">
                    <MessageSquareText className="size-4 text-[#f3efe3]/82" strokeWidth={1.5} />
                  </span>
                  <span className="font-mono text-[0.7rem] tracking-[0.18em] text-[#f3efe3]/42">
                    STAGE 05
                  </span>
                </div>
                <span className="font-mono text-[0.7rem] tabular-nums text-[#f3efe3]/42">
                  PRD §7.9
                </span>
              </header>
              <h3 className="mt-8 text-xl leading-tight font-medium tracking-tight">
                Chat with material
              </h3>
              <p className="mt-3 max-w-[44ch] text-sm leading-relaxed text-[#f3efe3]/62">
                Learners chat with the source through an Agentic RAG tutor. Every answer cites the
                section it came from.
              </p>

              <div className="mt-6 space-y-2">
                <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 text-sm text-[#f3efe3]/82">
                  Why is a B-tree faster than a table scan at 1M rows?
                </div>
                <div className="relative rounded-2xl border border-[#53d1cb]/24 bg-[#53d1cb]/[0.06] px-4 py-3 text-sm text-[#f3efe3]/92">
                  <span
                    aria-hidden
                    className="absolute top-3 bottom-3 left-0 w-[2px] rounded-full bg-[#53d1cb]"
                  />
                  <span className="block pl-3">
                    Because each lookup descends a tree of fan-out 100+, the engine reads
                    <span className="font-mono"> log₁₀₀(N) </span>
                    pages instead of N rows.
                  </span>
                  <span className="mt-2 flex items-center gap-2 pl-3 font-mono text-[0.7rem] text-[#53d1cb]">
                    <Quote className="size-3" strokeWidth={1.5} />
                    cited from §3.2, §3.4
                  </span>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* Principles — 2-col zig-zag, not 3-equal */}
        <section
          className="border-t border-white/8 pt-16 pb-20 md:pt-24 md:pb-32"
          id="principles"
        >
          <header className="mb-12 max-w-[60ch] space-y-3">
            <Eyebrow>Principles</Eyebrow>
            <h2 className="text-3xl leading-[1.05] font-medium tracking-[-0.03em] md:text-5xl">
              Reviewable. Grounded. Progressive.
            </h2>
          </header>

          <ul className="grid gap-px overflow-hidden rounded-[2rem] border border-white/10 bg-white/8 md:grid-cols-2">
            {principles.map((principle, index) => (
              <li
                className={`bg-[#07111b] p-7 md:p-10 ${
                  index === 0 ? 'md:col-span-2 md:border-b md:border-white/10' : ''
                }`}
                key={principle.title}
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[0.7rem] tabular-nums text-[#53d1cb]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-2xl leading-tight font-medium tracking-tight md:text-3xl">
                    {principle.title}
                  </h3>
                </div>
                <p className="mt-4 max-w-[58ch] text-base leading-relaxed text-[#f3efe3]/62">
                  {principle.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Stage glossary — horizontal divide-y, not cards */}
        <section className="border-t border-white/8 pt-16 pb-20 md:pt-24 md:pb-32">
          <header className="mb-10 grid gap-6 md:grid-cols-[0.4fr_0.6fr] md:items-end">
            <div className="space-y-3">
              <Eyebrow>Stage glossary</Eyebrow>
              <h2 className="text-3xl leading-[1.05] font-medium tracking-[-0.03em] md:text-4xl">
                What happens at each step.
              </h2>
            </div>
            <p className="max-w-[58ch] text-sm leading-relaxed text-[#f3efe3]/58">
              The studio is project-scoped. Source, graph, lesson, publish — all live inside one
              workspace, with its own review surface and version history.
            </p>
          </header>

          <ol className="divide-y divide-white/8 border-y border-white/8">
            {stageBlocks.map((block) => {
              const Icon = block.icon;
              return (
                <li
                  className="grid gap-3 py-6 md:grid-cols-[80px_1fr_auto] md:items-baseline md:gap-8 md:py-7"
                  key={block.label}
                >
                  <span className="font-mono text-sm tabular-nums text-[#53d1cb]">
                    {block.stage}
                  </span>
                  <div>
                    <h3 className="flex items-center gap-2.5 text-lg font-medium tracking-tight">
                      <Icon className="size-4 text-[#f3efe3]/72" strokeWidth={1.5} />
                      {block.label}
                    </h3>
                    <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-[#f3efe3]/62">
                      {block.body}
                    </p>
                  </div>
                  <span className="font-mono text-[0.7rem] tabular-nums text-[#f3efe3]/42 md:text-right">
                    {block.cite}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Closing — asymmetric, not centered CTA */}
        <section className="border-t border-white/8 pt-16 pb-12 md:pt-24 md:pb-16">
          <div className="grid gap-8 md:grid-cols-[1.4fr_0.6fr] md:items-end">
            <div className="space-y-4">
              <Eyebrow>Get started</Eyebrow>
              <h2 className="max-w-[20ch] text-3xl leading-[1.05] font-medium tracking-[-0.03em] md:text-5xl">
                Bring one chapter. Leave with a reviewed lesson.
              </h2>
              <p className="max-w-[58ch] text-base leading-relaxed text-[#f3efe3]/62">
                Sign in with Google. Create your first project. The pipeline starts as soon as you
                paste the source.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#53d1cb] px-6 text-sm font-medium text-[#041018] transition-all hover:bg-[#7ceae3] active:translate-y-[1px]"
                href="/sign-in"
              >
                Continue with Google
                <ArrowUpRight
                  className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  strokeWidth={1.5}
                />
              </Link>
              <p className="font-mono text-[0.7rem] tracking-[0.14em] uppercase text-[#f3efe3]/42">
                Single creator entry · OAuth only
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-col items-start justify-between gap-4 border-t border-white/8 py-10 text-xs text-[#f3efe3]/52 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <span className="grid size-7 place-items-center rounded-full border border-[#53d1cb]/30 bg-[#53d1cb]/8 text-[#53d1cb]">
              <BrandMark className="size-3.5" />
            </span>
            <span className="font-mono tracking-[0.14em] uppercase">
              Adaptive Learning Studio
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <CheckCircle2 className="size-3.5 text-[#53d1cb]" strokeWidth={1.5} />
            <span>Reviewable AI · Grounded · Progressive</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
