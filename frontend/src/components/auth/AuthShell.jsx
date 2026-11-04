import {
  BadgeCheck,
  Gauge,
  Radar,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Brand from '../layout/Brand';

const FEATURES = [
  {
    icon: Radar,
    title: 'Hybrid fraud scoring',
    text: 'Explainable rules and a trained ML model score every payment before it moves.',
  },
  {
    icon: Gauge,
    title: 'Velocity and device signals',
    text: 'Redis tracks short-term transaction bursts, failed attempts and new devices.',
  },
  {
    icon: BadgeCheck,
    title: 'Human review for edge cases',
    text: 'Medium-risk payments wait for an admin decision; declined payments never move money.',
  },
];

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen bg-white">
      <section className="relative hidden overflow-hidden bg-navy-950 lg:flex lg:w-[46%] xl:w-1/2">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-blue-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />

        <div className="relative flex w-full flex-col justify-between p-10 xl:p-14">
          <Brand />

          <div className="max-w-lg">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-blue-200">
              <Sparkles className="h-3.5 w-3.5" />
              Intelligent payment protection
            </div>

            <h1 className="mt-5 text-4xl font-semibold leading-[1.12] tracking-tight text-white xl:text-[44px]">
              Every payment.
              <br />
              Scored before it moves.
            </h1>

            <p className="mt-4 max-w-md text-sm leading-relaxed text-navy-100/80">
              PayShield is a simulated payment platform that decides whether to
              approve, hold or decline a transfer using rules, live transaction
              velocity and machine learning.
            </p>

            <ul className="mt-9 space-y-5">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;

                return (
                  <li key={feature.title} className="flex items-start gap-3.5">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-blue-300">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {feature.title}
                      </p>
                      <p className="mt-0.5 max-w-sm text-xs leading-relaxed text-navy-200/75">
                        {feature.text}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-navy-200">
                  <ShieldCheck className="h-4 w-4 text-blue-300" />
                  Decision bands
                </p>
                <span className="text-[11px] text-navy-300">Configurable</span>
              </div>

              <div className="mt-4 flex h-2 overflow-hidden rounded-full">
                <div className="w-[30%] bg-emerald-400" />
                <div className="w-[40%] bg-amber-400" />
                <div className="w-[30%] bg-rose-400" />
              </div>

              <div className="mt-2.5 flex justify-between text-[11px] text-navy-200/80">
                <span>Low · 0–29</span>
                <span>Review · 30–69</span>
                <span>High · 70–100</span>
              </div>
            </div>

            <p className="mt-5 text-[11px] uppercase tracking-[0.16em] text-navy-400">
              Simulation only · No real banking credentials
            </p>
          </div>
        </div>
      </section>

      <section className="flex w-full flex-col lg:w-[54%] xl:w-1/2">
        <div className="flex items-center justify-between px-5 pt-6 sm:px-10 lg:justify-end">
          <Brand dark className="lg:hidden" />
          <p className="hidden text-xs text-slate-400 lg:block">
            Simulated environment
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {subtitle}
            </p>

            <div className="mt-8">{children}</div>

            {footer ? <div className="mt-6">{footer}</div> : null}
          </div>
        </div>

        <div className="px-5 pb-6 text-center text-[11px] text-slate-400">
          PayShield fraud detection demo · All payments are simulated
        </div>
      </section>
    </div>
  );
}
