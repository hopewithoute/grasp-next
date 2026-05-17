import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, CircleAlert, Quote, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getActor } from '@/server/actor';
import { signInWithGoogle } from './actions';

type SignInPageProps = {
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
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
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
      className="min-h-[100dvh] w-full overflow-x-hidden bg-[#07111b] text-[#f3efe3]"
      id="main-content"
    >
      {/* Ambient — single accent only */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 select-none">
        <div className="ambient-float absolute -top-40 right-[-8rem] h-80 w-80 rounded-full bg-[#53d1cb]/10 blur-3xl" />
        <div className="ambient-float absolute bottom-[-6rem] left-[-8rem] h-72 w-72 rounded-full bg-[#53d1cb]/[0.06] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.06),_transparent_42%),linear-gradient(180deg,_rgba(3,8,14,0.6),_rgba(3,8,14,0.96))]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1400px] px-4 py-6 md:px-10">
        {/* Nav — slim */}
        <nav
          aria-label="Primary"
          className="mb-12 flex items-center justify-between rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur md:mb-20"
        >
          <Link className="flex items-center gap-3" href="/">
            <span className="grid size-9 place-items-center rounded-full border border-[#53d1cb]/30 bg-[#53d1cb]/8 text-[#53d1cb]">
              <BrandMark className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-medium tracking-tight">Adaptive Learning Studio</span>
              <span className="block text-[0.7rem] tracking-[0.16em] uppercase text-[#f3efe3]/52">
                Creator sign-in
              </span>
            </span>
          </Link>

          <Link
            className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm text-[#f3efe3]/72 transition-colors hover:text-[#f3efe3]"
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
              <span className="inline-flex items-center gap-2 text-[0.7rem] tracking-[0.18em] uppercase text-[#f3efe3]/62">
                <span className="size-1.5 rounded-full bg-[#53d1cb] pulse-soft" />
                <span className="font-mono">Step 00 · Authenticate</span>
              </span>

              <h1 className="max-w-[18ch] text-[clamp(2.4rem,4.8vw,4.4rem)] leading-[1] font-medium tracking-[-0.04em]">
                Sign in to continue your{' '}
                <span className="relative inline-block">
                  pipeline
                  <span
                    aria-hidden
                    className="absolute -bottom-2 left-0 h-[3px] w-full rounded-full bg-[#53d1cb]"
                  />
                </span>
                .
              </h1>

              <p className="max-w-[52ch] text-base leading-relaxed text-[#f3efe3]/68 md:text-lg">
                Adaptive Learning Studio uses a single creator entry. Google handles both
                first-time registration and returning sessions. There is no password to manage and
                nothing to verify by email.
              </p>
            </div>

            {/* Trust strip — divide-y, no card overuse */}
            <ul className="divide-y divide-white/8 border-y border-white/8">
              <li className="grid grid-cols-[28px_1fr_auto] items-baseline gap-4 py-4">
                <ShieldCheck className="size-4 text-[#53d1cb]" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium text-[#f3efe3]">Single creator entry</p>
                  <p className="mt-1 text-sm leading-relaxed text-[#f3efe3]/58">
                    Project ownership, source material, and approvals stay tied to your Google
                    identity.
                  </p>
                </div>
                <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.16em] uppercase text-[#f3efe3]/42">
                  PRD §6
                </span>
              </li>
              <li className="grid grid-cols-[28px_1fr_auto] items-baseline gap-4 py-4">
                <Quote className="size-4 text-[#53d1cb]" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium text-[#f3efe3]">Reviewable by default</p>
                  <p className="mt-1 text-sm leading-relaxed text-[#f3efe3]/58">
                    Nothing publishes without your approval. Every artifact is versioned,
                    grounded, and cited.
                  </p>
                </div>
                <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.16em] uppercase text-[#f3efe3]/42">
                  PRD §7.7
                </span>
              </li>
            </ul>
          </div>

          {/* Auth card — single accent panel */}
          <aside className="md:sticky md:top-8 md:self-start">
            <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d1824]/92 p-7 shadow-[0_40px_120px_rgba(0,0,0,0.42)] backdrop-blur md:p-8">
              {/* Panel header */}
              <header className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[#53d1cb] pulse-soft" />
                  <span className="text-sm font-medium tracking-tight">Creator access</span>
                </div>
                <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.16em] uppercase text-[#f3efe3]/42">
                  oauth/google
                </span>
              </header>

              <div className="mt-7 space-y-5">
                <div>
                  <span className="font-mono text-[0.65rem] tracking-[0.18em] uppercase text-[#f3efe3]/42">
                    Method
                  </span>
                  <h2 className="mt-2 text-xl leading-tight font-medium tracking-tight">
                    Continue with Google
                  </h2>
                  <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-[#f3efe3]/62">
                    Authorize once. We create your account on first sign-in and reuse it on every
                    return.
                  </p>
                </div>

                {hasError ? (
                  <div
                    className="flex items-start gap-3 rounded-2xl border border-[#e5685b]/30 bg-[#e5685b]/8 px-4 py-3 text-sm text-[#f4a8a0]"
                    role="alert"
                  >
                    <CircleAlert className="size-4 shrink-0 translate-y-0.5" strokeWidth={1.5} />
                    <div>
                      <p className="font-medium text-[#f4a8a0]">Sign-in could not complete</p>
                      <p className="mt-1 text-[#f4a8a0]/82">
                        Google returned an error. Try again, or check that third-party cookies are
                        allowed.
                      </p>
                    </div>
                  </div>
                ) : null}

                <form action={signInWithGoogle}>
                  <Button
                    aria-label="Continue with Google"
                    className="group h-12 w-full rounded-full border border-[#53d1cb]/24 bg-[#53d1cb] px-5 text-sm font-medium text-[#041018] transition-all hover:bg-[#7ceae3] active:translate-y-[1px]"
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
                <div className="flex items-center justify-between border-t border-white/8 pt-4 font-mono text-[0.7rem] tabular-nums">
                  <span className="text-[#f3efe3]/42">session</span>
                  <span className="flex items-center gap-2 text-[#f3efe3]/72">
                    <span className="size-1.5 rounded-full bg-[#f3efe3]/42" />
                    awaiting
                  </span>
                </div>
              </div>
            </article>

            <p className="mt-4 px-2 text-center font-mono text-[0.7rem] tracking-[0.14em] uppercase text-[#f3efe3]/42">
              Better Auth · Google OAuth · MVP
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}
