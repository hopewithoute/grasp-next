'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Menu, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/features/home/theme-toggle';
import {
  BrandMark,
  SidebarBody,
} from './sidebar';
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
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true';
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const hasTopBar = Boolean(topBarSlot);
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
    <div className="fixed inset-0 flex overflow-hidden bg-background text-foreground">
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
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm xl:hidden"
          onClick={() => setIsMobileOpen(false)}
          type="button"
        />
      ) : null}
      <aside
        aria-label="Sidebar"
        aria-modal={isMobileOpen ? 'true' : undefined}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full w-[18rem] flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] xl:hidden',
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
            className="sticky top-0 z-30 flex min-h-20 items-center gap-3 bg-background/86 px-3 py-2 backdrop-blur md:h-20 md:px-6 md:py-0 lg:px-8"
          >
            <button
              aria-controls="dashboard-sidebar"
              aria-expanded={isMobileOpen}
              aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card/50 text-muted-foreground transition-colors hover:border-brand-accent-border hover:bg-brand-accent-surface hover:text-brand-accent-foreground active:scale-[0.96] xl:hidden"
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
              <span className="grid size-8 place-items-center rounded-lg border border-brand-accent-border bg-brand-accent-surface text-brand-accent-foreground">
                <BrandMark className="size-4" />
              </span>
              <span className="hidden sm:block">
                <span className="block text-sm font-medium tracking-tight text-foreground">
                  Adaptive Learning Studio
                </span>
              </span>
            </Link>
            <div className="min-w-0 flex-1">{topBarSlot}</div>
            <div className="flex items-center gap-3">
              <button
                aria-label="Search"
                className="hidden h-10 w-[11.5rem] shrink-0 items-center justify-between gap-3 rounded-xl border border-border bg-card/50 px-3 text-muted-foreground transition-colors hover:border-brand-accent-border hover:bg-brand-accent-surface hover:text-foreground active:scale-[0.98] xl:inline-flex"
                type="button"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                  <span className="truncate text-sm">Search</span>
                </span>
                <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[0.62rem] text-muted-foreground">
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
