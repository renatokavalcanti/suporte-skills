import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        neutral:
          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        info: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
        success:
          'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
        warning:
          'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
        danger: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
