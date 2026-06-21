'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */
import { memo, type ComponentProps, type HTMLAttributes } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MARKDOWN_REMARK_PLUGINS = [remarkGfm];

const MARKDOWN_COMPONENTS = {
  p: ({ node: _node, ...props }) => (
    <p className="text-foreground/90 whitespace-pre-wrap" {...props} />
  ),
  a: ({ node: _node, ...props }) => (
    <a
      className="text-brand-accent decoration-brand-accent/40 hover:text-brand-accent/80 underline underline-offset-4 transition-colors"
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      {props.children || 'link'}
    </a>
  ),
  strong: ({ node: _node, ...props }) => (
    <strong className="text-foreground font-semibold" {...props} />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul className="text-foreground/90 list-disc space-y-1 pl-4" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="text-foreground/90 list-decimal space-y-1 pl-4" {...props} />
  ),
  li: ({ node: _node, ...props }) => <li {...props} />,
  pre: ({ node: _node, ...props }) => (
    <pre
      className="border-border/40 text-muted-foreground/90 overflow-x-auto rounded-none border bg-black/40 p-3 font-mono text-[0.72rem] leading-5 [&>code]:border-0 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit"
      {...props}
    />
  ),
  code: ({ node: _node, ...props }: HTMLAttributes<HTMLElement> & { node?: unknown }) => (
    <code
      className="border-border/40 bg-muted/20 text-brand-accent rounded-none border px-1 py-0.5 font-mono text-[0.78em]"
      {...props}
    />
  ),
  h1: ({ node: _node, ...props }) => (
    <h1 className="text-foreground mt-4 mb-2 text-lg font-semibold" {...props}>
      {props.children}
    </h1>
  ),
  h2: ({ node: _node, ...props }) => (
    <h2 className="text-foreground mt-4 mb-2 text-base font-semibold" {...props}>
      {props.children}
    </h2>
  ),
  h3: ({ node: _node, ...props }) => (
    <h3 className="text-foreground mt-3 mb-1.5 text-sm font-semibold" {...props}>
      {props.children}
    </h3>
  ),
  table: ({ node: _node, ...props }) => (
    <div className="border-border/40 my-2 overflow-x-auto rounded-none border">
      <table
        className="text-foreground/90 w-full text-left font-mono text-xs tracking-widest uppercase"
        {...props}
      />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th
      className="border-border/40 bg-background/50 text-foreground border-b px-3 py-2 font-mono text-xs tracking-widest uppercase"
      {...props}
    />
  ),
  td: ({ node: _node, ...props }) => (
    <td className="border-border/40 border-b px-3 py-2 last:border-b-0" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="border-brand-accent/50 text-muted-foreground/70 border-l-2 pl-3 font-mono italic"
      {...props}
    />
  ),
} satisfies ComponentProps<typeof ReactMarkdown>['components'];

export const MarkdownText = memo(function MarkdownText({ text }: { text: string }) {
  if (!text) return null;

  return (
    <div className="space-y-2.5 break-words">
      <ReactMarkdown remarkPlugins={MARKDOWN_REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
