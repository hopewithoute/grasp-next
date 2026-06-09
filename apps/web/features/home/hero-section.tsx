import Link from 'next/link';
import { ArrowUpRight, Gamepad2, LayoutTemplate, Play } from 'lucide-react';
import { Eyebrow } from './home-shared';
import { FadeIn, FadeUp } from './motion-components';

export function HeroSection() {
  return (
    <section className="grid items-center gap-12 pt-10 pb-20 md:grid-cols-[1fr_1fr] md:gap-16 md:pb-32">
      <div className="space-y-8">
        <FadeUp delay={0.1}>
          <Eyebrow>SYS.INIT</Eyebrow>
        </FadeUp>

        <FadeUp delay={0.2}>
          <h1 className="text-foreground text-[clamp(2.6rem,5.4vw,4.5rem)] leading-[1.05] font-light tracking-tight uppercase">
            Reimagine your knowledgebase as captivating multimedia.
          </h1>
        </FadeUp>

        <FadeUp delay={0.3}>
          <p className="text-muted-foreground/80 max-w-[50ch] font-mono text-sm leading-relaxed tracking-widest uppercase">
            &gt; Streamline creation, engage users, and deliver dynamic learning experiences
            directly from your existing static documents.
          </p>
        </FadeUp>

        <FadeUp delay={0.4}>
          <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center">
            <Link
              className="group border-brand-accent/50 bg-brand-accent/10 text-brand-accent hover:bg-brand-accent hover:text-background inline-flex h-12 items-center justify-center gap-3 rounded-none border px-8 font-mono text-xs font-medium tracking-widest uppercase transition-all"
              href="/sign-in"
            >
              [ GET STARTED ]
              <ArrowUpRight className="size-4" strokeWidth={1} />
            </Link>
            <a
              className="border-border/40 bg-background text-foreground hover:bg-muted/50 inline-flex h-12 items-center justify-center rounded-none border px-8 font-mono text-xs font-medium tracking-widest uppercase transition-colors"
              href="#workflow"
            >
              [ SEE WORKFLOW ]
            </a>
          </div>
        </FadeUp>

        <FadeUp delay={0.5}>
          <div className="border-border/40 text-muted-foreground/60 flex flex-wrap items-center gap-6 border-t pt-6 font-mono text-[0.65rem] tracking-widest uppercase">
            <div className="flex items-center gap-2">
              <Play className="size-4" strokeWidth={1} />
              <span>VIDEO GUIDES</span>
            </div>
            <div className="flex items-center gap-2">
              <LayoutTemplate className="size-4" strokeWidth={1} />
              <span>INTERACTIVE DECKS</span>
            </div>
            <div className="flex items-center gap-2">
              <Gamepad2 className="size-4" strokeWidth={1} />
              <span>GAMIFIED MODULES</span>
            </div>
          </div>
        </FadeUp>
      </div>

      {/* Hero Asset - Veo 3 Video */}
      <FadeIn delay={0.4}>
        <div className="bg-muted/10 border-border/40 group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-none border">
          <div className="border-brand-accent/50 absolute top-0 left-0 z-10 size-2 border-t border-l" />
          <div className="border-brand-accent/50 absolute right-0 bottom-0 z-10 size-2 border-r border-b" />

          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 z-0 h-full w-full object-cover opacity-80 grayscale transition-all duration-700 group-hover:opacity-100 group-hover:grayscale-0"
          >
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>
        </div>
      </FadeIn>
    </section>
  );
}
