import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function Select({
  label,
  id,
  error,
  hint,
  options = [],
  className,
  children,
  ...props
}) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const messageId = `${selectId}-message`;

  return (
    <div className={className}>
      {label ? (
        <label
          htmlFor={selectId}
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      ) : null}

      <div className="relative">
        <select
          id={selectId}
          className={cn(
            'field appearance-none pr-10',
            error &&
              'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10'
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? messageId : undefined}
          {...props}
        >
          {children ||
            options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
      </div>

      {error ? (
        <p id={messageId} className="mt-1.5 text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
