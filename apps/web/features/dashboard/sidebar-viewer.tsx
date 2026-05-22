'use client';

import { useTransition } from 'react';
import Image from 'next/image';
import { LogOut } from 'lucide-react';
import { signOut } from '@/features/auth/actions';
import { cn } from '@/lib/utils';

type SidebarViewerProps = {
  collapsed: boolean;
  email: string | null;
  imageUrl: string | null;
  name: string | null;
};

function getInitials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split('@')[0] || '';
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

/**
 * Identity row for the dashboard sidebar. In expanded state shows avatar,
 * display name, and an inline sign-out trigger. In collapsed state collapses
 * to just the avatar (sign-out moves to a long-press / hover affordance via
 * native title attribute fallback — explicit menu is out of scope here).
 */
export function SidebarViewer({ collapsed, email, imageUrl, name, }: SidebarViewerProps) {
  const [isPending, startTransition] = useTransition();
  const initials = getInitials(name, email);
  const displayName = name?.trim() || email?.split('@')[0] || 'Creator';
  const displayEmail = email ?? '—';

  const handleSignOut = () => {
    startTransition(() => {
      void signOut();
    });
  };

  if (collapsed) {
    return (
      <div className="flex justify-center px-2 py-3">
        <button
          aria-label={`Sign out ${displayName}`}
          className="group relative inline-flex size-9 items-center justify-center overflow-hidden rounded-full border border-border bg-brand-accent-surface text-[0.7rem] font-medium text-brand-accent-foreground transition-all hover:border-brand-accent-border active:scale-[0.96]"
          disabled={isPending}
          onClick={handleSignOut}
          title={`Sign out · ${displayName}`}
          type="button"
        >
          {imageUrl ? (
            <Image
              alt=""
              className="size-full object-cover transition-opacity group-hover:opacity-30"
              height={36}
              src={imageUrl}
              width={36}
            />
          ) : (
            <span
              aria-hidden
              className="font-mono tabular-nums tracking-tight transition-opacity group-hover:opacity-30"
            >
              {initials}
            </span>
          )}
          <LogOut
            aria-hidden
            className="absolute size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
            strokeWidth={1.5}
          />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3">
      <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-brand-accent-surface">
        {imageUrl ? (
          <Image alt="" className="size-full object-cover" height={36} src={imageUrl} width={36} />
        ) : (
          <span
            aria-hidden
            className="font-mono text-[0.7rem] font-medium tracking-tight tabular-nums text-brand-accent-foreground"
          >
            {initials}
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium tracking-tight text-foreground">
          {displayName}
        </p>
        <p className="truncate font-mono text-[0.65rem] tabular-nums text-muted-foreground">
          {displayEmail}
        </p>
      </div>

      <button
        aria-label="Sign out"
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card/50 text-muted-foreground transition-colors hover:border-status-danger-border hover:bg-status-danger-surface hover:text-status-danger-foreground active:scale-[0.96]',
          isPending && 'pointer-events-none opacity-50',
        )}
        disabled={isPending}
        onClick={handleSignOut}
        title="Sign out"
        type="button"
      >
        <LogOut className="size-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}
