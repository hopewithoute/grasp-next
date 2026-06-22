import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getActor } from '@/server/actor';
import { signInWithGoogle } from './actions';
import { AuthErrorToast } from './auth-error-toast';

export type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function GoogleGlyph({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.51h3.232c1.891-1.741 2.981-4.305 2.981-7.351z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.964-.895 6.619-2.422l-3.232-2.51c-.895.6-2.04.955-3.387.955-2.605 0-4.81-1.76-5.595-4.123H3.064v2.59A9.997 9.997 0 0 0 12 22z"
        fill="#34A853"
      />
      <path
        d="M6.405 13.9a5.997 5.997 0 0 1 0-3.8V7.51H3.064a9.998 9.998 0 0 0 0 8.98l3.341-2.59z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.977c1.468 0 2.787.504 3.823 1.495l2.868-2.868C16.96 2.99 14.696 2 12 2A9.997 9.997 0 0 0 3.064 7.51L6.405 10.1C7.19 7.737 9.395 5.977 12 5.977z"
        fill="#EA4335"
      />
    </svg>
  );
}

export async function SignInPage({ searchParams }: SignInPageProps) {
  const actor = await getActor();

  if (actor) {
    redirect('/dashboard/projects');
  }

  const params = await searchParams;
  const hasError = Boolean(params.error);

  return (
    <main
      className="bg-background text-foreground min-h-[100dvh] w-full overflow-x-hidden"
      id="main-content"
    >
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1400px] flex-col items-center justify-center px-4">
        {/* Subtle Back Button */}
        <div className="absolute top-8 left-4 md:left-10">
          <Link
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.2em] uppercase transition-colors"
            href="/"
          >
            <ArrowLeft className="size-4" strokeWidth={1.5} />[ BACK_TO_LANDING ]
          </Link>
        </div>

        {/* Centered Auth Panel */}
        <section className="w-full max-w-[440px]">
          <article className="border-border/40 bg-background/50 relative border p-8">
            <div className="border-brand-accent/50 absolute top-0 left-0 size-2 border-t border-l" />
            <div className="border-brand-accent/50 absolute right-0 bottom-0 size-2 border-r border-b" />

            <header className="border-border/40 flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="bg-brand-accent animate-pulse-soft size-1.5 rounded-none"
                />
                <span className="text-brand-accent font-mono text-[0.65rem] tracking-widest uppercase">
                  [ SYS.AUTH ]
                </span>
              </div>
              <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.2em] uppercase">
                [ OAUTH_GOOGLE ]
              </span>
            </header>

            <div className="mt-8 space-y-8">
              <div>
                <h2 className="text-foreground text-3xl font-light tracking-widest uppercase">
                  [ TERMINAL_INIT ]
                </h2>
                <p className="text-muted-foreground/80 mt-4 font-mono text-xs leading-relaxed uppercase">
                  &gt; Establish connection to creative workspace.
                  <br />
                  &gt; Graph ingestion standby.
                </p>
              </div>

              {hasError ? (
                <>
                  <AuthErrorToast hasError={hasError} />
                  <div
                    className="border-status-danger-border/50 bg-status-danger-surface/20 text-status-danger-foreground border px-4 py-3 font-mono text-[0.65rem] tracking-widest uppercase"
                    role="alert"
                  >
                    [ ERR ] Connection failed. Please allow third-party cookies and retry.
                  </div>
                </>
              ) : null}

              <form action={signInWithGoogle}>
                <Button
                  aria-label="Continue with Google"
                  className="border-brand-accent/50 bg-brand-accent/10 text-brand-accent hover:bg-brand-accent hover:text-background group h-12 w-full rounded-none border font-mono text-xs tracking-widest uppercase transition-all"
                  type="submit"
                >
                  <GoogleGlyph className="mr-3 size-4 opacity-80 grayscale transition-all group-hover:opacity-100 group-hover:grayscale-0" />
                  [ CONTINUE WITH GOOGLE ]
                </Button>
              </form>

              <div className="border-border/40 text-muted-foreground/60 flex items-center justify-between border-t pt-6 font-mono text-[0.65rem] tracking-widest uppercase">
                <span>[ PORT: CLOSED ]</span>
                <span>[ AWAITING_HANDSHAKE ]</span>
              </div>
            </div>
          </article>

          <p className="text-muted-foreground/40 mt-8 text-center font-mono text-[0.65rem] tracking-[0.2em] uppercase">
            [ SECURE_SINGLE_CREATOR_ENTRY ]
          </p>
        </section>
      </div>
    </main>
  );
}
