import 'server-only';

import type { Actor } from '@grasp/domain';
import { headers } from 'next/headers';
import { auth } from './auth';

export type Viewer = {
  email: string | null;
  id: string;
  imageUrl: string | null;
  name: string | null;
};

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

/**
 * UI-only view of the authenticated user. Returns display fields (name, email,
 * avatar) sourced from Better Auth. Keep domain `Actor` narrow; surface this
 * type to render identity in shells, headers, and similar UI surfaces.
 */
export async function getViewer(): Promise<Viewer | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user.id) {
    return null;
  }

  const { user } = session;

  return {
    email: user.email ?? null,
    id: user.id,
    imageUrl: user.image ?? null,
    name: user.name ?? null,
  };
}
