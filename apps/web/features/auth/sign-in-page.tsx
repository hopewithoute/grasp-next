import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getActor } from '@/server/actor';
import { signInWithGoogle } from './actions';

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export async function SignInPage({ searchParams }: SignInPageProps) {
  const actor = await getActor();

  if (actor) {
    redirect('/dashboard/projects');
  }

  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-6 py-10 text-[#171916]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center">
        <section className="grid w-full gap-10 border-y border-[#171916]/15 py-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-6">
            <p className="text-xs font-semibold tracking-[0.28em] text-[#5c634f] uppercase">
              Adaptive Learning Studio
            </p>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl leading-[1.02] font-semibold text-balance md:text-6xl">
                Turn raw teaching material into a reviewable AI lesson.
              </h1>
              <p className="max-w-xl text-base leading-7 text-[#5c634f] md:text-lg">
                Sign in with Google to start a creator workspace, keep projects tied to your
                account, and review every generated artifact before publishing.
              </p>
            </div>
          </div>

          <div className="border border-[#171916]/15 bg-white p-5 shadow-[8px_8px_0_#d7e0bf]">
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Creator access</h2>
                <p className="mt-1 text-sm leading-6 text-[#5c634f]">
                  One Google flow handles both first-time registration and returning sign-in.
                </p>
              </div>

              {params.error ? (
                <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  Google sign-in could not be completed. Please try again.
                </p>
              ) : null}

              <form action={signInWithGoogle}>
                <Button
                  className="h-11 w-full gap-3 rounded-md bg-[#171916] px-4 text-sm text-white hover:bg-[#2a2d27]"
                  type="submit"
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[#171916]">
                    G
                  </span>
                  Continue with Google
                </Button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
