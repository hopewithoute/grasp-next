import { FileText, History, MessageSquareText, Network, Quote } from 'lucide-react';
import { Eyebrow } from './home-shared';

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

export function StageGlossarySection() {
  return (
    <section className="border-border border-t pt-16 pb-20 md:pt-24 md:pb-32">
      <header className="mb-10 grid gap-6 md:grid-cols-[0.4fr_0.6fr] md:items-end">
        <div className="space-y-3">
          <Eyebrow>Stage glossary</Eyebrow>
          <h2 className="text-3xl leading-[1.05] font-medium tracking-tight md:text-4xl">
            What happens at each step.
          </h2>
        </div>
        <p className="text-muted-foreground max-w-[58ch] text-sm leading-relaxed">
          The studio is project-scoped. Source, graph, lesson, publish: all live inside one
          workspace, with its own review surface and version history.
        </p>
      </header>

      <ol className="divide-border border-border divide-y border-y">
        {stageBlocks.map((block) => {
          const Icon = block.icon;
          return (
            <li
              className="grid gap-3 py-6 md:grid-cols-[80px_1fr_auto] md:items-baseline md:gap-8 md:py-7"
              key={block.label}
            >
              <span className="text-brand-accent font-mono text-sm tabular-nums">
                {block.stage}
              </span>
              <div>
                <h3 className="text-foreground flex items-center gap-2.5 text-lg font-medium tracking-tight">
                  <Icon className="text-muted-foreground size-4" strokeWidth={1.5} />
                  {block.label}
                </h3>
                <p className="text-muted-foreground mt-2 max-w-[70ch] text-sm leading-relaxed">
                  {block.body}
                </p>
              </div>
              <span className="text-muted-foreground font-mono text-[0.7rem] tabular-nums md:text-right">
                {block.cite}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
