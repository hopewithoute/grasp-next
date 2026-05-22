import type { Metadata } from 'next';
import { HomeNav } from '@/features/home/home-nav';
import { HeroSection } from '@/features/home/hero-section';
import { WorkflowSection } from '@/features/home/workflow-section';
import { PrinciplesSection } from '@/features/home/principles-section';
import { StageGlossarySection } from '@/features/home/stage-glossary-section';
import { CtaSection } from '@/features/home/cta-section';

export const metadata: Metadata = {
  title: 'Adaptive Learning Studio',
  description: 'Reviewable AI for creators. Turn raw material into a reviewable lesson.',
};

export default function HomePage() {
  return (
    <main
      className="min-h-[100dvh] w-full overflow-x-hidden bg-background text-foreground"
      id="main-content"
    >
      <div className="relative mx-auto w-full max-w-[1400px] px-4 py-6 md:px-10">
        <HomeNav />
        <HeroSection />
        <WorkflowSection />
        <PrinciplesSection />
        <StageGlossarySection />
        <CtaSection />
      </div>
    </main>
  );
}
