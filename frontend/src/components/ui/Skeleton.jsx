import { cn } from '../../utils/cn';

export default function Skeleton({ className }) {
  return (
    <div
      className={cn('skeleton-shimmer rounded-lg', className)}
      aria-hidden="true"
    />
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid items-center gap-4 px-5 py-4"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn('h-4', columnIndex === 0 ? 'w-24' : 'w-full')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="surface p-5">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="mt-4 h-3 w-24" />
          <Skeleton className="mt-2 h-7 w-32" />
        </div>
      ))}
    </div>
  );
}
