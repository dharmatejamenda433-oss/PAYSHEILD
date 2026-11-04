import { AlertOctagon, RefreshCw } from 'lucide-react';
import Button from './Button';
import { cn } from '../../utils/cn';

export default function ErrorState({
  title = 'Could not load this data',
  message,
  onRetry,
  className,
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center px-6 py-12 text-center',
        className
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
        <AlertOctagon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">
        {message || 'Something went wrong while contacting the server.'}
      </p>
      {onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-5"
          icon={RefreshCw}
          onClick={onRetry}
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}
