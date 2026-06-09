import { FileAudio, FileText, Gamepad2, LayoutTemplate, Network, Play } from 'lucide-react';
import { Eyebrow } from './home-shared';

const outputFormats = [
  {
    id: 'video',
    icon: Play,
    label: 'Video Guides',
    desc: 'Cinematic, auto-generated video lectures.',
  },
  {
    id: 'audio',
    icon: FileAudio,
    label: 'Audio Podcasts',
    desc: 'Studio-quality audio for hands-free learning.',
  },
  {
    id: 'slides',
    icon: LayoutTemplate,
    label: 'Interactive Decks',
    desc: 'Presentable slides with structured pacing.',
  },
  {
    id: 'game',
    icon: Gamepad2,
    label: 'Gamified Modules',
    desc: 'Branched scenarios and active recall tests.',
  },
];

export function WorkflowSection() {
  return (
    <section className="pt-20 pb-20 md:pt-32 md:pb-32" id="workflow">
      <header className="mx-auto mb-16 max-w-[800px] space-y-6 text-center">
        <Eyebrow>HOW_IT_WORKS</Eyebrow>
        <h2 className="text-foreground text-4xl leading-[1.1] font-light tracking-widest uppercase md:text-5xl">
          The alchemy of adaptive learning.
        </h2>
        <p className="text-muted-foreground/80 pt-2 font-mono text-sm leading-relaxed tracking-widest uppercase">
          &gt; Watch static text evolve. We parse your manuals and PDFs into a foundational
          knowledge graph, then instantly project it across multiple interactive formats.
        </p>
      </header>

      <div className="flex flex-col items-center justify-center gap-8 lg:flex-row lg:gap-10">
        {/* Source Document */}
        <div className="border-border/40 bg-background/50 relative flex w-full max-w-[280px] shrink-0 flex-col items-center justify-center rounded-none border p-8 text-center">
          <div className="border-brand-accent/50 absolute top-0 left-0 size-2 border-t border-l" />
          <div className="border-brand-accent/50 absolute right-0 bottom-0 size-2 border-r border-b" />

          <FileText className="text-foreground mb-6 size-12" strokeWidth={1} />
          <h3 className="mb-4 font-mono text-lg font-light tracking-widest uppercase">
            RAW_KNOWLEDGE
          </h3>
          <p className="text-muted-foreground/80 font-mono text-xs leading-relaxed tracking-wider uppercase">
            &gt; Upload dense, unformatted text—PDFs, operating manuals, or scattered documentation.
          </p>
        </div>

        {/* Arrow Indicator 1 */}
        <div className="text-border/80 hidden items-center lg:flex">
          <svg
            width="40"
            height="24"
            viewBox="0 0 40 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M0 12H38M38 12L28 2M38 12L28 22" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>
        <div className="text-border/80 flex items-center lg:hidden">
          <svg
            width="24"
            height="40"
            viewBox="0 0 24 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 0L12 38M12 38L2 28M12 38L22 28" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>

        {/* Knowledgebase Graph */}
        <div className="border-border/40 bg-brand-accent/5 text-foreground relative flex w-full max-w-[280px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-none border p-8 text-center">
          <div className="border-brand-accent absolute top-0 left-0 size-2 border-t border-l" />
          <div className="border-brand-accent absolute right-0 bottom-0 size-2 border-r border-b" />

          {/* subtle background pattern */}
          <div className="from-brand-accent/20 absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] via-transparent to-transparent bg-[length:20px_20px] opacity-20" />

          <Network className="text-brand-accent relative z-10 mb-6 size-12" strokeWidth={1} />
          <h3 className="text-brand-accent relative z-10 mb-4 font-mono text-lg font-light tracking-widest uppercase">
            SEMANTIC_GRAPH
          </h3>
          <p className="relative z-10 font-mono text-xs leading-relaxed tracking-wider uppercase opacity-80">
            &gt; The engine extracts concepts and relationships, mapping them into an intelligent
            neural graph.
          </p>
        </div>

        {/* Arrow Indicator 2 */}
        <div className="text-border/80 hidden items-center lg:flex">
          <svg
            width="40"
            height="24"
            viewBox="0 0 40 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M0 12H38M38 12L28 2M38 12L28 22" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>
        <div className="text-border/80 flex items-center lg:hidden">
          <svg
            width="24"
            height="40"
            viewBox="0 0 24 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 0L12 38M12 38L2 28M12 38L22 28" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>

        {/* Multimedia Outputs List */}
        <div className="border-border/40 bg-background/50 divide-border/40 relative flex w-full max-w-[360px] shrink-0 flex-col divide-y overflow-hidden rounded-none border">
          <div className="border-brand-accent/50 pointer-events-none absolute top-0 left-0 z-10 size-2 border-t border-l" />
          <div className="border-brand-accent/50 pointer-events-none absolute right-0 bottom-0 z-10 size-2 border-r border-b" />

          {outputFormats.map((format) => {
            const Icon = format.icon;
            return (
              <div
                key={format.id}
                className="group hover:bg-brand-accent/10 flex items-center gap-4 p-5 transition-colors"
              >
                <div className="bg-muted/50 border-border/40 group-hover:border-brand-accent/50 group-hover:bg-brand-accent/20 group-hover:text-brand-accent shrink-0 rounded-none border p-3 transition-all duration-300 ease-out">
                  <Icon className="size-5" strokeWidth={1} />
                </div>
                <div>
                  <h4 className="mb-1 font-mono text-[0.8rem] tracking-widest uppercase">
                    {format.label}
                  </h4>
                  <p className="text-muted-foreground/80 font-mono text-[0.65rem] leading-relaxed tracking-wider uppercase">
                    {format.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
