'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';

export async function signInWithGoogle() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect('/dashboard/projects');
  }

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

export async function logOut() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    await auth.api.signOut({
      headers: await headers(),
    });
  }
  
  redirect('/');
}
