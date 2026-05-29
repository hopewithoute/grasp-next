import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, CircleAlert, Quote, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getActor } from '@/server/actor';
import { signInWithGoogle } from './actions';

export type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="4.5" cy="6" r="1.4" />
      <circle cx="20" cy="9" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <line x1="12" x2="4.5" y1="12" y2="6" />
      <line x1="12" x2="20" y1="12" y2="9" />
      <line x1="12" x2="17" y1="12" y2="20" />
    </svg>
  );
}

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
      className="min-h-[100dvh] w-full overflow-x-hidden bg-background text-foreground"
      id="main-content"
    >
      <div className="relative mx-auto w-full max-w-[1400px] px-4 py-6 md:px-10">
        {/* Nav — slim */}
        <nav
          aria-label="Primary"
          className="mb-12 flex items-center justify-between rounded-full border border-border bg-background/80 px-4 py-3 backdrop-blur md:mb-20"
        >
          <Link className="flex items-center gap-3" href="/">
            <span className="grid size-9 place-items-center rounded-full border border-brand-accent-border bg-brand-accent-surface text-brand-accent-foreground">
              <BrandMark className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-medium tracking-tight">
                Adaptive Learning Studio
              </span>
              <span className="block text-[0.7rem] tracking-[0.16em] uppercase text-muted-foreground">
                Creator sign-in
              </span>
            </span>
          </Link>

          <Link
            className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="/"
          >
            <ArrowLeft className="size-4" strokeWidth={1.5} />
            <span className="hidden sm:inline">Back to landing</span>
          </Link>
        </nav>

        {/* Asymmetric layout — left context, right auth panel */}
        <section className="grid gap-12 pb-20 md:grid-cols-[1fr_440px] md:gap-16 md:pb-32 lg:grid-cols-[1fr_480px]">
          <div className="flex flex-col justify-between gap-12 md:py-6">
            <div className="space-y-8">
              <span className="inline-flex items-center gap-2 text-[0.7rem] tracking-[0.18em] uppercase text-muted-foreground">
                <span className="size-1.5 rounded-full bg-brand-accent pulse-soft" />
                <span className="font-mono">Step 00 · Authenticate</span>
              </span>

              <h1 className="max-w-[18ch] text-[clamp(2.4rem,4.8vw,4.4rem)] leading-[1] font-medium tracking-[-0.04em]">
                Sign in to continue your{' '}
                <span className="relative inline-block">
                  pipeline
                  <span
                    aria-hidden
                    className="absolute -bottom-2 left-0 h-[3px] w-full rounded-full bg-brand-accent"
                  />
                </span>
                .
              </h1>

              <p className="max-w-[52ch] text-base leading-relaxed text-muted-foreground md:text-lg">
                Adaptive Learning Studio uses a single creator entry. Google handles both first-time
                registration and returning sessions. There is no password to manage and nothing to
                verify by email.
              </p>
            </div>

            {/* Trust strip — divide-y, no card overuse */}
            <ul className="divide-y divide-border border-y border-border">
              <li className="grid grid-cols-[28px_1fr_auto] items-baseline gap-4 py-4">
                <ShieldCheck className="size-4 text-brand-accent" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium text-foreground">Single creator entry</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Project ownership, source material, and approvals stay tied to your Google
                    identity.
                  </p>
                </div>
                <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.16em] uppercase text-muted-foreground">
                  PRD §6
                </span>
              </li>
              <li className="grid grid-cols-[28px_1fr_auto] items-baseline gap-4 py-4">
                <Quote className="size-4 text-brand-accent" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium text-foreground">Reviewable by default</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Nothing publishes without your approval. Every artifact is versioned, grounded,
                    and cited.
                  </p>
                </div>
                <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.16em] uppercase text-muted-foreground">
                  PRD §7.7
                </span>
              </li>
            </ul>
          </div>

          {/* Auth card — single accent panel */}
          <aside className="md:sticky md:top-8 md:self-start">
            <article className="overflow-hidden rounded-[2rem] border border-border bg-card p-7 shadow-sm md:p-8">
              {/* Panel header */}
              <header className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-brand-accent pulse-soft" />
                  <span className="text-sm font-medium tracking-tight">Creator access</span>
                </div>
                <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.16em] uppercase text-muted-foreground">
                  oauth/google
                </span>
              </header>

              <div className="mt-7 space-y-5">
                <div>
                  <span className="font-mono text-[0.65rem] tracking-[0.18em] uppercase text-muted-foreground">
                    Method
                  </span>
                  <h2 className="mt-2 text-xl leading-tight font-medium tracking-tight">
                    Continue with Google
                  </h2>
                  <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-muted-foreground">
                    Authorize once. We create your account on first sign-in and reuse it on every
                    return.
                  </p>
                </div>

                {hasError ? (
                  <div
                    className="flex items-start gap-3 rounded-2xl border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm text-status-danger-foreground"
                    role="alert"
                  >
                    <CircleAlert className="size-4 shrink-0 translate-y-0.5" strokeWidth={1.5} />
                    <div>
                      <p className="font-medium">Sign-in could not complete</p>
                      <p className="mt-1 opacity-80">
                        Google returned an error. Try again, or check that third-party cookies are
                        allowed.
                      </p>
                    </div>
                  </div>
                ) : null}

                <form action={signInWithGoogle}>
                  <Button
                    aria-label="Continue with Google"
                    className="group h-12 w-full rounded-full border border-brand-accent-border bg-brand-accent px-5 text-sm font-medium text-[#041018] transition-all hover:opacity-90 active:translate-y-[1px]"
                    type="submit"
                  >
                    <GoogleGlyph className="mr-2 inline-flex size-5 rounded-full bg-white p-0.5" />
                    Continue with Google
                    <ArrowUpRight
                      className="ml-2 size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      strokeWidth={1.5}
                    />
                  </Button>
                </form>

                {/* Hairline status strip */}
                <div className="flex items-center justify-between border-t border-border pt-4 font-mono text-[0.7rem] tabular-nums">
                  <span className="text-muted-foreground">session</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-muted-foreground" />
                    awaiting
                  </span>
                </div>
              </div>
            </article>

            <p className="mt-4 px-2 text-center font-mono text-[0.7rem] tracking-[0.14em] uppercase text-muted-foreground">
              Better Auth · Google OAuth · MVP
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}
