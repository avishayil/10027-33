import { cn } from '../utils/cn';

export function Progress({ value = 0, className, indicatorClassName }) {
  return (
    <div
      className={cn(
        'relative h-4 w-full overflow-hidden rounded-full bg-slate-100',
        className
      )}
    >
      <div
        className={cn(
          'h-full w-full flex-1 bg-primary-600 transition-all',
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </div>
  );
}
