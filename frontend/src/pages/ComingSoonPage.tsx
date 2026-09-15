import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Sparkles, 
  ArrowRight, 
  Package, 
  CheckCircle2, 
  Bell, 
  Layers, 
  Check,
  Calendar,
  Smartphone,
  Dumbbell,
  CheckSquare
} from 'lucide-react';
import { toast } from 'sonner';

interface ComingSoonPageProps {
  appName: string;
  description?: string;
}

const APP_METADATA: Record<
  string, 
  { icon: React.FC<{ className?: string }>; tag: string; description: string; highlights: string[] }
> = {
  'Task Management': {
    icon: CheckSquare,
    tag: 'Next in Pipeline',
    description: 'Sprint planning, Kanban workflows, task delegation, and timeline tracking built for high-velocity teams.',
    highlights: ['Agile sprint boards', 'Custom status pipelines', 'Automated deadline alerts', 'Team workload insights'],
  },
  'POS': {
    icon: Smartphone,
    tag: 'In Active Development',
    description: 'Lightning-fast point of sale checkout, instant thermal receipts, barcode scanning, and offline cash drawer support.',
    highlights: ['Split payments & cashiers', 'Offline-first cash register', 'Direct inventory sync', 'Instant receipt printing'],
  },
  'Booking': {
    icon: Calendar,
    tag: 'Under Design',
    description: 'Seamless client appointment scheduling, recurring reservations, and automated SMS/email reminders.',
    highlights: ['Multi-staff calendars', 'Automated customer reminders', 'Custom booking links', 'Service duration buffers'],
  },
  'Gym Management': {
    icon: Dumbbell,
    tag: 'Roadmap Target',
    description: 'Member management, biometric turnstile integrations, recurring plan billing, and trainer class schedules.',
    highlights: ['Member card check-in', 'Class & trainer rosters', 'Automated renewals', 'Locker & equipment logs'],
  },
};

export const ComingSoonPage: React.FC<ComingSoonPageProps> = ({ appName, description }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const meta = APP_METADATA[appName] || {
    icon: Layers,
    tag: 'Coming Soon',
    description: description || `We're building an exceptional ${appName.toLowerCase()} experience for your business.`,
    highlights: ['Deep integration with your Orviohub workspace', 'Real-time multi-branch synchronisation', 'Role-based team permissions'],
  };

  const Icon = meta.icon;

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }
    setSubscribed(true);
    toast.success(`You're on the priority notification list for ${appName}!`);
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between selection:bg-[#714b67]/40 selection:text-white relative overflow-hidden font-sans">
      {/* Background Decorative Glows */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[#714b67]/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 right-10 w-[500px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Minimal Top Header */}
      <header className="relative z-10 w-full border-b border-white/5 bg-black/60 backdrop-blur-xl h-16 flex items-center justify-between px-6 sm:px-10 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#714b67] to-[#a26893] flex items-center justify-center text-white font-bold text-sm shadow-md shadow-[#714b67]/20 group-hover:scale-105 transition-transform">
            O
          </div>
          <span className="font-bold text-white tracking-tight text-base">Orviohub</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/inventory')}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors border border-white/10"
          >
            <Package className="w-3.5 h-3.5 text-[#c79dbd]" />
            <span>Open Inventory</span>
          </button>
        </div>
      </header>

      {/* Main Showcase Hero */}
      <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 flex flex-col items-center justify-center text-center space-y-8">
        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#714b67]/20 border border-[#714b67]/40 text-[#c79dbd] text-xs font-semibold tracking-wide">
          <span className="w-2 h-2 rounded-full bg-[#c79dbd] animate-pulse" />
          <span>{meta.tag}</span>
        </div>

        {/* App Title & Description */}
        <div className="space-y-4 max-w-2xl">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-[#714b67]/40 to-slate-900 border border-[#714b67]/50 flex items-center justify-center text-[#e5c2dc] shadow-xl shadow-[#714b67]/25 mb-4">
            <Icon className="w-8 h-8" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            {appName}
          </h1>
          <p className="text-base sm:text-lg text-slate-400 font-normal leading-relaxed">
            {meta.description}
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl text-left">
          {meta.highlights.map((highlight, index) => (
            <div
              key={index}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-slate-300 backdrop-blur-sm"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium">{highlight}</span>
            </div>
          ))}
        </div>

        {/* Active Flagship Application Highlight (Inventory Callout) */}
        <div className="w-full max-w-xl p-5 rounded-2xl bg-gradient-to-r from-[#714b67]/30 via-slate-900 to-slate-900 border border-[#714b67]/40 text-left relative overflow-hidden shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Flagship MVP Live Now</span>
              </div>
              <h3 className="text-base font-bold text-white">
                Inventory Management is Available Today
              </h3>
              <p className="text-xs text-slate-400 max-w-md">
                Manage retail products, track stock adjustments, and run multi-branch operations right now.
              </p>
            </div>
            <button
              id="btn-goto-inventory"
              onClick={() => navigate('/inventory')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#714b67] to-[#8a597d] hover:from-[#825576] hover:to-[#9a648c] text-white text-xs font-bold shadow-lg shadow-[#714b67]/30 transition-all hover:scale-105 active:scale-95 shrink-0"
            >
              <span>Go to Inventory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Email Notification Sign-up */}
        <div className="w-full max-w-md pt-2 space-y-3">
          <p className="text-xs text-slate-500 font-medium">
            Be the first to get access when {appName} launches:
          </p>
          {subscribed ? (
            <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <Check className="w-4 h-4" />
              <span>We'll notify you as soon as this module goes live!</span>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#714b67] focus:ring-1 focus:ring-[#714b67]"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition-colors"
              >
                <Bell className="w-3.5 h-3.5 text-[#c79dbd]" />
                <span>Notify Me</span>
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 w-full border-t border-white/5 py-4 text-center text-xs text-slate-600">
        &copy; {new Date().getFullYear()} Orviohub. All rights reserved.
      </footer>
    </div>
  );
};

export default ComingSoonPage;
