import Link from 'next/link';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { BrandMark, Eyebrow } from './home-shared';

export function CtaSection() {
  return (
    <>
      <section className="border-border/40 border-t pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="grid gap-8 md:grid-cols-[1.4fr_0.6fr] md:items-end">
          <div className="space-y-6">
            <Eyebrow>GET_STARTED</Eyebrow>
            <h2 className="text-foreground max-w-[20ch] text-3xl leading-[1.05] font-light tracking-widest uppercase md:text-5xl">
              Bring your documents. Leave with captivating multimedia.
            </h2>
            <p className="text-muted-foreground/80 max-w-[58ch] font-mono text-sm leading-relaxed tracking-widest uppercase">
              &gt; Sign in with Google. Upload your source material, review the plan, and watch the
              platform generate video and interactive assets automatically.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <Link
              className="group border-brand-accent/50 bg-brand-accent/10 text-brand-accent hover:bg-brand-accent hover:text-background inline-flex h-12 items-center justify-center gap-3 rounded-none border px-8 font-mono text-xs font-medium tracking-widest uppercase transition-all"
              href="/sign-in"
            >
              [ CONTINUE WITH GOOGLE ]
              <ArrowUpRight className="size-4" strokeWidth={1} />
            </Link>
            <p className="text-muted-foreground/60 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
              SECURE & STREAMLINED WORKFLOW
            </p>
          </div>
        </div>
      </section>

      <footer className="border-border/40 text-muted-foreground flex flex-col items-start justify-between gap-4 border-t py-10 text-xs md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <span className="text-foreground border-border/50 bg-background grid size-7 place-items-center rounded-none border shadow-sm">
            <BrandMark className="size-3.5" />
          </span>
          <span className="text-foreground font-mono text-[0.65rem] tracking-[0.2em] uppercase">
            [ ADAPTIVE LEARNING STUDIO ]
          </span>
        </div>
        <div className="text-muted-foreground/60 flex items-center gap-2 font-mono text-[0.65rem] tracking-widest uppercase">
          <CheckCircle2 className="size-3.5" strokeWidth={1} />
          <span>FROM KNOWLEDGEBASE TO MULTIMEDIA</span>
        </div>
      </footer>
    </>
  );
}
