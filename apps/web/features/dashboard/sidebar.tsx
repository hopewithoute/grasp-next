'use client';

import Link from 'next/link';
import Image from 'next/image';
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
                <span className="font-mono text-[0.6rem] text-muted-foreground">{item.meta}</span>
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
              <Image
                alt=""
                className="rounded-full"
                height={32}
                src={viewer.imageUrl}
                width={32}
              />
            ) : (
              <div className="grid size-8 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {viewer.name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
            )}
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{viewer.name}</p>
                <p className="truncate text-xs text-muted-foreground">{viewer.email}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
