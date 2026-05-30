'use client';

import { memo, type ComponentProps, type HTMLAttributes } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MARKDOWN_REMARK_PLUGINS = [remarkGfm];

/* eslint-disable @typescript-eslint/no-unused-vars */
const MARKDOWN_COMPONENTS = {
  p: ({ node: _node, ...props }) => (
    <p className="whitespace-pre-wrap text-muted-foreground" {...props} />
  ),
  a: ({ node: _node, ...props }) => (
    <a
      className="text-[#9de7e2] underline decoration-[#53d1cb]/40 underline-offset-4 transition-colors hover:text-[#c8fffb]"
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      {props.children || 'link'}
    </a>
  ),
  strong: ({ node: _node, ...props }) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul className="list-disc space-y-1 pl-4 text-muted-foreground" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="list-decimal space-y-1 pl-4 text-muted-foreground" {...props} />
  ),
  li: ({ node: _node, ...props }) => <li {...props} />,
  pre: ({ node: _node, ...props }) => (
    <pre
      className="overflow-x-auto rounded-lg border border-border bg-[#050b12] p-3 font-mono text-[0.72rem] leading-5 text-[#d9f7f4] [&>code]:bg-transparent [&>code]:border-0 [&>code]:p-0 [&>code]:text-inherit"
      {...props}
    />
  ),
  code: ({ node: _node, ...props }: HTMLAttributes<HTMLElement> & { node?: unknown }) => (
    <code
      className="rounded border border-border bg-muted/50 px-1 py-0.5 font-mono text-[0.78em] text-[#9de7e2]"
      {...props}
    />
  ),
  h1: ({ node: _node, ...props }) => (
    <h1 className="mt-4 mb-2 text-lg font-semibold text-foreground" {...props}>
      {props.children}
    </h1>
  ),
  h2: ({ node: _node, ...props }) => (
    <h2 className="mt-4 mb-2 text-base font-semibold text-foreground" {...props}>
      {props.children}
    </h2>
  ),
  h3: ({ node: _node, ...props }) => (
    <h3 className="mt-3 mb-1.5 text-sm font-semibold text-foreground" {...props}>
      {props.children}
    </h3>
  ),
  table: ({ node: _node, ...props }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm text-muted-foreground" {...props} />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th
      className="border-b border-border bg-card/50 px-3 py-2 font-medium text-foreground"
      {...props}
    />
  ),
  td: ({ node: _node, ...props }) => (
    <td className="border-b border-border px-3 py-2 last:border-b-0" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="border-l-2 border-brand-accent-border pl-3 italic text-muted-foreground"
      {...props}
    />
  ),
} satisfies ComponentProps<typeof ReactMarkdown>['components'];
/* eslint-enable @typescript-eslint/no-unused-vars */

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
