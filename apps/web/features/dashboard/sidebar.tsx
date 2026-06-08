'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, navItemVariants, type NavItem } from './sidebar-config';

export type { NavItem };

export function BrandMark({ className = '' }: { className?: string }) {
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

export type SidebarBodyProps = {
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

export function SidebarBody({
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
          <span className="border-brand-accent-border bg-brand-accent-surface text-brand-accent-foreground grid size-9 shrink-0 place-items-center rounded-xl border">
            <BrandMark className="size-5" />
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="text-sidebar-foreground block truncate text-sm font-medium tracking-tight">
                Adaptive Learning Studio
              </span>
              <span className="text-muted-foreground block truncate text-[0.65rem] tracking-[0.18em] uppercase">
                Project studio
              </span>
            </span>
          ) : null}
        </Link>

        {showCollapseToggle && onCollapseToggle ? (
          <button
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'border-border bg-card/50 text-muted-foreground hover:border-brand-accent-border hover:bg-brand-accent-surface hover:text-brand-accent-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-xl border transition-colors',
              collapsed &&
                'border-sidebar-border bg-sidebar absolute top-5 -right-3 size-7 rounded-full border'
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
          <span className="bg-brand-accent pulse-soft size-1.5 rounded-full" />
          <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.18em] uppercase">
            Navigation
          </span>
        </div>
      ) : null}

      {/* Nav items */}
      <nav className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const isActive = item.match(pathname);
          const Icon = item.icon;

          return (
            <Link
              className={navItemVariants({ active: isActive, collapsed })}
              href={item.href}
              key={item.href}
              onClick={onNavigate}
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.5} />
              {!collapsed ? (
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                </span>
              ) : null}
              {!collapsed && item.meta ? (
                <span className="text-muted-foreground font-mono text-[0.6rem]">{item.meta}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto p-4">
        {viewer ? (
          <div className="flex items-center gap-3">
            {viewer.imageUrl ? (
              <Image alt="" className="rounded-full" height={32} src={viewer.imageUrl} width={32} />
            ) : (
              <div className="bg-muted text-muted-foreground grid size-8 place-items-center rounded-full text-xs font-medium">
                {viewer.name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
            )}
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">{viewer.name}</p>
                <p className="text-muted-foreground truncate text-xs">{viewer.email}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
