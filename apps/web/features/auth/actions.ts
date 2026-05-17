'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';

export async function signInWithGoogle() {
  const response = await auth.api.signInSocial({
    body: {
      callbackURL: '/dashboard/projects',
      errorCallbackURL: '/sign-in?error=oauth',
      newUserCallbackURL: '/dashboard/projects',
      provider: 'google',
    },
    headers: await headers(),
  });

  if (!response.url) {
    redirect('/sign-in?error=oauth');
  }

  redirect(response.url);
}

export async function signOut() {
  await auth.api.signOut({
    headers: await headers(),
  });

  redirect('/');
}
