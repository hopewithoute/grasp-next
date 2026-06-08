'use client';

import { memo, type ComponentProps, type HTMLAttributes } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MARKDOWN_REMARK_PLUGINS = [remarkGfm];

 
const MARKDOWN_COMPONENTS = {
  p: ({ node: _node, ...props }) => (
    <p className="text-muted-foreground whitespace-pre-wrap" {...props} />
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
    <strong className="text-foreground font-semibold" {...props} />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul className="text-muted-foreground list-disc space-y-1 pl-4" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="text-muted-foreground list-decimal space-y-1 pl-4" {...props} />
  ),
  li: ({ node: _node, ...props }) => <li {...props} />,
  pre: ({ node: _node, ...props }) => (
    <pre
      className="border-border overflow-x-auto rounded-lg border bg-[#050b12] p-3 font-mono text-[0.72rem] leading-5 text-[#d9f7f4] [&>code]:border-0 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit"
      {...props}
    />
  ),
  code: ({ node: _node, ...props }: HTMLAttributes<HTMLElement> & { node?: unknown }) => (
    <code
      className="border-border bg-muted/50 rounded border px-1 py-0.5 font-mono text-[0.78em] text-[#9de7e2]"
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
    <div className="border-border my-2 overflow-x-auto rounded-lg border">
      <table className="text-muted-foreground w-full text-left text-sm" {...props} />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th
      className="border-border bg-card/50 text-foreground border-b px-3 py-2 font-medium"
      {...props}
    />
  ),
  td: ({ node: _node, ...props }) => (
    <td className="border-border border-b px-3 py-2 last:border-b-0" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="border-brand-accent-border text-muted-foreground border-l-2 pl-3 italic"
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
