import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { OrivioLogo } from '@/components/brand/OrivioLogo';

interface LegalPageProps {
  title: string;
  summary: string;
  children: ReactNode;
}

export function LegalPage({ title, summary, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-[#714b67] selection:text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/signup" className="flex items-center gap-2 text-white" aria-label="Orviohub signup">
            <OrivioLogo size={34} />
            <span className="text-sm font-semibold tracking-wide">Orviohub</span>
          </Link>
          <Link
            to="/signup"
            className="inline-flex min-h-10 items-center gap-2 rounded-sm bg-[#714b67] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#86597a]"
          >
            Create account <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
        <Link
          to="/signup"
          className="mb-8 inline-flex items-center gap-2 text-xs font-medium text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to signup
        </Link>

        <div className="mb-10 border-b border-white/10 pb-8">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c79dbd]">Legal</p>
          <h1 className="text-4xl font-bold text-white sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{summary}</p>
          <p className="mt-4 text-xs text-slate-500">Effective: 24 September 2026</p>
        </div>

        <article className="legal-document space-y-9 text-sm leading-7 text-slate-300">{children}</article>

        <section className="mt-14 rounded-sm border border-[#714b67]/40 bg-[#160f15] p-6 text-center">
          <h2 className="text-2xl font-semibold text-white">Ready to use Orviohub?</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
            Create your account, then choose whether to explore, join an organization, or start your own.
          </p>
          <Link
            to="/signup"
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-sm bg-[#714b67] px-6 text-xs font-semibold text-white transition-colors hover:bg-[#86597a]"
          >
            Continue to signup <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 py-6 text-center text-xs text-slate-500">
        <Link to="/terms" className="mx-3 hover:text-white">Terms of Service</Link>
        <Link to="/privacy" className="mx-3 hover:text-white">Privacy Policy</Link>
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-2xl font-semibold text-white">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="ml-5 list-disc space-y-2 marker:text-[#c79dbd]">{children}</ul>;
}
