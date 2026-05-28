import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/theme-provider';
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
    <html lang="en" className={cn('font-sans', geist.variable)} suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {process.env.NODE_ENV === 'development' && (
          <script
            id="react-performance-measure-guard"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: `
                (() => {
                  const perf = window.performance;
                  if (!perf?.measure || perf.measure.__graspPatched) {
                    return;
                  }

                  const originalMeasure = perf.measure.bind(perf);

                  perf.measure = function guardedMeasure(name, ...args) {
                    try {
                      return originalMeasure(name, ...args);
                    } catch (error) {
                      const isReactComponentMeasure =
                        typeof name === 'string' && name.charCodeAt(0) === 8203;
                      const isNegativeTimestampError =
                        error instanceof Error &&
                        error.message.includes('A mark cannot start after its end');
                      
                      if (isReactComponentMeasure && isNegativeTimestampError) {
                        return null;
                      }
                      throw error;
                    }
                  };
                  perf.measure.__graspPatched = true;
                })();
              `,
            }}
          />
        )}
      </head>
      <body>
        <a
          className="sr-only z-50 rounded-full bg-brand-accent px-4 py-2 font-medium text-brand-accent-ink focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
          href="#main-content"
        >
          Skip to content
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
