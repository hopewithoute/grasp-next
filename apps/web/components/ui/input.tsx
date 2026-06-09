import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  'h-8 w-full min-w-0 rounded-none border border-input bg-background/50 px-2.5 py-1 font-mono text-[0.65rem] tracking-widest uppercase transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/50 focus-visible:border-brand-accent focus-visible:ring-1 focus-visible:ring-brand-accent/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 dark:bg-input/10 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40'
);

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputVariants({ className }))}
      {...props}
    />
  );
}

export { Input };
