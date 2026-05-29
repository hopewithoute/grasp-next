'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ChevronsLeft,
  ChevronsRight,
  FolderKanban,
  Menu,
  Search,
  X,
} from 'lucide-react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/features/home/theme-toggle';
import { SidebarViewer } from './sidebar-viewer';

const COLLAPSE_STORAGE_KEY = 'als.sidebar.collapsed';

type NavItem = {
  href: string;
  icon: typeof FolderKanban;
  label: string;
  match: (pathname: string) => boolean;
  meta?: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard/projects',
    icon: FolderKanban,
    label: 'Projects',
    match: (pathname) => pathname.startsWith('/dashboard/projects'),
    meta: '01',
  },
];

const sidebarVariants = cva(
  'group/sidebar relative flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
  {
    variants: {
      collapsed: {
        false: 'w-[17.5rem]',
        true: 'w-[5rem]',
      },
    },
    defaultVariants: {
      collapsed: false,
    },
  }
);

const navItemVariants = cva(
  'group relative flex items-center rounded-2xl text-sm transition-all duration-200 ease-out',
  {
    variants: {
      active: {
        false: 'text-sidebar-foreground/62 hover:bg-sidebar-accent hover:text-sidebar-foreground',
        true: 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm',
      },
      collapsed: {
        false: 'gap-3 px-3.5 py-2.5',
        true: 'justify-center px-0 py-3',
      },
    },
    defaultVariants: {
      active: false,
      collapsed: false,
    },
  }
);

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

type SidebarBodyProps = {
  collapsed: boolean;
  onCollapseToggle?: () => void;
  onNavigate?: () => void;
  pathname: string;
  showCollapseToggle?: boolean;
  viewer: {
    email: string | null;
    imageUrl: string | null;
    name: string | null;
  } | null;
};

function SidebarBody({
  collapsed,
  onCollapseToggle,
  onNavigate,
  pathname,
  showCollapseToggle = true,
  viewer,
}: SidebarBodyProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand header */}
      <div className="flex items-center justify-between gap-3 p-4">
        <Link
          aria-label="Adaptive Learning Studio"
          className="flex min-w-0 items-center gap-3"
          href="/dashboard/projects"
          onClick={onNavigate}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand-accent-border bg-brand-accent-surface text-brand-accent-foreground">
            <BrandMark className="size-5" />
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium tracking-tight text-sidebar-foreground">
                Adaptive Learning Studio
              </span>
              <span className="block truncate text-[0.65rem] tracking-[0.18em] uppercase text-muted-foreground">
                Project studio
              </span>
            </span>
          ) : null}
        </Link>

        {showCollapseToggle && onCollapseToggle ? (
          <button
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card/50 text-muted-foreground transition-colors hover:border-brand-accent-border hover:bg-brand-accent-surface hover:text-brand-accent-foreground',
              collapsed &&
                'absolute -right-3 top-5 size-7 rounded-full border border-sidebar-border bg-sidebar'
            )}
            onClick={onCollapseToggle}
            type="button"
          >
            {collapsed ? (
              <ChevronsRight className="size-3.5" strokeWidth={1.5} />
            ) : (
              <ChevronsLeft className="size-4" strokeWidth={1.5} />
            )}
          </button>
        ) : null}
      </div>

      {/* Section eyebrow */}
      {!collapsed ? (
        <div className="flex items-center gap-2 px-4 pt-5 pb-2">
          <span className="size-1.5 rounded-full bg-brand-accent pulse-soft" />
          <span className="font-mono text-[0.65rem] tracking-[0.18em] uppercase text-muted-foreground">
            Workspace
          </span>
        </div>
      ) : (
        <div className="flex justify-center pt-5 pb-2">
          <span aria-hidden className="size-1.5 rounded-full bg-brand-accent pulse-soft" />
        </div>
      )}

      {/* Primary nav */}
      <nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);

            return (
              <li key={item.href}>
                <Link
                  aria-current={active ? 'page' : undefined}
                  className={navItemVariants({ active, collapsed })}
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                >
                  {/* Active hairline removed */}

                  <Icon
                    className={cn(
                      'size-4 shrink-0',
                      active
                        ? 'text-brand-accent-foreground'
                        : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground/80'
                    )}
                    strokeWidth={1.5}
                  />

                  {!collapsed ? (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.meta ? (
                        <span className="font-mono text-[0.65rem] tabular-nums text-muted-foreground">
                          {item.meta}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer — viewer + status strip, no card overuse */}
      <div className="border-t border-sidebar-border">
        {viewer ? (
          <div className="border-b border-sidebar-border">
            <SidebarViewer
              collapsed={collapsed}
              email={viewer.email}
              imageUrl={viewer.imageUrl}
              name={viewer.name}
            />
          </div>
        ) : null}

        <Link
          className={cn(
            'group flex items-center gap-3 px-4 py-3 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
            collapsed && 'justify-center px-0'
          )}
          href="/"
          onClick={onNavigate}
          title={collapsed ? 'Public landing' : undefined}
        >
          <ArrowLeft className="size-4 shrink-0" strokeWidth={1.5} />
          {!collapsed ? <span className="truncate">Public landing</span> : null}
        </Link>

        {!collapsed ? (
          <div className="flex items-center justify-between border-t border-sidebar-border px-4 py-3 font-mono text-[0.65rem] tabular-nums tracking-[0.14em] uppercase">
            <span className="text-muted-foreground">session</span>
            <span className="flex items-center gap-2 text-foreground/70">
              <span className="size-1.5 rounded-full bg-status-success-foreground pulse-soft" />
              <span>active</span>
            </span>
          </div>
        ) : (
          <div className="flex justify-center border-t border-sidebar-border py-3">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-status-success-foreground pulse-soft"
              title="Session active"
            />
          </div>
        )}
      </div>
    </div>
  );
}

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
  const hasTopBar = topBarSlot !== null && topBarSlot !== undefined;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const isHydratedRef = useRef(false);

  // Hydrate collapse preference from localStorage to avoid SSR/CSR flash.
  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
        if (stored === '1') {
          setIsCollapsed(true);
        }
      } catch {
        // Storage may be unavailable (private mode, SSR-only context). Ignore silently.
      }
      if (!cancelled) {
        isHydratedRef.current = true;
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    try {
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, isCollapsed ? '1' : '0');
    } catch {
      // Ignore.
    }
  }, [isCollapsed]);

  // Close mobile drawer on route change.
  useEffect(() => {
    queueMicrotask(() => setIsMobileOpen(false));
  }, [pathname]);

  // Lock body scroll while mobile drawer is open.
  useEffect(() => {
    if (!isMobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobileOpen]);

  // Close drawer on Escape.
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
