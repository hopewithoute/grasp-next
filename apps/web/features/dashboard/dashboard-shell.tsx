'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Search, X } from 'lucide-react';
import { ThemeToggle } from '@/features/home/theme-toggle';
import { cn } from '@/lib/utils';
import { BrandMark, SidebarBody } from './sidebar';
import { sidebarVariants } from './sidebar-config';

const COLLAPSE_STORAGE_KEY = 'als.sidebar.collapsed';
type DashboardShellProps = {
  children: ReactNode;
  topBarSlot?: ReactNode;
  viewer: {
    email: string | null;
    imageUrl: string | null;
    name: string | null;
  } | null;
};
export function DashboardShell({ children, topBarSlot, viewer }: DashboardShellProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const hasTopBar = Boolean(topBarSlot);
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (stored === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsCollapsed(true);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);
  useEffect(() => {
    if (!isMobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobileOpen]);
  return (
    <div className="bg-background text-foreground fixed inset-0 flex overflow-hidden">
      {/* Desktop sidebar — sticky full viewport height */}
      <aside
        aria-label="Sidebar"
        className={cn(
          'h-full shrink-0 max-xl:!hidden xl:sticky xl:top-0 xl:z-30 xl:!flex',
          sidebarVariants({ collapsed: isCollapsed })
        )}
      >
        <SidebarBody
          collapsed={isCollapsed}
          onCollapseToggle={() => setIsCollapsed((current) => !current)}
          pathname={pathname}
          viewer={viewer}
        />
      </aside>
      {/* Mobile drawer overlay */}
      {isMobileOpen ? (
        <button
          aria-label="Close sidebar"
          className="bg-background/80 fixed inset-0 z-40 backdrop-blur-sm xl:hidden"
          onClick={() => setIsMobileOpen(false)}
          type="button"
        />
      ) : null}
      <aside
        aria-label="Sidebar"
        aria-modal={isMobileOpen ? 'true' : undefined}
        className={cn(
          'border-sidebar-border bg-sidebar fixed inset-y-0 left-0 z-50 flex h-full w-[18rem] flex-col border-r transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] xl:hidden',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        role={isMobileOpen ? 'dialog' : undefined}
      >
        <SidebarBody
          collapsed={false}
          onNavigate={() => setIsMobileOpen(false)}
          pathname={pathname}
          showCollapseToggle={false}
          viewer={viewer}
        />
      </aside>
      {/* Main column — scrolls independently */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        {hasTopBar ? (
          <header
            aria-label="Top navigation"
            className="bg-background/86 sticky top-0 z-30 flex min-h-20 items-center gap-3 px-3 py-2 backdrop-blur md:h-20 md:px-6 md:py-0 lg:px-8"
          >
            <button
              aria-controls="dashboard-sidebar"
              aria-expanded={isMobileOpen}
              aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
              className="border-border bg-card/50 text-muted-foreground hover:border-brand-accent-border hover:bg-brand-accent-surface hover:text-brand-accent-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors active:scale-[0.96] xl:hidden"
              onClick={() => setIsMobileOpen((current) => !current)}
              type="button"
            >
              {isMobileOpen ? (
                <X className="size-4" strokeWidth={1.5} />
              ) : (
                <Menu className="size-4" strokeWidth={1.5} />
              )}
            </button>
            <Link
              aria-label="Adaptive Learning Studio"
              className="hidden shrink-0 items-center gap-2.5 md:flex xl:hidden"
              href="/dashboard/projects"
            >
              <span className="border-brand-accent-border bg-brand-accent-surface text-brand-accent-foreground grid size-8 place-items-center rounded-lg border">
                <BrandMark className="size-4" />
              </span>
              <span className="hidden sm:block">
                <span className="text-foreground block text-sm font-medium tracking-tight">
                  Adaptive Learning Studio
                </span>
              </span>
            </Link>
            <div className="min-w-0 flex-1">{topBarSlot}</div>
            <div className="flex items-center gap-3">
              <button
                aria-label="Search"
                className="border-border bg-card/50 text-muted-foreground hover:border-brand-accent-border hover:bg-brand-accent-surface hover:text-foreground hidden h-10 w-[11.5rem] shrink-0 items-center justify-between gap-3 rounded-xl border px-3 transition-colors active:scale-[0.98] xl:inline-flex"
                type="button"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Search className="text-muted-foreground size-4 shrink-0" strokeWidth={1.5} />
                  <span className="truncate text-sm">Search</span>
                </span>
                <span className="border-border text-muted-foreground rounded-md border px-1.5 py-0.5 font-mono text-[0.62rem]">
                  Ctrl K
                </span>
              </button>
              <ThemeToggle />
            </div>
          </header>
        ) : null}
        <main
          className="w-full flex-1 px-4 py-6 md:px-8 md:py-8 lg:px-10 lg:py-10"
          id="main-content"
        >
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
