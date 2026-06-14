import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../cn.js';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-8 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-content',
        'placeholder:text-content-subtle',
        'transition-colors outline-none',
        'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});
