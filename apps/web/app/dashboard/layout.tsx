import type { ReactNode } from 'react';
import { DashboardShell } from '@/features/dashboard/dashboard-shell';
import { getViewer } from '@/server/actor';

type DashboardLayoutProps = Readonly<{
  children: ReactNode;
  projectChrome: ReactNode;
}>;

export default async function DashboardLayout({
  children,
  projectChrome,
}: DashboardLayoutProps) {
  const viewer = await getViewer();

  return (
    <DashboardShell
      topBarSlot={projectChrome}
      viewer={
        viewer
          ? {
              email: viewer.email,
              imageUrl: viewer.imageUrl,
              name: viewer.name,
            }
          : null
      }
    >
      {children}
    </DashboardShell>
  );
}
