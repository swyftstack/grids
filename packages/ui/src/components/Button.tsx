import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../cn.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg hover:bg-accent/90 active:bg-accent/80 shadow-subtle focus-visible:ring-accent/50',
  secondary:
    'bg-surface-2 text-content hover:bg-border active:bg-border-strong focus-visible:ring-border-strong',
  outline:
    'border border-border-strong text-content hover:bg-surface-2 focus-visible:ring-border-strong',
  ghost: 'text-content-muted hover:bg-surface-2 hover:text-content focus-visible:ring-border',
  danger:
    'bg-danger text-white hover:bg-danger/90 active:bg-danger/80 focus-visible:ring-danger/50',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  md: 'h-8 px-3 text-sm gap-2 rounded-md',
  lg: 'h-10 px-4 text-sm gap-2 rounded-lg',
  icon: 'h-8 w-8 rounded-md',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium',
        'transition-colors duration-100 outline-none',
        'focus-visible:ring-2 focus-visible:ring-offset-0',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
