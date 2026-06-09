import { FileText, History, MessageSquareText, Network, PlaySquare } from 'lucide-react';
import { Eyebrow } from './home-shared';

const stageBlocks = [
  {
    body: 'Upload dense PDFs, operating manuals, or documentation. The engine instantly cleans and prepares your content for analysis.',
    icon: FileText,
    label: 'Source Ingestion',
    stage: '01',
  },
  {
    body: 'An intelligent semantic engine pulls concepts, definitions, and relationships into a foundational knowledge graph.',
    icon: Network,
    label: 'Knowledge Graphing',
    stage: '02',
  },
  {
    body: 'Automatically writes cinematic video scripts, audio podcast dialogues, and presentation speaker notes from the graph.',
    icon: MessageSquareText,
    label: 'Storyboarding',
    stage: '03',
  },
  {
    body: 'Render dynamic video lessons, synthesize studio-quality voiceovers, and compile interactive HTML5 gamified modules.',
    icon: PlaySquare,
    label: 'Multimedia Generation',
    stage: '04',
  },
  {
    body: 'Direct the AI to refine specific blocks. Every version is saved, so you can always roll back. Nothing publishes until you say so.',
    icon: History,
    label: 'Creator Review',
    stage: '05',
  },
];

export function StageGlossarySection() {
  return (
    <section className="pt-20 pb-20 md:pt-32 md:pb-32">
      <header className="mb-16 max-w-[800px] space-y-6">
        <Eyebrow>THE_ENGINE</Eyebrow>
        <h2 className="text-foreground text-4xl leading-[1.1] font-light tracking-widest uppercase md:text-5xl">
          Precision at every step.
        </h2>
        <p className="text-muted-foreground/80 pt-2 font-mono text-sm leading-relaxed tracking-widest uppercase">
          &gt; Every multimedia asset is systematically generated and reviewable. Nothing is
          hallucinated, and everything maps back to your original source material.
        </p>
      </header>

      <ol className="divide-border/40 border-border/40 divide-y border-t">
        {stageBlocks.map((block) => {
          const Icon = block.icon;
          return (
            <li
              className="group hover:bg-brand-accent/5 grid gap-4 py-8 transition-colors md:grid-cols-[100px_1fr] md:items-start md:gap-8 md:py-12"
              key={block.label}
            >
              <span className="text-muted-foreground/50 group-hover:text-brand-accent/70 pl-4 font-mono text-4xl font-light tracking-tighter transition-colors md:pl-6">
                {block.stage}
              </span>
              <div>
                <h3 className="text-foreground group-hover:text-brand-accent mb-3 flex items-center gap-3 font-mono text-lg font-light tracking-widest uppercase transition-colors">
                  <Icon
                    className="text-muted-foreground/60 group-hover:text-brand-accent size-5 transition-colors"
                    strokeWidth={1}
                  />
                  [ {block.label} ]
                </h3>
                <p className="text-muted-foreground/80 max-w-[60ch] font-mono text-xs leading-relaxed tracking-wider uppercase">
                  &gt; {block.body}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
