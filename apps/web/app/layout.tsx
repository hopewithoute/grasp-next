import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Adaptive Learning Studio',
  description: 'AI-powered content engine for conversational learning.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <body>
        <a
          className="sr-only z-50 rounded-full bg-[#53d1cb] px-4 py-2 font-medium text-[#061018] focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
          href="#main-content"
        >
          Skip to content
        </a>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
