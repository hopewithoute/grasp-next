import 'server-only';

import type { Actor } from '@grasp/domain';
import { headers } from 'next/headers';
import { auth } from './auth';

export async function getActor(): Promise<Actor | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user.id) {
    return null;
  }

  return {
    id: session.user.id,
  };
}
