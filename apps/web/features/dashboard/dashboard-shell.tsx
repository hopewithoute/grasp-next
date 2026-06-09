'use client';

import { useTransition, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LogOut, Search, Settings, User } from 'lucide-react';
import { SystemStatusTicker } from '@/components/system-status-ticker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logOut } from '@/features/auth/actions';
import { ThemeToggle } from '@/features/home/theme-toggle';
import { BrandMark } from './sidebar';

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
  const [isPendingLogout, startLogout] = useTransition();

  return (
    <div className="bg-background text-foreground fixed inset-0 flex flex-col overflow-hidden">
      {/* Main column — scrolls independently */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <SystemStatusTicker className="sticky top-0 z-50 w-full shrink-0" />
        <header
          aria-label="Top navigation"
          className="bg-background/60 sticky top-6 z-30 flex min-h-20 shrink-0 items-center justify-center border-b border-transparent px-4 py-2 backdrop-blur-2xl md:h-20 md:px-8 md:py-0 lg:px-12 xl:px-16"
        >
          <div className="flex w-full max-w-[1600px] items-center justify-between gap-3">
            {/* Left side (Logo & Context) */}
            <div className="flex min-w-0 flex-1 items-center gap-6">
              <Link
                aria-label="Adaptive Learning Studio"
                className="group flex shrink-0 items-center gap-4 transition-opacity hover:opacity-80"
                href="/dashboard/projects"
              >
                <span className="border-brand-accent/50 bg-background text-brand-accent group-hover:bg-brand-accent/10 grid size-9 shrink-0 place-items-center rounded-none border shadow-[0_0_10px_rgba(0,255,128,0.1)] transition-colors">
                  <BrandMark className="size-5" />
                </span>
                <span className="hidden sm:block">
                  <span className="text-foreground block font-mono text-xs tracking-widest uppercase">
                    [ ADAPTIVE_LEARNING_STUDIO ]
                  </span>
                </span>
              </Link>
            </div>

            {/* Center (Global Command Palette) */}
            <div className="hidden flex-1 justify-center lg:flex">
              <button
                aria-label="Search"
                className="border-border/40 bg-background/50 text-muted-foreground/70 hover:border-brand-accent/50 hover:bg-brand-accent/10 hover:text-brand-accent inline-flex h-10 w-[20rem] items-center justify-between gap-3 rounded-none border px-4 transition-all xl:w-[24rem]"
                type="button"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Search className="size-4 shrink-0" strokeWidth={1} />
                  <span className="truncate font-mono text-[0.65rem] tracking-widest uppercase">
                    [ SEARCH SYSTEM... ]
                  </span>
                </span>
                <span className="text-brand-accent/50 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
                  [ ⌘K ]
                </span>
              </button>
            </div>

            {/* Right side (Actions & Profile) */}
            <div className="flex flex-1 items-center justify-end gap-4">
              <ThemeToggle />

              {viewer ? (
                <div className="border-border/50 flex items-center gap-3 border-l pl-2">
                  <div className="hidden min-w-0 text-right md:block">
                    <p className="text-foreground truncate font-mono text-[0.65rem] tracking-[0.2em] uppercase">
                      {viewer.name}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger className="border-border/40 hover:border-brand-accent/50 cursor-pointer rounded-none border p-0.5 transition-all focus:outline-none">
                      {viewer.imageUrl ? (
                        <Image
                          alt=""
                          className="block rounded-none contrast-125 grayscale"
                          height={32}
                          src={viewer.imageUrl}
                          width={32}
                        />
                      ) : (
                        <div className="bg-muted/20 text-muted-foreground grid size-8 place-items-center rounded-none font-mono text-xs">
                          {viewer.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                      )}
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                      align="end"
                      className="border-border/40 bg-background/95 w-56 rounded-none border p-1 backdrop-blur-md"
                      sideOffset={8}
                    >
                      <div className="px-3 py-2 font-mono">
                        <div className="flex flex-col space-y-1">
                          <p className="text-foreground text-xs font-light tracking-widest uppercase">
                            {viewer.name}
                          </p>
                          <p className="text-muted-foreground/80 text-[0.65rem] tracking-wider uppercase">
                            {viewer.email}
                          </p>
                        </div>
                      </div>
                      <DropdownMenuSeparator className="bg-border/40" />
                      <DropdownMenuItem className="focus:bg-brand-accent/10 focus:text-brand-accent cursor-pointer rounded-none font-mono text-[0.65rem] tracking-widest uppercase transition-colors">
                        <User className="mr-3 size-3.5" strokeWidth={1} />
                        <span>[ PROFILE ]</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="focus:bg-brand-accent/10 focus:text-brand-accent cursor-pointer rounded-none font-mono text-[0.65rem] tracking-widest uppercase transition-colors">
                        <Settings className="mr-3 size-3.5" strokeWidth={1} />
                        <span>[ SETTINGS ]</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border/40" />
                      <DropdownMenuItem
                        className="cursor-pointer rounded-none font-mono text-[0.65rem] tracking-widest text-red-500/80 uppercase transition-colors focus:bg-red-500/10 focus:text-red-500"
                        disabled={isPendingLogout}
                        onClick={() => {
                          startLogout(async () => {
                            await logOut();
                          });
                        }}
                      >
                        <LogOut className="mr-3 size-3.5" strokeWidth={1} />
                        <span>{isPendingLogout ? '[ LOGGING OUT... ]' : '[ LOG OUT ]'}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {topBarSlot}

        <main
          className="w-full flex-1 px-4 py-8 md:px-8 md:py-12 lg:px-12 lg:py-16 xl:px-16"
          id="main-content"
        >
          <div className="bg-crosshairs relative mx-auto min-h-[50vh] w-full max-w-[1600px] p-1">
            <div className="h-full w-full">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
