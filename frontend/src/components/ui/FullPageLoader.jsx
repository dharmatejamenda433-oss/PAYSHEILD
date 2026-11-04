import { ShieldCheck } from 'lucide-react';

export default function FullPageLoader({
  message = 'Loading PayShield…',
  dark = false,
}) {
  return (
    <div
      className={
        dark
          ? 'flex min-h-screen items-center justify-center bg-navy-950'
          : 'flex min-h-[60vh] items-center justify-center bg-slate-50'
      }
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-900 text-white">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-navy-900/20" />
          <ShieldCheck className="relative h-7 w-7" />
        </span>
        <p
          className={
            dark ? 'text-sm text-navy-200' : 'text-sm text-slate-500'
          }
        >
          {message}
        </p>
      </div>
    </div>
  );
}
