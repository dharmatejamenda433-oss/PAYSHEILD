import { useId } from 'react';
import { cn } from '../../utils/cn';

export default function Input({
  label,
  id,
  error,
  hint,
  prefix,
  suffix,
  trailing,
  className,
  inputClassName,
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const messageId = `${inputId}-message`;

  return (
    <div className={className}>
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          {label}
          {props.required ? (
            <span className="ml-0.5 text-rose-500" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-medium text-slate-500">
            {prefix}
          </span>
        ) : null}

        <input
          id={inputId}
          className={cn(
            'field',
            prefix && 'pl-9',
            (suffix || trailing) && 'pr-12',
            error &&
              'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10',
            inputClassName
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? messageId : undefined}
          {...props}
        />

        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-sm font-medium text-slate-500">
            {suffix}
          </span>
        ) : null}

        {trailing ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">
            {trailing}
          </div>
        ) : null}
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
