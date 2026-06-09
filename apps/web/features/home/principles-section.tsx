import { Eyebrow } from './home-shared';

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

export function PrinciplesSection() {
  return (
    <section className="pt-20 pb-20 md:pt-32 md:pb-32" id="principles">
      <header className="mb-20 max-w-[60ch] space-y-6">
        <Eyebrow>PRINCIPLES</Eyebrow>
        <h2 className="text-foreground text-4xl leading-[1.1] font-light tracking-widest uppercase md:text-6xl">
          Built on Trust.
        </h2>
      </header>

      <ul className="grid gap-12 md:gap-16 lg:grid-cols-3">
        {principles.map((principle, index) => (
          <li className="border-border/40 flex flex-col gap-4 border-t pt-8" key={principle.title}>
            <span className="text-brand-accent/50 font-mono text-5xl font-light tracking-tighter">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="text-foreground mt-4 font-mono text-lg font-light tracking-widest uppercase">
              [ {principle.title} ]
            </h3>
            <p className="text-muted-foreground/80 mt-2 max-w-[50ch] font-mono text-xs leading-relaxed tracking-wider uppercase">
              &gt; {principle.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
