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
    <section
      className="border-t border-border pt-16 pb-20 md:pt-24 md:pb-32"
      id="principles"
    >
      <header className="mb-12 max-w-[60ch] space-y-3">
        <Eyebrow>Principles</Eyebrow>
        <h2 className="text-3xl leading-[1.05] font-medium tracking-tight md:text-5xl">
          Reviewable. Grounded. Progressive.
        </h2>
      </header>

      <ul className="grid gap-[1px] overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-2">
        {principles.map((principle, index) => (
          <li
            className={`bg-background p-7 md:p-10 ${
              index === 0 ? 'md:col-span-2' : ''
            }`}
            key={principle.title}
          >
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[0.7rem] tabular-nums text-brand-accent">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="text-2xl leading-tight font-medium tracking-tight md:text-3xl text-foreground">
                {principle.title}
              </h3>
            </div>
            <p className="mt-4 max-w-[58ch] text-base leading-relaxed text-muted-foreground">
              {principle.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
