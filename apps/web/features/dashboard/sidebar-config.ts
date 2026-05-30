import { FolderKanban } from 'lucide-react';
import { cva } from 'class-variance-authority';

export type NavItem = {
  href: string;
  icon: typeof FolderKanban;
  label: string;
  match: (pathname: string) => boolean;
  meta?: string;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard/projects',
    icon: FolderKanban,
    label: 'Projects',
    match: (pathname) => pathname.startsWith('/dashboard/projects'),
    meta: '01',
  },
];

export const sidebarVariants = cva(
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

export const navItemVariants = cva(
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
