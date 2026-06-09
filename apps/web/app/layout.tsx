import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import { MotionProvider } from '@/components/motion-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

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
    <html
      lang="en"
      className={cn('font-sans antialiased', geist.variable, geistMono.variable)}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <head>
        {process.env.NODE_ENV === 'development' && (
          <Script
            id="react-performance-measure-guard"
            strategy="afterInteractive"
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
          className="bg-brand-accent text-brand-accent-ink sr-only z-50 rounded-full px-4 py-2 font-medium focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
          href="#main-content"
        >
          Skip to content
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <MotionProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
